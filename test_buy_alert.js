require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// === CONFIG ===
const BUY_BOT_WEBHOOK = 'https://buy-webhook-server-893099525123.us-central1.run.app/notify-buy';


// === Fake Buy Data (customize as needed) ===
const tokens = 123.45;
const amountUsd = "99.99";
const sender = "0x1234567890abcdef1234567890abcdef12345678";
const txHash = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef";

// === Media selection logic (same as in buy bot) ===
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

const messageText = `🚀 SONIC BUY ALERT! 🚀\n\n` +
  `🪙 Amount: ${tokens} SONIC\n💵 Value: $${amountUsd}\n👤 Buyer: [${sender.slice(0, 6)}...${sender.slice(-4)}](https://sonicscan.io/address/${sender})\n🔗 [View Tx](https://sonicscan.io/tx/${txHash})`;

const buyData = {
  tokens: tokens,
  amountUsd: amountUsd,
  buyer: sender,
  buyerUrl: `https://sonicscan.io/address/${sender}`,
  txUrl: `https://sonicscan.io/tx/${txHash}`,
  mediaPath: mediaPath,
  messageText: messageText
};

console.log('Sending test buy alert:', buyData);

axios.post(BUY_BOT_WEBHOOK, buyData)
  .then(res => {
    console.log('Test buy alert sent! Status:', res.status);
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to send test buy alert:', err);
    process.exit(1);
  });
