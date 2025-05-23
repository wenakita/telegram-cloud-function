// Minimal Telegram bot for Cloud Run using Telegraf
// IMPORTANT: Do NOT import or require './sonic-buy-listener.js' or './buy_webhook_server.js' here.
// These must run as SEPARATE processes, not as part of this webhook handler.
// Only export the Express app for Google Cloud Functions.
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const app = express();

// Global error handlers for diagnostics
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN is not set in environment variables.');
  process.exit(1);
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// --- Cloud Run/Express webhook setup ---

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => res.send('OK'));

// Telegram webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('[Webhook] Error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.use((err, req, res, next) => {
  console.error('[Express] Error:', err);
  res.status(500).send('Internal Server Error');
});

exports.telegramWebhook = app;

// --- Helper to format a fun, dragon-themed welcome message ---
function formatWelcomeCaption(member) {
  return (
    `🐉🔥 Welcome to the Dragon's Lair, ${member.first_name || 'new Dragon'}! 🔥🐉\n\n` +
    `You’ve just joined the most legendary community on Sonic!\n` +
    `Drop a message and let your dragon spirit soar! 🚀\n\n` +
    `#DragonHorde #SonicRedDragon`
  );
}

// --- Send welcome video when a new user joins the main group ---
bot.on('new_chat_members', async (ctx) => {
  try {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const videoPath = path.resolve(__dirname, 'assets/videos/Welcome.mp4');
    for (const member of ctx.message.new_chat_members) {
      await ctx.telegram.sendVideo(chatId, { source: videoPath }, {
        caption: formatWelcomeCaption(member),
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📖 Docs", url: "https://docs.sonicreddragon.io" },
              { text: "📊 Chart", url: "https://dexscreener.com/sonic/0x3BBbefa032717688D9b1F256C5A6498541158428" },
              { text: "🌐 Website", url: "https://sonicreddragon.io" }
            ]
          ]
        }
      });
    }
  } catch (err) {
    console.error('Failed to send welcome video:', err);
  }
});

// --- Helper to format a fun, engaging buy message ---
function formatBuyCaption(buy) {
  // buy = { amountEth, amountUsd, tokens, buyer, buyerUrl, txUrl, chartUrl, tradeUrl, marketCap, walletValue, position, dextoolsUrl, screenerUrl, buyUrl, trendingUrl, coin, botName, botUrl }
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

// --- /testwelcome command for admins/devs ---
bot.command('testwelcome', async (ctx) => {
  console.log('/testwelcome command received');
  try {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const videoPath = path.resolve(__dirname, 'assets/videos/Welcome.mp4');
    const fakeMember = { first_name: ctx.from.first_name || ctx.from.username || 'TestUser' };
    await ctx.telegram.sendVideo(chatId, { source: videoPath }, {
      caption: formatWelcomeCaption(fakeMember),
    });
    await ctx.reply('✅ Sent test welcome video to main group.');
  } catch (err) {
    console.error('Failed to send test welcome video:', err);
    await ctx.reply('❌ Failed to send test welcome video.');
  }
});

// --- /testbuy command for admins/devs ---
bot.command('testbuy', async (ctx) => {
  console.log('/testbuy command received');
  try {
    const sampleBuy = {
      amountEth: '0.88',
      amountUsd: '2,345.67',
      tokens: '42,069 DRAGON',
      buyer: ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name,
      buyerUrl: 'https://sonicscan.xyz/address/0x123...abc',
      txUrl: 'https://sonicscan.xyz/tx/0xabc...def',
      chartUrl: 'https://dexscreener.com/sonic/0x3BBbefa032717688D9b1F256C5A6498541158428',
      tradeUrl: 'https://sonicswap.io/swap?outputCurrency=0x3BBbefa032717688D9b1F256C5A6498541158428',
      marketCap: '6,942,000',
    };
    await notifyBuyOnChain(sampleBuy);
    await ctx.reply('✅ Sent test buy video to main group.');
  } catch (err) {
    console.error('Failed to send test buy video:', err);
    await ctx.reply('❌ Failed to send test buy video.');
  }
});

// --- Function to send Buy video to main group ---
async function notifyBuyOnChain(buyData) {
  try {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const videoPath = path.resolve(__dirname, 'assets/videos/Buy.mp4');
    const caption = formatBuyCaption(buyData);
    await bot.telegram.sendVideo(chatId, { source: videoPath }, {
      caption,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📖 Docs", url: "https://docs.sonicreddragon.io" },
            { text: "📊 Chart", url: "https://dexscreener.com/sonic/0x3BBbefa032717688D9b1F256C5A6498541158428" },
            { text: "🌐 Website", url: "https://sonicreddragon.io" }
          ]
        ]
      }
    });
  } catch (err) {
    console.error('Failed to send buy video:', err);
  }
}
// To use: Call notifyBuyOnChain(buyData) from your blockchain event handler logic.

