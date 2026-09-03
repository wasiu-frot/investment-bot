const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');

const BOT_TOKEN = '8661124178:AAF7fHANTSWMbqm9O_LR9VnXGKgN7AdcK6E';
const ADMIN_ID = 7829040420;
const DB_FILE = './database.json';

// Keep-alive web server
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Investment Bot Active'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Database setup
let db = { balances: {}, investments: {}, pending: {}, withdrawals: {}, referredBy: {}, users: [], history: {} };
if (fs.existsSync(DB_FILE)) {
  try { 
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); 
  } catch (e) { 
    console.error('DB Load Error'); 
  }
}

// Ensure DB arrays/objects exist
if (!Array.isArray(db.users)) db.users = [];
if (!db.balances) db.balances = {};
if (!db.investments) db.investments = {};
if (!db.pending) db.pending = {};
if (!db.withdrawals) db.withdrawals = {};
if (!db.referredBy) db.referredBy = {};
if (!db.history) db.history = {};

const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

// Initialize Telegraf with network timeout handling
const bot = new Telegraf(BOT_TOKEN, {
  telegram: { timeout: 30000 }
});

const userState = {};
const getBalance = (userId) => db.balances[userId] || 0;

// Log transactions
const logHistory = (userId, text) => {
  if (!db.history[userId]) db.history[userId] = [];
  db.history[userId].unshift(`[${new Date().toLocaleTimeString()}] ${text}`);
  if (db.history[userId].length > 10) db.history[userId].pop(); // Keep last 10 entries
};

// Global error handler
bot.catch((err, ctx) => console.error(`Bot Error: ${err.message}`));
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err.message));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

// Main Menu Navigation
const mainMenu = Markup.keyboard([
  ['📈 Investment Plans', '📥 Deposit'],
  ['📤 Withdraw', '👤 My Account'],
  ['👥 Referral Link', '📜 History'],
  ['❓ Help & FAQ']
]).resize();

// Command: /start
bot.start((ctx) => {
  const userId = ctx.from.id;
  const startPayload = ctx.message.text.split(' ')[1];

  if (!db.users.includes(userId)) db.users.push(userId);
  if (!(userId in db.balances)) db.balances[userId] = 0;
  if (!(userId in db.investments)) db.investments[userId] = [];

  if (startPayload && startPayload !== String(userId) && !db.referredBy[userId]) {
    db.referredBy[userId] = parseInt(startPayload, 10);
  }

  saveDB();
  ctx.reply(`Welcome, ${ctx.from.first_name}! Choose an option below to get started:`, mainMenu);
});

// Profile Overview with Real-Time Timers
bot.hears('👤 My Account', (ctx) => {
  const userId = ctx.from.id;
  const balance = getBalance(userId);
  const activePlans = db.investments[userId] || [];
  const now = Date.now();

  let planSummary = 'No active investment plans.';
  if (activePlans.length > 0) {
    planSummary = activePlans.map((p, i) => {
      const nextPayoutMs = p.lastPayout + 86400000 - now;
      const hoursLeft = Math.max(0, Math.floor(nextPayoutMs / (1000 * 60 * 60)));
      const minsLeft = Math.max(0, Math.floor((nextPayoutMs % (1000 * 60 * 60)) / (1000 * 60)));
      
      return `${i + 1}. **${p.plan}**\n   💵 Invested: ₦${p.amount}\n   ⏱️ Days Left: ${p.daysLeft}\n   ⏳ Next Yield: in ${hoursLeft}h ${minsLeft}m`;
    }).join('\n\n');
  }

  ctx.replyWithMarkdown(
    `👤 **YOUR ACCOUNT PROFILE**\n\n` +
    `🆔 **User ID:** \`${userId}\`\n` +
    `💰 **Wallet Balance:** ₦${balance}\n\n` +
    `📊 **Active Plans & Timers:**\n${planSummary}`
  );
});

// History Log
bot.hears('📜 History', (ctx) => {
  const userId = ctx.from.id;
  const history = db.history[userId] || [];
  const text = history.length === 0 ? 'No recent transactions.' : history.join('\n');
  ctx.reply(`📜 RECENT TRANSACTIONS:\n\n${text}`);
});

