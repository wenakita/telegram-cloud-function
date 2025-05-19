require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

// --- Copy of formatBuyCaption from index.js ---
function formatBuyCaption(buy) {
  const coin = buy.coin || 'DRAGON';
  const botName = buy.botName || 'Sonic Red Dragon';
  const botUrl = buy.botUrl || 'https://t.me/sonic_reddragon_bot';
  const whale = '🐋';
  const greenBar = '🟢'.repeat(64);
  return (
    `${whale} <a href="${botUrl}">${botName}</a> Whale Buy! ${whale}\n` +
    `${greenBar}\n\n` +
    `🔀 Spent <b>$${buy.amountUsd || '?'}</b> (<b>${buy.amountEth || '?' } ETH</b>)\n` +
    `🔀 Got <b>${buy.tokens || '?'} ${coin}</b>\n` +
    `👤 <a href="${buy.buyerUrl || '#'}">Buyer</a> / <a href="${buy.txUrl || '#'}">TX</a>\n` +
    (buy.walletValue ? `💎 Wallet Value <b>$${buy.walletValue}</b>\n` : '') +
    (buy.position ? `🪙 Position <b>${buy.position}</b>\n` : '') +
    (buy.marketCap ? `💸 Market Cap <b>$${buy.marketCap}</b>\n` : '') +
    '\n' +
    `<a href="${buy.dextoolsUrl || 'https://www.dextools.io/'}">DexT</a> | ` +
    `<a href="${buy.screenerUrl || 'https://dexscreener.com/'}">Screener</a> | ` +
    `<a href="${buy.buyUrl || 'https://sonicswap.io/swap?outputCurrency=0x3BBbefa032717688D9b1F256C5A6498541158428'}">Buy</a> | ` +
    `<a href="${buy.trendingUrl || 'https://t.me/Trending'}">Trending</a>`
  );
}

const app = express();
const PORT = process.env.BUY_WEBHOOK_PORT || 8080;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

app.use(express.json());

app.post('/notify-buy', async (req, res) => {
  const buy = req.body;
  console.log('Received buy payload:', JSON.stringify(buy, null, 2));
  // Defensive: Check for required fields and fallback
  if (!buy || typeof buy !== 'object') {
    console.error('Malformed payload:', buy);
    return res.status(400).json({ ok: false, error: 'Malformed payload' });
  }
  // Defensive: Provide default values for all used fields
  buy.coin = buy.coin || 'DRAGON';
  buy.botName = buy.botName || 'Sonic Red Dragon';
  buy.botUrl = buy.botUrl || 'https://t.me/sonic_reddragon_bot';
  buy.amountUsd = buy.amountUsd || '?';
  buy.amountEth = buy.amountEth || '?';
  buy.tokens = buy.tokens || '?';
  buy.buyerUrl = buy.buyerUrl || '#';
  buy.txUrl = buy.txUrl || '#';
  buy.walletValue = buy.walletValue || null;
  buy.position = buy.position || null;
  buy.marketCap = buy.marketCap || null;
  buy.dextoolsUrl = buy.dextoolsUrl || 'https://www.dextools.io/';
  buy.screenerUrl = buy.screenerUrl || 'https://dexscreener.com/';
  buy.buyUrl = buy.buyUrl || 'https://sonicswap.io/swap?outputCurrency=0x3BBbefa032717688D9b1F256C5A6498541158428';
  buy.trendingUrl = buy.trendingUrl || 'https://t.me/Trending';
  try {
    // Helper to get all media files in a directory
    function getMediaFiles(dir, exts) {
      try {
        return fs.readdirSync(dir)
          .filter(f => exts.some(ext => f.toLowerCase().endsWith(ext)))
          .map(f => path.join(dir, f));
      } catch {
        return [];
      }
    }
    // Pick a random item from array
    function randomItem(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    const videosDir = path.resolve(__dirname, 'assets/videos');
    const imagesDir = path.resolve(__dirname, 'assets/images');
    const videoFiles = getMediaFiles(videosDir, ['.mp4', '.mov']);
    const imageFiles = getMediaFiles(imagesDir, ['.png', '.jpg', '.jpeg', '.gif']);
    const caption = formatBuyCaption(buy);
    const replyMarkup = {
      inline_keyboard: [[
        { text: "📖 Docs", url: "https://docs.sonicreddragon.io" },
        { text: "📊 Chart", url: "https://dexscreener.com/sonic/0x3BBbefa032717688D9b1F256C5A6498541158428" },
        { text: "🌐 Website", url: "https://sonicreddragon.io" }
      ]]
    };

    if (videoFiles.length > 0) {
      const videoPath = randomItem(videoFiles);
      const form = new FormData();
      form.append('video', fs.createReadStream(videoPath));
      form.append('chat_id', TELEGRAM_CHAT_ID);
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
      form.append('reply_markup', JSON.stringify(replyMarkup));
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`;
      try {
        const tgRes = await axios.post(url, form, { headers: form.getHeaders() });
        console.log('Telegram API response (media):', tgRes.data);
      } catch (tgErr) {
        console.error('Telegram API error (media):', tgErr.response ? tgErr.response.data : tgErr);
      }
    } else if (imageFiles.length > 0) {
      const imagePath = randomItem(imageFiles);
      const form = new FormData();
      form.append('photo', fs.createReadStream(imagePath));
      form.append('chat_id', TELEGRAM_CHAT_ID);
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
      form.append('reply_markup', JSON.stringify(replyMarkup));
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
      try {
        const tgRes = await axios.post(url, form, { headers: form.getHeaders() });
        console.log('Telegram API response (image):', tgRes.data);
      } catch (tgErr) {
        console.error('Telegram API error (image):', tgErr.response ? tgErr.response.data : tgErr);
      }
    } else {
      // Fallback: send text only if no media is available
      console.error('No buy video or image found. Sending text only.');
      try {
        const tgRes = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          chat_id: TELEGRAM_CHAT_ID,
          text: caption,
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        });
        console.log('Telegram API response (text):', tgRes.data);
      } catch (tgErr) {
        console.error('Telegram API error (text):', tgErr.response ? tgErr.response.data : tgErr);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to send Telegram buy alert:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Buy webhook server listening on port ${PORT}`);
});
