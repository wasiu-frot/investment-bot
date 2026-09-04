const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

// YOUR CONFIGURATION
const ADMIN_ID = 7829040420; // Your explicit Admin ID
const CHANNEL_USERNAME = '@invextmentchannel'; // Official channel for Force-Sub check

const bot = new Telegraf(process.env.BOT_TOKEN);
const DB_FILE = './database.json';

// --- DATABASE CONTROLLER ---
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = { balances: {}, investments: {}, history: {}, referrals: {} };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const db = loadDB();

function getBalance(userId) {
  return db.balances[userId] || 0;
}

function addBalance(userId, amount) {
  db.balances[userId] = getBalance(userId) + amount;
  saveDB();
}

function logHistory(userId, text) {
  if (!db.history[userId]) db.history[userId] = [];
  db.history[userId].push({ date: new Date().toISOString(), text });
  saveDB();
}

// --- FORCE SUB MIDDLEWARE ---
async function checkChannelSub(ctx, next) {
  const userId = ctx.from.id;
  try {
    const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, userId);
    const isSubscribed = ['creator', 'administrator', 'member'].includes(member.status);

    if (isSubscribed) {
      return next();
    } else {
      return ctx.replyWithMarkdown(
        `🚨 *Channel Membership Required!*\n\nYou must join our official updates channel to use this bot.\n\nJoin here: https://t.me/invextmentchannel`,
        Markup.inlineKeyboard([
          [Markup.button.url('📢 Join Channel', 'https://t.me/invextmentchannel')],
          [Markup.button.callback('✅ I Have Joined', 'check_sub')]
        ])
      );
    }
  } catch (err) {
    return next();
  }
}

bot.use((ctx, next) => {
  if (ctx.callbackQuery && ctx.callbackQuery.data === 'check_sub') {
    return next();
  }
  return checkChannelSub(ctx, next);
});

bot.action('check_sub', async (ctx) => {
  ctx.answerCbQuery();
  ctx.replyWithMarkdown(`✅ *Verification Complete!* Welcome to the bot. Send /start to open the main menu.`);
});

// --- MAIN MENUS ---
const mainMenu = Markup.inlineKeyboard([
  [Markup.button.callback('💰 My Wallet', 'btn_wallet'), Markup.button.callback('📈 Active Plans', 'btn_plans')],
  [Markup.button.callback('🚀 Invest Now', 'btn_invest'), Markup.button.callback('📥 Deposit', 'btn_deposit')],
  [Markup.button.callback('📤 Withdraw', 'btn_withdraw'), Markup.button.callback('👥 Referral Program', 'btn_ref')],
  [Markup.button.callback('📊 ROI Calculator', 'btn_calc_info')]
]);

const investmentPlans = Markup.inlineKeyboard([
  [Markup.button.callback('⚡ Quick Plan (₦200 - ₦200 Profit in 1 Day)', 'plan_200')],
  [Markup.button.callback('🚀 Growth Plan (₦500 - ₦1,500 Total in 3 Days)', 'plan_500')],
  [Markup.button.callback('🔹 Starter Plan (₦1,000 - 5%/day - 7 Days)', 'plan_1000')],
  [Markup.button.callback('🔹 VIP Plan (₦5,000 - 10%/day - 30 Days)', 'plan_vip')],
  [Markup.button.callback('🔙 Back to Main Menu', 'btn_main')]
]);

// --- COMMANDS & ACTIONS ---
bot.start((ctx) => {
  const userId = ctx.from.id;
  const startArgs = ctx.message.text.split(' ')[1];

  if (db.balances[userId] === undefined) {
    db.balances[userId] = 0;
    if (startArgs && startArgs !== String(userId)) {
      db.referrals[userId] = startArgs;
    }
    saveDB();
  }

  ctx.replyWithMarkdown(
    `👋 *Welcome to the Premier Investment Platform!*\n\nYour portfolio dashboard is active. Tap any option below:`,
    mainMenu
  );
});

bot.action('btn_main', (ctx) => {
  ctx.answerCbQuery();
  ctx.replyWithMarkdown(`📱 *Main Menu:*`, mainMenu);
});

bot.action('btn_wallet', (ctx) => {
  const userId = ctx.from.id;
  ctx.answerCbQuery();
  ctx.replyWithMarkdown(`💳 *Your Financial Profile*\n\n💵 *Available Balance:* ₦${getBalance(userId).toLocaleString()}\n👤 *Account ID:* \`${userId}\``, mainMenu);
});