// Referral System
bot.hears('👥 Referral Link', (ctx) => {
  const userId = ctx.from.id;
  const botUsername = ctx.botInfo.username;
  const refLink = `https://t.me/${botUsername}?start=${userId}`;

  ctx.reply(`👥 REFERRAL PROGRAM\n\nEarn 10% bonus on every deposit made by your invitees!\n\n🔗 Your Link:\n${refLink}`);
});

// Plans Display
bot.hears('📈 Investment Plans', (ctx) => {
  const planKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🌱 Promo Plan (Pay ₦200 ➔ Get ₦500)', 'plan_starter')],
    [Markup.button.callback('🚀 Pro Plan (Pay ₦5,000 ➔ Get ₦9,000)', 'plan_pro')],
    [Markup.button.callback('💎 VIP Plan (Pay ₦20,000 ➔ Get ₦44,000)', 'plan_vip')]
  ]);
  ctx.reply('📊 Select an investment plan to view yield details:', planKeyboard);
});

bot.action(/plan_(starter|pro|vip)/, (ctx) => {
  const plan = ctx.match[1];
  let details = '';

  if (plan === 'starter') details = `🌱 PROMO PLAN\n\n💵 Deposit: ₦200\n📈 Return: ₦500\n⏱️ Duration: 24 Hours`;
  if (plan === 'pro') details = `🚀 PRO PLAN\n\n💵 Deposit: ₦5,000\n📈 Return: ₦9,000\n⏱️ Duration: 10 Days (₦900 Daily)`;
  if (plan === 'vip') details = `💎 VIP PLAN\n\n💵 Deposit: ₦20,000\n📈 Return: ₦44,000\n⏱️ Duration: 14 Days (₦3,142 Daily)`;

  ctx.reply(`${details}\n\nActivate this plan with your account balance?`, Markup.inlineKeyboard([
    [Markup.button.callback('Activate Plan ✅', `buy_${plan}`)]
  ]));
});

bot.action(/buy_(starter|pro|vip)/, (ctx) => {
  const userId = ctx.from.id;
  const plan = ctx.match[1];

  let cost = plan === 'starter' ? 200 : plan === 'pro' ? 5000 : 20000;
  let expectedReturn = plan === 'starter' ? 500 : plan === 'pro' ? 9000 : 44000;

  if (getBalance(userId) < cost) {
    return ctx.reply(`❌ Insufficient funds! You need ₦${cost}. Tap "📥 Deposit" to fund your wallet.`);
  }

  db.balances[userId] -= cost;
  if (!db.investments[userId]) db.investments[userId] = [];

  db.investments[userId].push({
    plan: plan.toUpperCase(),
    amount: cost,
    expectedReturn: expectedReturn,
    daysLeft: plan === 'starter' ? 1 : plan === 'pro' ? 10 : 14,
    dailyYield: plan === 'starter' ? 500 : plan === 'pro' ? 900 : 3142,
    lastPayout: Date.now()
  });

  logHistory(userId, `Activated ${plan.toUpperCase()} plan (-₦${cost})`);
  saveDB();

  ctx.reply(`🎉 Plan Activated!\n\nPlan: ${plan.toUpperCase()}\nInvested: ₦${cost}\nExpected Return: ₦${expectedReturn}\nRemaining Balance: ₦${db.balances[userId]}`);
});

// Deposit Interface
bot.hears('📥 Deposit', (ctx) => {
  userState[ctx.from.id] = 'AWAITING_PROOF';
  ctx.reply(
    `🏦 BANK DEPOSIT DETAILS\n\n` +
    `Bank Name: OPay\n` +
    `Account Number: 8088189547\n` +
    `Account Name: Muhammad rekiyatu\n\n` +
    `📌 Minimum Deposit: ₦200\n\n` +
    `Reply with your Name, Amount Paid, and attach your Payment Receipt:`
  );
});

// Withdrawal Interface
bot.hears('📤 Withdraw', (ctx) => {
  const userId = ctx.from.id;
  const balance = getBalance(userId);

  if (balance < 200) {
    return ctx.reply(`❌ Minimum withdrawal is ₦200. Your wallet balance is ₦${balance}.`);
  }

  userState[userId] = 'AWAITING_WITHDRAWAL_DETAILS';
  ctx.reply(
    `📤 WITHDRAWAL REQUEST\n\n` +
    `💰 Wallet Balance: ₦${balance}\n\n` +
    `Reply with your withdrawal request in this exact format:\n\n` +
    `Amount\nBank Name\nAccount Number\nAccount Name\n\n` +
    `Example:\n5000\nOPay\n8088189547\nOluwase`
  );
});

