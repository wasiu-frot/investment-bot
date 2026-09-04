const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

// IMPORTANT: Replace this with your actual Telegram User ID to access /admin commands
const ADMIN_ID = 123456789; 

// Initialize Telegraf Bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// --- DATABASE CONTROLLER ---
const DB_FILE = './database.json';

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

// Helper Functions
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

// --- INTERACTIVE NAVIGATION MENUS ---
const mainMenu = Markup.inlineKeyboard([
  [Markup.button.callback('💰 My Wallet', 'btn_wallet'), Markup.button.callback('📈 Active Plans', 'btn_plans')],
  [Markup.button.callback('🚀 Invest Now', 'btn_invest'), Markup.button.callback('📥 Deposit', 'btn_deposit')],
  [Markup.button.callback('📤 Withdraw', 'btn_withdraw'), Markup.button.callback('👥 Referral Program', 'btn_ref')],
  [Markup.button.callback('📊 ROI Calculator', 'btn_calc_info')]
]);

const investmentPlans = Markup.inlineKeyboard([
  [Markup.button.callback('🔹 Starter ($50 - 5%/day - 7 days)', 'plan_starter')],
  [Markup.button.callback('🔹 Pro ($200 - 7%/day - 14 days)', 'plan_pro')],
  [Markup.button.callback('🔹 VIP ($1000 - 10%/day - 30 days)', 'plan_vip')],
  [Markup.button.callback('🔙 Back to Main Menu', 'btn_main')]
]);

// --- BOT LOGIC & COMMANDS ---

// Start Command with Referral Handler
bot.start((ctx) => {
  const userId = ctx.from.id;
  const startArgs = ctx.message.text.split(' ')[1];

  if (db.balances[userId] === undefined) {
    db.balances[userId] = 0;
    if (startArgs && startArgs !== String(userId)) {
      db.referrals[userId] = startArgs; // Store referrer ID
    }
    saveDB();
  }

  ctx.replyWithMarkdown(
    `👋 *Welcome to the Premier Investment Platform!*\n\nYour automated portfolio is active. Use the interactive menu below to manage funds, invest, or check yields:`,
    mainMenu
  );
});

// Back to Main Menu Action
bot.action('btn_main', (ctx) => {
  ctx.answerCbQuery();
  ctx.replyWithMarkdown(`📱 *Main Menu:*`, mainMenu);
});

// Wallet Summary
bot.action('btn_wallet', (ctx) => {
  const userId = ctx.from.id;
  const balance = getBalance(userId);
  ctx.answerCbQuery();
  ctx.replyWithMarkdown(
    `💳 *Your Financial Profile*\n\n💵 *Available Balance:* $${balance.toFixed(2)}\n👤 *Account ID:* \`${userId}\``,
    mainMenu
  );
});

// Investment Packages Selector
bot.action('btn_invest', (ctx) => {
  ctx.answerCbQuery();
  ctx.replyWithMarkdown(`🚀 *Select an Investment Package:*`, investmentPlans);
});

// Handling Package Purchase (Starter Example)
bot.action('plan_starter', (ctx) => {
  const userId = ctx.from.id;
  const cost = 50;
  const dailyYield = 2.5; // 5% of $50
  const duration = 7;

  ctx.answerCbQuery();

  if (getBalance(userId) < cost) {
    return ctx.replyWithMarkdown(`⚠️ *Insufficient Balance!* You need $${cost} to start this plan. Deposit funds first.`, mainMenu);
  }

  // Deduct balance and register investment
  addBalance(userId, -cost);
  if (!db.investments[userId]) db.investments[userId] = [];
  
  db.investments[userId].push({
    planName: 'Starter',
    dailyYield: dailyYield,
    daysLeft: duration,
    lastPayout: Date.now()
  });
  
  logHistory(userId, `Purchased Starter Plan for $${cost}`);
  ctx.replyWithMarkdown(`🎉 *Success!* You activated the *Starter Plan*. You will earn $${dailyYield}/day for ${duration} days.`, mainMenu);
});

// Deposit Gateway Information
bot.action('btn_deposit', (ctx) => {
  ctx.answerCbQuery();
  ctx.replyWithMarkdown(
    `📥 *Deposit Payment Gateway*\n\nTransfer your investment amount to our official USDT (TRC-20) address:\n\n\`TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t\`\n\n*Note:* After completing transfer, forward your payment receipt hash to support.`,
    mainMenu
  );
});

