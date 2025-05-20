const { JsonRpcProvider, Contract } = require('ethers');
const axios = require('axios');

// === CONFIGURATION ===
const SONIC_RPC_URL = process.env.SONIC_RPC_URL || "https://rpc.soniclabs.com"; // Replace with your preferred Sonic RPC
const TOKEN_ADDRESS = "0x3BBbefa032717688D9b1F256C5A6498541158428"; // Your DRAGON token
// --- DEX FACTORY CONFIG ---
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "0x2dA25E7446A70D7be65fd4c053948BEcAA6374c8"; // Sonic PairFactory
const FACTORY_ABI = [
  "function allPairsLength() external view returns (uint256)",
  "function allPairs(uint256) external view returns (address)",
  "function getPair(address tokenA, address tokenB) external view returns (address)",
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)",
];

const DRAGON_TOKEN = (process.env.TOKEN_ADDRESS || "0x3bbbefa032717688d9b1f256c5a6498541158428").toLowerCase(); // Always lowercased
const TELEGRAM_BOT_WEBHOOK = process.env.BUY_BOT_WEBHOOK || "https://sonic-red-dragon-bot-893099525123.us-central1.run.app/notify-buy"; // POST endpoint

// Shadow Pair ABI fragment (Swap event)
const PAIR_ABI = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)"
];

// === SETUP ===
const provider = new JsonRpcProvider(SONIC_RPC_URL, 146);
provider.getBlockNumber().then(num => {
  console.log(`[DEBUG] Connected to Sonic RPC, current block: ${num}`);
}).catch(err => {
  console.error("[ERROR] Could not connect to Sonic RPC:", err);
});