bot.action('btn_invest', (ctx) => {
  ctx.answerCbQuery();
  ctx.replyWithMarkdown(`🚀 *Select an Investment Package:*`, investmentPlans);
});

// --- PACKAGE HANDLERS ---
// 1. ₦200 for 1 Day
bot.action('plan_200', (ctx) => {
  const userId = ctx.from.id;
  const cost = 200;
  const dailyYield = 200; // Returns ₦200 profit in 1 day
  ctx.answerCbQuery();

  if (getBalance(userId) < cost) {
    return ctx.replyWithMarkdown(`⚠️ *Insufficient Balance!* You need ₦${cost.toLocaleString()} to activate this plan. Deposit funds first.`, mainMenu);
  }

  addBalance(userId, -cost);
  if (!db.investments[userId]) db.investments[userId] = [];
  db.investments[userId].push({ planName: 'Quick Plan (₦200)', dailyYield, daysLeft: 1, lastPayout: Date.now() });

  logHistory(userId, `Activated Quick Plan for ₦${cost}`);
  ctx.replyWithMarkdown(`🎉 *Success!* Activated ₦200 Quick Plan (1-day duration).`, mainMenu);
});

// 2. ₦500 for ₦1,500 Total in 3 Days (₦500/day yield)
bot.action('plan_500', (ctx) => {
  const userId = ctx.from.id;
  const cost = 500;
  const dailyYield = 500; // ₦500/day for 3 days = ₦1,500 total return
  ctx.answerCbQuery();

  if (getBalance(userId) < cost) {
    return ctx.replyWithMarkdown(`⚠️ *Insufficient Balance!* You need ₦${cost.toLocaleString()} to activate this plan. Deposit funds first.`, mainMenu);
  }

  addBalance(userId, -cost);
  if (!db.investments[userId]) db.investments[userId] = [];
  db.investments[userId].push({ planName: 'Growth Plan (₦500)', dailyYield, daysLeft: 3, lastPayout: Date.now() });

  logHistory(userId, `Activated Growth Plan for ₦${cost}`);
  ctx.replyWithMarkdown(`🎉 *Success!* Activated ₦500 Growth Plan (₦500 daily for 3 days).`, mainMenu);
});

// 3. ₦1,000 Starter Plan
bot.action('plan_1000', (ctx) => {
  const userId = ctx.from.id;
  const cost = 1000;
  const dailyYield = 50; // 5% of 1,000
  ctx.answerCbQuery();

  if (getBalance(userId) < cost) {
    return ctx.replyWithMarkdown(`⚠️ *Insufficient Balance!* You need ₦${cost.toLocaleString()} to activate this plan.`, mainMenu);
  }

  addBalance(userId, -cost);
  if (!db.investments[userId]) db.investments[userId] = [];
  db.investments[userId].push({ planName: 'Starter Plan (₦1,000)', dailyYield, daysLeft: 7, lastPayout: Date.now() });

  logHistory(userId, `Activated Starter Plan for ₦${cost}`);
  ctx.replyWithMarkdown(`🎉 *Success!* Activated Starter Plan (₦1,000). You will earn ₦${dailyYield}/day for 7 days.`, mainMenu);
});

// 4. ₦5,000 VIP Plan
bot.action('plan_vip', (ctx) => {
  const userId = ctx.from.id;
  const cost = 5000;
  const dailyYield = 500; // 10% of 5,000
  ctx.answerCbQuery();

  if (getBalance(userId) < cost) {
    return ctx.replyWithMarkdown(`⚠️ *Insufficient Balance!* You need ₦${cost.toLocaleString()} to activate this plan.`, mainMenu);
  }

  addBalance(userId, -cost);
  if (!db.investments[userId]) db.investments[userId] = [];
  db.investments[userId].push({ planName: 'VIP Plan (₦5,000)', dailyYield, daysLeft: 30, lastPayout: Date.now() });

  logHistory(userId, `Activated VIP Plan for ₦${cost}`);
  ctx.replyWithMarkdown(`🎉 *Success!* Activated VIP Plan (₦5,000). You will earn ₦${dailyYield}/day for 30 days.`, mainMenu);
});

// Gateways & Referral
bot.action('btn_deposit', (ctx) => {
  ctx.answerCbQuery();
  ctx.replyWithMarkdown(`📥 *Deposit Gateway*\n\nTo fund your account, please send payments via bank transfer or local deposit channels, then send receipt proof to support.`, mainMenu);
});