// Log every incoming update for debugging
bot.use(async (ctx, next) => {
  try {
    if (ctx.updateType) {
      console.log(`Incoming update type: ${ctx.updateType}`);
    }
    if (ctx.message && ctx.message.text) {
      console.log(`Message from ${ctx.from && ctx.from.username}: ${ctx.message.text}`);
    }
    await next();
  } catch (err) {
    console.error('Error in middleware:', err);
    throw err;
  }
});

// /start command with onboarding and referral flow
const GROUP_LINKS = [
  { name: 'Sonic Builders', url: 'https://t.me/SonicBuilders' },
  { name: 'Sonic Marines', url: 'https://t.me/FantomMarines' },
  { name: 'Sonic English', url: 'https://t.me/Sonic_English' }
];
const MAIN_GROUP_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-1002567611285";
const REFERRAL_REQUEST_TEXT =
  "If Red Dragon has million number of fans i am one of them 🙋🏻. if Red Dragonhas ten fans i am one of them. if Red Dragonhave only one fan and that is me 🙋🏼🙋🏽🙋🏾. if Red Dragonhas no fans, that means i am no more on the earth 😢. if world against Red Dragon, i am against the world ❌🌍☄️. i love #RedDragon until my last breath.. 😍 .. Die Hard fan of Red Dragon🤓🌹. Hit Like If you Think Red Dragon is Best player & Smart In the world 🤠 I am requestiing a referral code please. Thanks!";

// Simple in-memory map to track onboarding state (reset on restart, for demo only)
const onboardingState = new Map();

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  onboardingState.set(userId, { awaitingReferral: true });
  await ctx.reply(
    `👋 Hi ${ctx.from.first_name || "there"}!
\nWelcome to Sonic Red Dragon Bot.\n\n🔑 Please enter your referral code to continue.\n\nIf you don't have a referral code, tap the button below!`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "I don't have a referral code", callback_data: "NO_REFERRAL" }
          ]
        ]
      }
    }
  );
});

// --- /testwelcome command for admins/devs ---
bot.command('testwelcome', async (ctx) => {
  console.log('/testwelcome command received');
  console.log('/testwelcome command received');
  try {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const videoPath = path.resolve(__dirname, 'assets/videos/Welcome.mp4');
    const fakeMember = { first_name: ctx.from.first_name || ctx.from.username || 'TestUser' };
    await ctx.telegram.sendVideo(chatId, { source: videoPath }, {
      caption: formatWelcomeCaption(fakeMember),
    });
    await ctx.reply('✅ Sent test welcome video to main group.');
  } catch (err) {
    console.error('Failed to send test welcome video:', err);
    await ctx.reply('❌ Failed to send test welcome video.');
  }
});

// --- /testbuy command for admins/devs ---
bot.command('testbuy', async (ctx) => {
  console.log('/testbuy command received');
  console.log('/testbuy command received');
  try {
    const sampleBuy = {
      amountEth: '0.88',
      amountUsd: '2,345.67',
      tokens: '42,069 DRAGON',
      buyer: ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name,
      buyerUrl: 'https://sonicscan.xyz/address/0x123...abc',
      txUrl: 'https://sonicscan.xyz/tx/0xabc...def',
      chartUrl: 'https://dexscreener.com/sonic/0x3BBbefa032717688D9b1F256C5A6498541158428',
      tradeUrl: 'https://sonicswap.io/swap?outputCurrency=0x3BBbefa032717688D9b1F256C5A6498541158428',
      marketCap: '6,942,000',
    };
    await notifyBuyOnChain(sampleBuy);
    await ctx.reply('✅ Sent test buy video to main group.');
  } catch (err) {
    console.error('Failed to send test buy video:', err);
    await ctx.reply('❌ Failed to send test buy video.');
  }
});