// Input Listener
bot.on(['photo', 'text'], async (ctx, next) => {
  const userId = ctx.from.id;
  const state = userState[userId];

  if (state === 'AWAITING_PROOF') {
    delete userState[userId];
    const txId = 'TX' + Math.floor(100000 + Math.random() * 900000);
    db.pending[txId] = { userId, status: 'PENDING' };
    saveDB();

    await ctx.reply(`⏳ Deposit request submitted! ID: #${txId}`, mainMenu);

    const adminKeyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('Accept ✅', `approve_${txId}_${userId}`),
        Markup.button.callback('Decline 🚫', `decline_${txId}_${userId}`)
      ]
    ]);

    const alertText = `🚨 NEW DEPOSIT PROOF!\n\nTx ID: #${txId}\nUser ID: ${userId}\nDetails: ${ctx.message.text || ctx.message.caption || 'Receipt Attached'}`;

    if (ctx.message.photo) {
      const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      await ctx.telegram.sendPhoto(ADMIN_ID, fileId, { caption: alertText, ...adminKeyboard }).catch(() => {});
    } else {
      await ctx.telegram.sendMessage(ADMIN_ID, alertText, adminKeyboard).catch(() => {});
    }
    return;
  }

  if (state === 'AWAITING_WITHDRAWAL_DETAILS') {
    delete userState[userId];
    const text = ctx.message.text || '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const requestedAmount = parseFloat(lines[0]);
    const currentBalance = getBalance(userId);

    if (isNaN(requestedAmount) || requestedAmount < 200) {
      return ctx.reply('❌ Invalid amount! Minimum withdrawal is ₦200.');
    }

    if (requestedAmount > currentBalance) {
      return ctx.reply(`❌ Insufficient funds! You requested ₦${requestedAmount}, but your balance is ₦${currentBalance}.`);
    }

    const wId = 'WD' + Math.floor(100000 + Math.random() * 900000);
    const bankDetails = lines.slice(1).join('\n') || text;

    db.withdrawals[wId] = { userId, amount: requestedAmount, details: bankDetails, status: 'PENDING' };
    saveDB();

    ctx.reply(`⏳ Withdrawal submitted!\n\nID: #${wId}\nAmount: ₦${requestedAmount}`, mainMenu);

    const withdrawKeyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('Approve Withdrawal ✅', `wd_approve_${wId}_${userId}`),
        Markup.button.callback('Decline 🚫', `wd_decline_${wId}_${userId}`)
      ]
    ]);

    await ctx.telegram.sendMessage(
      ADMIN_ID,
      `🚨 NEW WITHDRAWAL REQUEST!\n\nWD ID: #${wId}\nUser ID: ${userId}\nAmount: ₦${requestedAmount}\nBank Info:\n${bankDetails}`,
      withdrawKeyboard
    );
    return;
  }

  return next();
});

// Admin Actions
bot.action(/approve_(TX\d+)_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery('Approved!').catch(() => {});
  const txId = ctx.match[1];
  const targetUserId = ctx.match[2];

  if (!db.pending[txId] || db.pending[txId].status !== 'PENDING') return ctx.reply('⚠️ Processed already.');

  db.pending[txId].status = 'APPROVED';
  saveDB();

  await ctx.reply(`✅ Deposit #${txId} Approved!\n\nSend command to credit:\n/credit ${targetUserId} 200`);
});

bot.action(/decline_(TX\d+)_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery('Declined').catch(() => {});
  const txId = ctx.match[1];
  const targetUserId = ctx.match[2];

  if (!db.pending[txId] || db.pending[txId].status !== 'PENDING') return ctx.reply('⚠️ Processed already.');

  db.pending[txId].status = 'DECLINED';
  saveDB();

  await ctx.reply(`❌ Deposit #${txId} declined.`);
  await bot.telegram.sendMessage(targetUserId, `❌ Your deposit request (#${txId}) was declined.`).catch(() => {});
});