// Withdrawal Gateway
bot.action('btn_withdraw', (ctx) => {
  const userId = ctx.from.id;
  const balance = getBalance(userId);
  ctx.answerCbQuery();

  if (balance < 10) {
    return ctx.replyWithMarkdown(`⚠️ *Minimum withdrawal threshold is $10.00.* Current balance: $${balance.toFixed(2)}`, mainMenu);
  }
  ctx.replyWithMarkdown(`📤 *Withdrawal Portal*\n\nPlease reply with your USDT TRC-20 wallet address to queue your payout request.`, mainMenu);
});

// Referral Hub
bot.action('btn_ref', (ctx) => {
  const userId = ctx.from.id;
  const refLink = `https://t.me/${ctx.botInfo.username}?start=${userId}`;
  ctx.answerCbQuery();
  ctx.replyWithMarkdown(
    `👥 *Affiliate & Referral System*\n\nInvite investors and receive a 5% instant bonus on their package purchases!\n\n🔗 *Your Referral Link:*\n\`${refLink}\``,
    mainMenu
  );
});

// ROI Calculator Command
bot.command('calculate', (ctx) => {
  const args = ctx.message.text.split(' ');
  const amount = parseFloat(args[1]);
  const days = parseInt(args[2]);

  if (isNaN(amount) || isNaN(days)) {
    return ctx.replyWithMarkdown("⚠️ *Usage:* Send `/calculate <amount> <days>`\n*Example:* `/calculate 100 7`");
  }

  const dailyRate = 0.05;
  const totalProfit = amount * dailyRate * days;
  const totalPayout = amount + totalProfit;

  const response = `
📊 *Investment ROI Calculator*

💵 *Initial Capital:* $${amount.toFixed(2)}
⏱ *Duration:* ${days} day(s)
📈 *Daily Yield:* ${dailyRate * 100}%

🎉 *Projected Earnings:* $${totalProfit.toFixed(2)}
💰 *Total Return:* $${totalPayout.toFixed(2)}
  `;

  ctx.replyWithMarkdown(response, mainMenu);
});

bot.action('btn_calc_info', (ctx) => {
  ctx.answerCbQuery();
  ctx.replyWithMarkdown("📊 *ROI Calculator Guide*\n\nType `/calculate <amount> <days>` directly in chat to calculate projected yields!");
});

// Active Investments Dashboard
bot.action('btn_plans', (ctx) => {
  const userId = ctx.from.id;
  const activePlans = db.investments[userId] || [];
  ctx.answerCbQuery();

  if (activePlans.length === 0) {
    return ctx.replyWithMarkdown(`📈 *No Active Investments*\n\nYou currently have 0 active plans producing yields.`, mainMenu);
  }

  let summary = `📈 *Your Active Investment Plans:*\n\n`;
  activePlans.forEach((plan, index) => {
    summary += `${index + 1}. *${plan.planName}* | $${plan.dailyYield}/day | Days Remaining: ${plan.daysLeft}\n`;
  });
  ctx.replyWithMarkdown(summary, mainMenu);
});

// --- ADMIN COMMAND SYSTEM ---
bot.command('admin', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const totalUsers = Object.keys(db.balances).length;
  ctx.replyWithMarkdown(`🛠 *Admin Control Panel*\n\n👥 *Registered Users:* ${totalUsers}\n📢 Send \`/broadcast <text>\` to alert all users.`);
});

bot.command('broadcast', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const message = ctx.message.text.replace('/broadcast ', '');
  if (!message) return ctx.reply("Usage: /broadcast <your message>");

  const users = Object.keys(db.balances);
  users.forEach((userId) => {
    bot.telegram.sendMessage(userId, `📢 *Official Announcement:*\n\n${message}`, { parse_mode: 'Markdown' }).catch(() => {});
  });
  ctx.reply(`✅ Broadcast transmitted to ${users.length} users.`);
});

// --- AUTOMATED DAILY YIELD ENGINE ---
setInterval(() => {
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const userId in db.investments) {
    const activePlans = db.investments[userId];
    if (!activePlans || activePlans.length === 0) continue;

    db.investments[userId] = activePlans.filter((plan) => {
      if (now - plan.lastPayout >= DAY_MS && plan.daysLeft > 0) {
        addBalance(userId, plan.dailyYield);
        plan.daysLeft -= 1;
        plan.lastPayout = now;

        logHistory(userId, `Daily profit credited: +$${plan.dailyYield}`);
        bot.telegram.sendMessage(userId, `💵 *Daily Interest Credited!* You received +$${plan.dailyYield} from your ${plan.planName} plan.`, { parse_mode: 'Markdown' }).catch(() => {});
      }
      return plan.daysLeft > 0;
    });
  }
  saveDB();
}, 60 * 1000);

// --- LAUNCH ENGINE ---
bot.launch().then(() => console.log("Full-featured Investment Bot engine online!"));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

