
require('dotenv').config();
const { Telegraf } = require('telegraf');
const phrases = require('./dragon_tease_lines');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const dragonImages = [
  'assets/images/dragon1.png',
  'assets/images/dragon2.png',
  'assets/images/dragon3.png',
  'assets/images/dragon4.png',
  'assets/images/dragon5.png',
  'assets/images/dragon6.png',
  'assets/images/dragon7.png'
];

const dragonVideos = [
  'assets/images/dragon1.mp4',
  'assets/images/dragon2.mp4',
  'assets/images/dragon3.mp4'
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatTime(ms) {
  let totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

async function sendTeaser(timeRemainingMs) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const phrase = randomItem(phrases);
  const timeMsg = `⏳ Time remaining: ${formatTime(timeRemainingMs)}`;
  const useVideo = Math.random() < 0.5;
  try {
    if (useVideo) {
      const video = randomItem(dragonVideos);
      await bot.telegram.sendVideo(chatId, { source: video }, { caption: `${phrase}\n\n${timeMsg}` });
      console.log(`[${new Date().toLocaleString()}] Sent: "${phrase}" with video ${video} | ${timeMsg}`);
    } else {
      const image = randomItem(dragonImages);
      await bot.telegram.sendPhoto(chatId, { source: image }, { caption: `${phrase}\n\n${timeMsg}` });
      console.log(`[${new Date().toLocaleString()}] Sent: "${phrase}" with image ${image} | ${timeMsg}`);
    }
  } catch (err) {
    console.error(`[${new Date().toLocaleString()}] Failed to send teaser:`, err);
  }
}

async function runTeaserTimer() {
  // Calculate time remaining from now until today at 19:30:42
  const nowDate = new Date();
  const targetDate = new Date(nowDate);
  targetDate.setHours(19, 30, 42, 0);
  if (targetDate < nowDate) {
    // If already past, set to tomorrow
    targetDate.setDate(targetDate.getDate() + 1);
  }
  const totalMs = targetDate - nowDate;

  const INTERVALS = [0.1, 0.25, 0.5, 0.75, 0.9]; // Send at these fractions of the countdown
  const sendTimes = INTERVALS.map(f => Math.floor(totalMs * f));
  sendTimes.push(totalMs - 10000); // 10 seconds before
  sendTimes.push(totalMs); // Exactly at the countdown end

  const start = Date.now();
  for (const t of sendTimes) {
    const now = Date.now();
    const wait = start + t - now;
    if (wait > 0) {
      await new Promise(res => setTimeout(res, wait));
    }
    const remaining = Math.max(0, targetDate - new Date());
    await sendTeaser(remaining);
  }
  console.log(`[${new Date().toLocaleString()}] All teasers sent. Countdown complete.`);
  process.exit(0);
}

runTeaserTimer();