// Handle text messages for referral code entry
global.lastReferralCode = {};
bot.on('text', async (ctx, next) => {
  // Only listen in groups, not in private chats (onboarding handled elsewhere)
  if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
    const PHRASES = [
      'If Red Dragon has million number of fans i am one of them 🙋🏻',
      'if Red Dragon has ten fans i am one of them 🙋🏻🙋🏻',
      'if Red Dragonhave only one fan and that is me 🙋🏼🙋🏽🙋🏾',
      'if Red Dragonhas no fans, that means i am no more on the earth 😢',
      'if world against Red Dragon, i am against the world ❌🌍☄️',
      'i love #RedDragon until my last breath.. 😍',
      'Die Hard fan of Red Dragon🤓🌹',
      'Hit Like If you Think Red Dragon is Best player & Smart In the world 🤠'
    ];
    // Normalize function: lowercase, trim, single spaces
    const normalize = s => s.replace(/\s+/g, ' ').toLowerCase().trim();
    const msgNorm = normalize(ctx.message.text);
    for (const phrase of PHRASES) {
      if (msgNorm === normalize(phrase)) {
        await ctx.reply('✅ Red Dragon phrase detected!');
        break;
      }
    }
  }
  // Continue onboarding logic for DMs
  const userId = ctx.from.id;
  const state = onboardingState.get(userId);
  if (state && state.awaitingReferral) {
    const code = ctx.message.text.trim();
    // Accept either a valid referral code or the official fan message
    const isValidReferral = /^RD[A-Z0-9]{6,}$/.test(code); // Example: RDABC123
    // Normalize both strings for comparison
    const normalize = s => s.replace(/\s+/g, ' ').toLowerCase().trim();
    const isFanMessage = normalize(code).includes(normalize(REFERRAL_REQUEST_TEXT).slice(0, 32)); // Check first 32 chars for leniency
    if (isValidReferral || isFanMessage) {
      onboardingState.set(userId, { awaitingReferral: false });
      global.lastReferralCode[userId] = code;
      // Generate a one-time invite link to the main group
      try {
        const invite = await ctx.telegram.createChatInviteLink(MAIN_GROUP_CHAT_ID, {
          member_limit: 1,
          creates_join_request: false
        });
        await ctx.reply(
          `✅ Referral message accepted! Here is your one-time invite link to the main group:\n${invite.invite_link}`
        );
      } catch (err) {
        await ctx.reply('✅ Referral message accepted! But I could not generate an invite link. Please contact an admin.');
        console.error('Failed to create invite link:', err);
      }
    } else {
      await ctx.reply('❌ That referral code is invalid. Please try again or tap below if you do not have one.', {
        reply_markup: {
          inline_keyboard: [
            [ { text: "I don't have a referral code", callback_data: "NO_REFERRAL" } ]
          ]
        }
      });
    }
  } else {
    return next();
  }
});

// Handle "I don't have a referral code" button
bot.action('NO_REFERRAL', async (ctx) => {
  console.log('NO_REFERRAL button pressed by user:', ctx.from && ctx.from.id, ctx.from && ctx.from.username);

  try {
    await ctx.answerCbQuery();
    // All group join buttons in one row for clarity
    const buttons = [GROUP_LINKS.map(group => ({ text: `Join ${group.name}`, url: group.url }))];
    const msg =
      '🔗 Join any of these groups below and request a referral code by messaging an admin.\n' +
      '\n' +
      'Or use the button below to instantly open the Red Dragon inline bot in any chat!';
    // Add the inline button row
    buttons.push([
      { text: "✨ Try Red Dragon Inline!", switch_inline_query: "" }
    ]);
    await ctx.reply(msg, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: buttons
      }
    });
  } catch (err) {
    console.error('Error sending group links:', err);
  }
});

// /help command
bot.help((ctx) => ctx.reply(
  '🤖 Sonic Red Dragon Bot\n\n/help — Show this message\n/start — Welcome message\n/rich — Demo rich features'
));

// /rich command: show inline keyboard and photo
bot.command('rich', async (ctx) => {
  await ctx.reply(
    '✨ <b>Rich Telegram Demo</b>\nChoose an option below:',
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.url('Open Google', 'https://google.com')],
        [Markup.button.callback('Say Hello', 'HELLO_CALLBACK')]
      ])
    }
  );
  await ctx.replyWithPhoto(
    'https://i.imgur.com/8pQe6Qp.jpg',
    { caption: 'Here\'s a rich media photo! 🖼️' }
  );
});

// Handle inline button callback
bot.action('HELLO_CALLBACK', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('👋 Hello from the inline button!');
});

// Handle inline queries for referral request
bot.on('inline_query', async (ctx) => {
  const PHRASES = [
    'If Red Dragon has million number of fans i am one of them 🙋🏻',
    'if Red Dragon has ten fans i am one of them 🙋🏻🙋🏻',
    'if Red Dragonhave only one fan and that is me 🙋🏼🙋🏽🙋🏾',
    'if Red Dragonhas no fans, that means i am no more on the earth 😢',
    'if world against Red Dragon, i am against the world ❌🌍☄️',
    'i love #RedDragon until my last breath.. 😍',
    'Die Hard fan of Red Dragon🤓🌹',
    'Hit Like If you Think Red Dragon is Best player & Smart In the world 🤠'
  ];
  const results = PHRASES.map((phrase, idx) => ({
    type: 'article',
    id: `dragon_phrase_${idx}`,
    title: `Red Dragon Message ${idx + 1}`,
    input_message_content: { message_text: phrase }
  }));
  return ctx.answerInlineQuery(results, { cache_time: 0 });
});

bot.catch((err, ctx) => {
  console.error('[Bot] Error:', err);
});

exports.telegramWebhook = app;