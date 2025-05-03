require('dotenv').config();
const admin = require('firebase-admin');
const fetch = require('node-fetch');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_IDS = [1602772244, 7316396349]; // Update as needed

async function sendTelegramAlert(message) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  for (const chatId of TELEGRAM_CHAT_IDS) {
    if (!chatId || typeof chatId !== 'number') continue;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
    });
  }
}

async function main() {
  // Use ADC (Application Default Credentials) for authentication
  admin.initializeApp();
  const firestore = admin.firestore();
  const snapshot = await firestore.collection('referrals').get();
  if (snapshot.empty) {
    await sendTelegramAlert('No referral codes found in Firestore.');
    return;
  }
  let msg = '*Referral Codes List:*\n';
  let i = 1;
  snapshot.forEach(doc => {
    const data = doc.data();
    msg += `${i++}. \`${doc.id}\` | Code: \`${data.referralCode || ''}\` | Username: ${data.joinerUsername || ''}\n`;
  });
  await sendTelegramAlert(msg);
  console.log('Sent referral codes to admins.');
}

main().catch(console.error);