bot.action(/wd_approve_(WD\d+)_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery('Approved!').catch(() => {});
  const wId = ctx.match[1];
  const targetUserId = ctx.match[2];

  const req = db.withdrawals[wId];
  if (!req || req.status !== 'PENDING') return ctx.reply('⚠️ Processed already.');

  const amountToDeduct = req.amount;
  db.balances[targetUserId] = Math.max(0, getBalance(targetUserId) - amountToDeduct);
  req.status = 'APPROVED';
  logHistory(targetUserId, `Withdrawal of ₦${amountToDeduct} approved`);
  saveDB();

  await ctx.reply(`✅ Withdrawal #${wId} approved and ₦${amountToDeduct} deducted.`);
  await bot.telegram.sendMessage(targetUserId, `🎉 Your withdrawal of ₦${amountToDeduct} has been sent!`).catch(() => {});
});

bot.action(/wd_decline_(WD\d+)_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery('Declined').catch(() => {});
  const wId = ctx.match[1];
  const targetUserId = ctx.match[2];

  if (!db.withdrawals[wId] || db.withdrawals[wId].status !== 'PENDING') return ctx.reply('⚠️ Processed already.');

  db.withdrawals[wId].status = 'DECLINED';
  saveDB();

  await ctx.reply(`❌ Withdrawal #${wId} declined.`);
  await bot.telegram.sendMessage(targetUserId, `❌ Your withdrawal request (#${wId}) was declined.`).catch(() => {});
});

// Admin Command: /credit
bot.command('credit', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const args = ctx.message.text.split(' ');
  if (args.length < 3) return ctx.reply('Usage: /credit <userId> <amount>');

  const targetUserId = args[1];
  const amount = parseFloat(args[2]);
  if (isNaN(amount) || amount <= 0) return ctx.reply('Invalid amount');

  db.balances[targetUserId] = getBalance(targetUserId) + amount;
  logHistory(targetUserId, `Wallet credited with ₦${amount}`);

  const referrerId = db.referredBy[targetUserId];
  if (referrerId) {
    const bonus = amount * 0.10;
    db.balances[referrerId] = getBalance(referrerId) + bonus;
    logHistory(referrerId, `Earned ₦${bonus} referral bonus from user ${targetUserId}`);
    bot.telegram.sendMessage(referrerId, `🎉 You earned a 10% referral bonus of ₦${bonus}!`).catch(() => {});
  }

  saveDB();

  ctx.reply(`✅ Credited ₦${amount} to User ${targetUserId}. New balance: ₦${db.balances[targetUserId]}`);
  bot.telegram.sendMessage(targetUserId, `🎉 Deposit of ₦${amount} verified! Balance: ₦${db.balances[targetUserId]}`).catch(() => {});
});

// Admin Command: /broadcast
bot.command('broadcast', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const message = ctx.message.text.replace('/broadcast', '').trim();
  if (!message) return ctx.reply('Usage: /broadcast <message>');

  let successCount = 0;
  for (const uid of db.users) {
    try {
      await bot.telegram.sendMessage(uid, `📢 ANNOUNCEMENT:\n\n${message}`);
      successCount++;
    } catch (e) {}
  }
  ctx.reply(`✅ Broadcast sent to ${successCount} users.`);
});

// FAQ & Help
bot.hears('❓ Help & FAQ', (ctx) => {
  ctx.reply('📌 How it works:\n1. Tap 📥 Deposit & transfer funds.\n2. Tap 📈 Investment Plans to earn yields.\n3. Tap 📤 Withdraw to payout your funds at any time!');
});

// High-Precision Automated Engine (Checks every 60 seconds)
setInterval(() => {
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const userId in db.investments) {
    const activePlans = db.investments[userId];
    if (!activePlans || activePlans.length === 0) continue;

    db.investments[userId] = activePlans.filter((plan) => {
      // Check if 24 hours have passed since last payout
      if (now - plan.lastPayout >= DAY_MS && plan.daysLeft > 0) {
        db.balances[userId] = getBalance(userId) + plan.dailyYield;
        plan.daysLeft -= 1;
        plan.lastPayout = now; // Reset daily timer

        logHistory(userId, `Daily profit +₦${plan.dailyYield} from ${plan.plan}`);
        bot.telegram.sendMessage(userId, `💵 Daily profit of ₦${plan.dailyYield} added from your ${plan.plan} Plan!`).catch(() => {});
      }
      return plan.daysLeft > 0;
    });
  }
  saveDB();
}, 60 * 1000);

bot.launch().then(() => console.log('All-in-one bot online!'));