// Start listening to all DRAGON pairs on startup
listenToAllDragonPairs().catch(e => {
  console.error('[FATAL] Failed to start DRAGON pair listeners:', e);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

// Listen to all pairs involving DRAGON and dynamically add new ones
async function listenToAllDragonPairs() {
  const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  const trackedPairs = new Set();

  // Helper to attach a Swap listener to a pair if it involves DRAGON
  async function attachIfDragonPair(pairAddr) {
    if (trackedPairs.has(pairAddr.toLowerCase())) return;
    const pair = new Contract(pairAddr, PAIR_ABI.concat([
      "function token0() view returns (address)",
      "function token1() view returns (address)"
    ]), provider);
    let token0, token1;
    try {
      token0 = (await pair.token0()).toLowerCase();
      token1 = (await pair.token1()).toLowerCase();
    } catch (e) {
      return;
    }
    if (token0 === DRAGON_TOKEN || token1 === DRAGON_TOKEN) {
      trackedPairs.add(pairAddr.toLowerCase());
      console.log(`[INFO] Tracking DRAGON pair: ${pairAddr} (token0=${token0}, token1=${token1})`);
      pair.on("Swap", async (sender, amount0In, amount1In, amount0Out, amount1Out, to, event) => {
        // Standard buy detection logic
        let isDragonBuy = false;
        let tokens = 0;
        try {
          if (token1 === DRAGON_TOKEN && amount0In.gt(0) && amount1Out.gt(0)) {
            isDragonBuy = true;
            tokens = parseFloat(require('ethers').ethers.utils.formatUnits(amount1Out, 18));
          } else if (token0 === DRAGON_TOKEN && amount1In.gt(0) && amount0Out.gt(0)) {
            isDragonBuy = true;
            tokens = parseFloat(require('ethers').ethers.utils.formatUnits(amount0Out, 18));
          } else {
            return;
          }
        } catch (e) {
          console.error("[ERROR] Failed to determine buy direction:", e);
          return;
        }
        if (!isDragonBuy) return;
        const txHash = event.transactionHash;
        let priceUsd = null;
        try {
          let dexRes;
          try {
            dexRes = await require('axios').get(`https://api.dexscreener.com/latest/dex/pairs/sonic/${pairAddr}`);
          } catch (e) {
            dexRes = { data: { pair: { priceUsd: 0 } } };
          }
          priceUsd = parseFloat(dexRes.data?.pair?.priceUsd || '0');
        } catch (e) {
          console.error('Failed to fetch price from DexScreener:', e);
          priceUsd = 0;
        }
        const amountUsd = priceUsd ? (tokens * priceUsd).toFixed(2) : '?';
        if (amountUsd === '?' || parseFloat(amountUsd) < 1) {
          console.log(`[DEBUG] Buy below $1 ignored: ${tokens} tokens ($${amountUsd})`);
          return;
        }
        await sendBuyAlert({ sender, tokens, amountUsd, txHash });
      });
    }
  }

  // 1. Scan all existing pairs
  const numPairs = await factory.allPairsLength();
  console.log(`[INFO] Factory at ${FACTORY_ADDRESS} has ${numPairs} pairs. Scanning for DRAGON pairs...`);
  for (let i = 0; i < numPairs; i++) {
    const pairAddr = await factory.allPairs(i);
    await attachIfDragonPair(pairAddr);
  }

  // 2. Listen for new pairs in real time
  factory.on("PairCreated", async (token0, token1, pairAddr) => {
    console.log(`[INFO] PairCreated: ${pairAddr} (token0=${token0}, token1=${token1})`);
    await attachIfDragonPair(pairAddr);
  });

  if (trackedPairs.size === 0) {
    console.warn("[WARN] No pairs found with DRAGON token. Exiting.");
    process.exit(1);
  }
}


// Helper to send buy alert (media selection + webhook POST)
async function sendBuyAlert({ sender, tokens, amountUsd, txHash }) {
  const fs = require('fs');
  const path = require('path');
  function getMediaFiles(dir, exts) {
    try {
      return fs.readdirSync(dir).filter(f => exts.some(ext => f.endsWith(ext))).map(f => path.join(dir, f));
    } catch { return []; }
  }
  const imageFiles = getMediaFiles(path.join(__dirname, 'assets/images'), ['.png', '.jpg', '.jpeg', '.gif']);
  const videoFiles = getMediaFiles(path.join(__dirname, 'assets/videos'), ['.mp4', '.mov']);
  const mediaPool = [...imageFiles, ...videoFiles];
  let mediaPath = null;
  if (mediaPool.length > 0) {
    mediaPath = mediaPool[Math.floor(Math.random() * mediaPool.length)];
  }
  const messageText = `🚀 SONIC BUY ALERT! 🚀\n\n🪙 Amount: ${tokens} DRAGON\n💵 Value: $${amountUsd}\n👤 Buyer: [${sender.slice(0, 6)}...${sender.slice(-4)}](https://sonicscan.io/address/${sender})\n🔗 [View Tx](https://sonicscan.io/tx/${txHash})`;
  const buyData = {
    tokens,
    amountUsd,
    buyer: sender,
    buyerUrl: `https://sonicscan.io/address/${sender}`,
    txUrl: `https://sonicscan.io/tx/${txHash}`,
    mediaPath,
    messageText
  };
  try {
    await require('axios').post(TELEGRAM_BOT_WEBHOOK, buyData);
    console.log("[DEBUG] Buy detected and sent:", buyData);
  } catch (err) {
    console.error("[ERROR] Failed to POST to Telegram webhook:", err);
  }
}

// Keep the process alive
process.stdin.resume();

// === MANUAL TEST: Simulate a DRAGON buy event ===
if (process.env.TEST_BUY === '1') {
  (async () => {
    // Use the same logic as a real buy event
    await sendBuyAlert({
      sender: '0x1234567890abcdef1234567890abcdef12345678',
      tokens: 42,
      amountUsd: '123.45',
      txHash: '0xdeadbeef'
    });
    console.log('[TEST] Simulated buy event sent. Check logs for detection and webhook POST.');
    process.exit(0);
  })();
}