bot.action('btn_withdraw', (ctx) => {
  const userId = ctx.from.id;
  const balance = getBalance(userId);
  ctx.answerCbQuery();

  if (balance < 500) {
    return ctx.replyWithMarkdown(`⚠️ *Minimum withdrawal limit is ₦500.* Your current balance is ₦${balance.toLocaleString()}.`, mainMenu);
  }
  ctx.replyWithMarkdown(`📤 *Withdrawal Portal*\n\nPlease reply with your account details (Bank Name, Account Number, Account Name) to process your payout request.`, mainMenu);
});

bot.action('btn_ref', (ctx) => {
  const refLink = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
  ctx.answerCbQuery();
  ctx.replyWithMarkdown(`👥 *Referral System*\n\nShare your link to invite users and earn instant referral rewards!\n\n🔗 *Your Referral Link:*\n\`${refLink}\``, mainMenu);
});

bot.action('btn_plans', (ctx) => {
  const activePlans = db.investments[ctx.from.id] || [];
  ctx.answerCbQuery();

  if (activePlans.length === 0) {
    return ctx.replyWithMarkdown(`📈 *No Active Investments*\n\nYou currently have 0 active plans producing yields.`, mainMenu);
  }

  let summary = `📈 *Your Active Investment Plans:*\n\n`;
  activePlans.forEach((plan, i) => {
    summary += `${i + 1}. *${plan.planName}* | ₦${plan.dailyYield}/day | ${plan.daysLeft} days remaining\n`;
  });
  ctx.replyWithMarkdown(summary, mainMenu);
});

bot.command('calculate', (ctx) => {
  const args = ctx.message.text.split(' ');
  const amount = parseFloat(args[1]);
  const days = parseInt(args[2]);

  if (isNaN(amount) || isNaN(days)) {
    return ctx.replyWithMarkdown("⚠️ *Usage:* Send `/calculate <amount> <days>`\n*Example:* `/calculate 1000 7`");
  }

  const dailyRate = 0.05;
  const totalProfit = amount * dailyRate * days;
  const totalPayout = amount + totalProfit;

  ctx.replyWithMarkdown(`📊 *Investment ROI Calculator*\n\n💵 *Initial Capital:* ₦${amount.toLocaleString()}\n⏱ *Duration:* ${days} day(s)\n📈 *Daily Rate:* ${dailyRate * 100}%\n\n🎉 *Projected Earnings:* ₦${totalProfit.toLocaleString()}\n💰 *Total Return:* ₦${totalPayout.toLocaleString()}`, mainMenu);
});

bot.action('btn_calc_info', (ctx) => {
  ctx.answerCbQuery();
  ctx.replyWithMarkdown("📊 *ROI Calculator Guide*\n\nSend: `/calculate <amount> <days>`\nExample: `/calculate 1000 7` to test earnings!");
});

// --- ADMIN COMMANDS ---
bot.command('admin', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const totalUsers = Object.keys(db.balances).length;
  ctx.replyWithMarkdown(`🛠 *Admin Control Panel*\n\n👤 *Admin ID:* \`${ADMIN_ID}\`\n👥 *Registered Users:* ${totalUsers}\n📢 Send \`/broadcast <your message>\` to notify everyone.`);
});

bot.command('broadcast', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const message = ctx.message.text.replace('/broadcast ', '');
  if (!message) return ctx.reply("Usage: /broadcast <your message>");

  const users = Object.keys(db.balances);
  users.forEach((userId) => {
    bot.telegram.sendMessage(userId, `📢 *Announcement:*\n\n${message}`, { parse_mode: 'Markdown' }).catch(() => {});
  });
  ctx.reply(`✅ Broadcast transmitted to ${users.length} users.`);
});

// --- AUTOMATED DAILY YIELD ENGINE ---
setInterval(() => {
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const userId in db.investments) {
    const plans = db.investments[userId];
    if (!plans || plans.length === 0) continue;

    db.investments[userId] = plans.filter((plan) => {
      if (now - plan.lastPayout >= DAY_MS && plan.daysLeft > 0) {
        addBalance(userId, plan.dailyYield);
        plan.daysLeft -= 1;
        plan.lastPayout = now;

        logHistory(userId, `Daily profit credited: +₦${plan.dailyYield}`);
        bot.telegram.sendMessage(userId, `💵 *Daily Payout Credited!* You received +₦${plan.dailyYield} from your ${plan.planName}.`, { parse_mode: 'Markdown' }).catch(() => {});
      }
      return plan.daysLeft > 0;
    });
  }
  saveDB();
}, 60 * 1000);

// --- LAUNCH ENGINE ---
bot.launch().then(() => console.log("Naira Investment Bot Engine Online!"));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

