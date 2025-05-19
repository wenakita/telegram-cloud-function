const { JsonRpcProvider, Contract } = require('ethers');
const axios = require('axios');

// === CONFIGURATION ===
const SONIC_RPC_URL = process.env.SONIC_RPC_URL || "https://rpc.soniclabs.com"; // Replace with your preferred Sonic RPC
const TOKEN_ADDRESS = "0x3BBbefa032717688D9b1F256C5A6498541158428"; // Your DRAGON token
const PAIR_ADDRESSES = [
  "0x3bf110657118b51a1f2c1f1d7d593577b6033fa9",
  "0x63f239783396547d92f8fb63e40b5c2ce690a42e",
  "0x88c6ca632eed235c90a690c73643d508770b8888",
  "0x2183faf6bc955d344dbc2f9965471b14c0853586"
]; // All lowercased for consistency
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

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
const pairs = PAIR_ADDRESSES.map(addr => {
  const contract = new Contract(addr, PAIR_ABI, provider);
  console.log(`[DEBUG] Created contract for pair: ${addr}`);
  return contract;
});

console.log("[INFO] Listening for buys on all watched pairs:");
PAIR_ADDRESSES.forEach(addr => console.log("  Pair:", addr));

// === LISTEN FOR BUYS ON EACH PAIR ===
pairs.forEach((pair, idx) => {
  const pairAddress = PAIR_ADDRESSES[idx];
  console.log(`[DEBUG] Attaching Swap event listener for pair: ${pairAddress}`);
  pair.on("Swap", async (sender, amount0In, amount1In, amount0Out, amount1Out, to, event) => {
    console.log(`[DEBUG] Swap event fired for pair ${pairAddress}:`, {
      sender, amount0In: amount0In.toString(), amount1In: amount1In.toString(), amount0Out: amount0Out.toString(), amount1Out: amount1Out.toString(), to
    });
    let token0, token1;
    try {
      token0 = (await pair.token0()).toLowerCase();
      token1 = (await pair.token1()).toLowerCase();
      console.log(`[DEBUG] Pair ${pairAddress} token0: ${token0}, token1: ${token1}`);
    } catch (e) {
      console.error("Could not fetch token0/token1 for pair", pairAddress, e);
      return;
    }
    let isDragonBuy = false;
    let tokens = 0;
    if (token1 === DRAGON_TOKEN && amount0In.gt(0) && amount1Out.gt(0)) {
      isDragonBuy = true;
      tokens = parseFloat(require('ethers').ethers.utils.formatUnits(amount1Out, 18));
    } else if (token0 === DRAGON_TOKEN && amount1In.gt(0) && amount0Out.gt(0)) {
      isDragonBuy = true;
      tokens = parseFloat(require('ethers').ethers.utils.formatUnits(amount0Out, 18));
    } else {
      console.log(`[DEBUG] Not a DRAGON buy: token0=${token0}, token1=${token1}, amount0In=${amount0In.toString()}, amount1In=${amount1In.toString()}, amount0Out=${amount0Out.toString()}, amount1Out=${amount1Out.toString()}`);
      return;
    }
    if (!isDragonBuy) return;
    const txHash = event.transactionHash;
    let priceUsd = null;
    try {
      let dexRes;
      try {
        dexRes = await require('axios').get(`https://api.dexscreener.com/latest/dex/pairs/sonic/${pairAddress}`);
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
    await sendBuyAlert({
      sender,
      tokens,
      amountUsd,
      txHash
    });
  });
});

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