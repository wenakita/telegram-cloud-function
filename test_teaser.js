require('dotenv').config();
const { Telegraf } = require('telegraf');
const phrases = require('./dragon_tease_lines');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// /time command handler
bot.command('time', async (ctx) => {
  // Calculate time remaining from now until today at 19:30:42
  const now = new Date();
  const target = new Date(now);
  target.setHours(19, 30, 42, 0);
  if (target < now) {
    target.setDate(target.getDate() + 1);
  }
  const msRemaining = target - now;
  await sendTeaser(ctx.chat.id, msRemaining);
});

const dragonImages = [
  'assets/images/dragon1.png',
  'assets/images/dragon2.png',
  'assets/images/dragon3.png',
  'assets/images/dragon4.png',
  'assets/images/dragon5.png',
  'assets/images/dragon6.png',
  'assets/images/dragon7.png'
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

const path = require('path');
const dragon1Video = path.join(__dirname, 'assets/videos/dragon1.mp4');

async function sendTeaser(chatId, timeRemainingMs) {
  const phrase = randomItem(phrases);
  const video = dragon1Video;
  const timeMsg = `⏳ Time remaining: ${formatTime(timeRemainingMs)}`;
  try {
    await bot.telegram.sendVideo(chatId, { source: video }, { caption: `${phrase}\n\n${timeMsg}` });
    console.log(`Sent: "${phrase}" with video ${video} | ${timeMsg}`);
  } catch (err) {
    console.error('Failed to send teaser:', err);
  }
}

// If run directly, start polling
if (require.main === module) {
  bot.launch();
  console.log('Bot started. Send /time in any chat to trigger the teaser.');
}