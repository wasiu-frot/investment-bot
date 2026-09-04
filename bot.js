const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');

// ==========================================
// 1. CONFIGURATION & SETUP
// ==========================================
const BOT_TOKEN = process.env.BOT_TOKEN || '8661124178:AAF7fHANTSWMbqm9O_LR9VnXGKgN7AdcK6E';
const bot = new Telegraf(BOT_TOKEN);

const app = express();
const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
const SECRET_PATH = `/telegraf/${bot.secretToken || 'secret_webhook_path'}`;

// ADMIN SETTINGS
const ADMIN_ID = 7829040420;

// BANK DETAILS FOR DEPOSITS
const BANK_DETAILS = {
  bankName: 'OPay',
  accountNumber: '8088189547',
  accountName: 'Muhammad Rekiyatu'
};

// DATABASE SETUP (JSON Storage)
const DB_FILE = './database.json';
let db = { users: {}, pendingDeposits: {}, pendingWithdrawals: [] };

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE));
    if (!db.pendingDeposits) db.pendingDeposits = {};
    if (!db.pendingWithdrawals) db.pendingWithdrawals = [];
  } catch (err) {
    console.error('Error reading database file:', err);
  }
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ==========================================
// 2. INVESTMENT TIERS DATA (3-Day Cycle)
// ==========================================
const PLANS = {
  plan_200: { name: 'Starter Plan', price: 200, dailyYield: 50, durationDays: 3 },
  plan_500: { name: 'Basic Plan', price: 500, dailyYield: 130, durationDays: 3 },
  plan_1000: { name: 'Silver Plan', price: 1000, dailyYield: 280, durationDays: 3 },
  plan_2000: { name: 'Gold Plan', price: 2000, dailyYield: 600, durationDays: 3 },
  plan_5000: { name: 'VIP Plan', price: 5000, dailyYield: 1600, durationDays: 3 },
  plan_10000: { name: 'Pro VIP Plan', price: 10000, dailyYield: 3500, durationDays: 3 }
};

// ==========================================
// 3. EXPRESS & WEBHOOK ROUTING
// ==========================================
app.use(express.json());

if (RENDER_URL) {
  bot.telegram.setWebhook(`${RENDER_URL}${SECRET_PATH}`);
  app.use(bot.webhookCallback(SECRET_PATH));
  console.log(`Webhook actively pointing to: ${RENDER_URL}${SECRET_PATH}`);
} else {
  bot.launch();
  console.log('Running locally with long-polling...');
}

app.get('/', (req, res) => {
  res.send('Naira Investment Bot Service is Active and Running!');
});

// ==========================================
// 4. AUTOMATED YIELD & TIMER ENGINE
// ==========================================
function processInvestmentsAndTimers() {
  const now = Date.now();
  let dbChanged = false;

  Object.keys(db.users).forEach((userId) => {
    const user = db.users[userId];
    if (!user.activeInvestments) user.activeInvestments = [];

    user.activeInvestments = user.activeInvestments.filter((inv) => {
      // Check if 24 hours (86,400,000 ms) passed since last payout
      const timeSinceLastPayout = now - inv.lastPayoutTime;
      const oneDayMs = 24 * 60 * 60 * 1000;

      if (timeSinceLastPayout >= oneDayMs && inv.daysPaid < inv.durationDays) {
        // Pay out 1 day yield
        user.balance += inv.dailyYield;
        inv.daysPaid += 1;
        inv.lastPayoutTime = now;
        dbChanged = true;

        // Notify User of Daily Yield
        bot.telegram.sendMessage(
          userId,
          `💸 *DAILY YIELD CREDITED!*\n\nYour *${inv.planName}* has generated *₦${inv.dailyYield}* for Day ${inv.daysPaid}/${inv.durationDays}.\n\nYour new wallet balance is *₦${user.balance}*.`,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }

      // Keep investment if not finished, discard if 3 days completed
      return inv.daysPaid < inv.durationDays;
    });
  });

  if (dbChanged) saveDB();
}

// Run the investment check every 1 minute
setInterval(processInvestmentsAndTimers, 60 * 1000);

// Helper function to calculate readable time left
function getFormattedTimeLeft(targetTimeMs) {
  const diffMs = targetTimeMs - Date.now();
  if (diffMs <= 0) return 'Processing payout...';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

// ==========================================
// 5. USER HELPER & MAIN MENU
// ==========================================
function registerUser(ctx) {
  const userId = ctx.from.id;
  if (!db.users[userId]) {
    db.users[userId] = {
      id: userId,
      username: ctx.from.username || 'NoUsername',
      balance: 0,
      totalInvested: 0,
      state: 'IDLE',
      lastBonusClaim: 0,
      activeInvestments: [],
      joinedAt: new Date().toISOString()
    };
    saveDB();
  }
}

function sendMainMenu(ctx, textOverride) {
  registerUser(ctx);
  const text = textOverride || `
👋 *Welcome to Smart Naira Platform!*

Fund your wallet, invest in high-yield daily plans, and track earnings with live timers.

💰 *Wallet Balance:* ₦${db.users[ctx.from.id].balance}

Select an action below:
  `;

  return ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
    [Markup.button.callback('💳 Deposit Funds', 'menu_deposit'), Markup.button.callback('📈 Invest Balance', 'menu_invest')],
    [Markup.button.callback('🏧 Withdraw Funds', 'menu_withdraw'), Markup.button.callback('⏱️ Active Timers', 'menu_timers')],
    [Markup.button.callback('📊 Dashboard', 'menu_dashboard'), Markup.button.callback('🎁 Daily Bonus', 'menu_bonus')],
    [Markup.button.callback('📞 Contact Support', 'menu_support')]
  ]));
}

bot.start((ctx) => {
  registerUser(ctx);
  db.users[ctx.from.id].state = 'IDLE';
  saveDB();
  sendMainMenu(ctx);
});

bot.action('menu_main', (ctx) => {
  registerUser(ctx);
  db.users[ctx.from.id].state = 'IDLE';
  saveDB();
  ctx.deleteMessage().catch(() => {});
  sendMainMenu(ctx);
});

// Dashboard Menu
bot.action('menu_dashboard', (ctx) => {
  registerUser(ctx);
  const user = db.users[ctx.from.id];
  const activeCount = user.activeInvestments ? user.activeInvestments.length : 0;

  const text = `
👤 *ACCOUNT DASHBOARD*

• *User ID:* \`${user.id}\`
• *Username:* @${user.username}
• *Withdrawable Balance:* ₦${user.balance}
• *Total Invested:* ₦${user.totalInvested}
• *Running Investments:* ${activeCount} active plan(s)
  `;

  ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
    [Markup.button.callback('⏱️ View Live Timers', 'menu_timers')],
    [Markup.button.callback('💳 Deposit Funds', 'menu_deposit'), Markup.button.callback('📈 Invest Balance', 'menu_invest')],
    [Markup.button.callback('⬅️ Main Menu', 'menu_main')]
  ]));
});

// Active Timers Menu
bot.action('menu_timers', (ctx) => {
  registerUser(ctx);
  const user = db.users[ctx.from.id];
  const active = user.activeInvestments || [];

  if (active.length === 0) {
    return ctx.reply('⏳ *No Active Investment Timers*\n\nYou currently do not have any active investment plans running. Tap "📈 Invest Balance" to start earning!', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('📈 Invest Now', 'menu_invest')]])
    });
  }

  let text = `⏱️ *YOUR ACTIVE INVESTMENT TIMERS*\n\n`;

  active.forEach((inv, index) => {
    const nextPayoutMs = inv.lastPayoutTime + (24 * 60 * 60 * 1000);
    const timeLeftStr = getFormattedTimeLeft(nextPayoutMs);

    text += `*${index + 1}. ${inv.planName}*\n`;
    text += `• Daily Profit: ₦${inv.dailyYield}\n`;
    text += `• Days Completed: Day ${inv.daysPaid} of ${inv.durationDays}\n`;
    text += `• Next Payout In: ⏳ *${timeLeftStr}*\n\n`;
  });

  ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Refresh Timers', 'menu_timers')],
    [Markup.button.callback('⬅️ Main Menu', 'menu_main')]
  ]));
});

// Daily Bonus Trigger
bot.action('menu_bonus', (ctx) => {
  registerUser(ctx);
  const user = db.users[ctx.from.id];
  const now = Date.now();
  const cooldown = 24 * 60 * 60 * 1000;

  if (user.lastBonusClaim && (now - user.lastBonusClaim < cooldown)) {
    const nextClaimMs = user.lastBonusClaim + cooldown;
    const timeLeft = getFormattedTimeLeft(nextClaimMs);
    return ctx.reply(`🎁 *Bonus Already Claimed!*\n\nYou can claim your next daily reward in *${timeLeft}*.`, { parse_mode: 'Markdown' });
  }

  const bonusAmount = Math.floor(Math.random() * 41) + 10; // ₦10 to ₦50
  user.balance += bonusAmount;
  user.lastBonusClaim = now;
  saveDB();

  ctx.reply(`🎉 *DAILY REWARD CLAIMED!*\n\nYou received a free daily bonus of *₦${bonusAmount}* added to your wallet balance!`, { parse_mode: 'Markdown' });
});

// Support Menu
bot.action('menu_support', (ctx) => {
  ctx.replyWithMarkdown(
    '💬 *Customer Support*\n\nNeed assistance with deposits or withdrawals? Contact admin directly:\n\n👉 @oluwasegraphicdesigner'
  );
});

// ==========================================
// 6. DEPOSIT FLOW (FUND WALLET BALANCE)
// ==========================================
bot.action('menu_deposit', (ctx) => {
  registerUser(ctx);
  db.users[ctx.from.id].state = 'AWAITING_DEPOSIT_RECEIPT';
  saveDB();

  const text = `
💳 *DEPOSIT / FUND WALLET*

Transfer your deposit amount (*₦200 Minimum - ₦10,000 Maximum*) to the account below:

📌 *Bank Name:* ${BANK_DETAILS.bankName}
📌 *Account Number:* \`${BANK_DETAILS.accountNumber}\`
📌 *Account Name:* ${BANK_DETAILS.accountName}

---
⚠️ *INSTRUCTIONS:*
1. Make your transfer (₦200 to ₦10,000).
2. Take a clear screenshot of your receipt.
3. **Send the screenshot directly to this chat right now!**
  `;

  ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
    [Markup.button.callback('❌ Cancel', 'menu_main')]
  ]));
});

// Handle Deposit Receipt Submission
bot.on('photo', async (ctx) => {
  registerUser(ctx);
  const userId = ctx.from.id;
  const user = db.users[userId];

  if (user.state !== 'AWAITING_DEPOSIT_RECEIPT') {
    return ctx.reply('⚠️ To make a deposit, please tap "💳 Deposit Funds" first.');
  }

  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const depositId = `DEP_${Date.now()}_${userId}`;

  db.pendingDeposits[depositId] = {
    id: depositId,
    userId: userId,
    username: user.username,
    date: new Date().toISOString()
  };

  user.state = 'IDLE';
  saveDB();

  ctx.reply('✅ *Receipt Received!*\n\nYour deposit screenshot has been sent to the admin for verification. Your wallet balance will update automatically upon approval.', { parse_mode: 'Markdown' });

  const caption = `
📥 *NEW DEPOSIT RECEIPT SUBMITTED*

• *User ID:* \`${userId}\`
• *Username:* @${user.username}
• *Deposit ID:* \`${depositId}\`

*Action Required:* Enter the deposit amount to credit after verifying the image.
  `;

  try {
    await bot.telegram.sendPhoto(ADMIN_ID, photo.file_id, {
      caption: caption,
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Approve Deposit', `approve_dep_${depositId}`),
          Markup.button.callback('❌ Decline', `decline_dep_${depositId}`)
        ]
      ])
    });
  } catch (err) {
    console.error('Failed to alert admin:', err);
  }
});

// Admin Approve Deposit Trigger
bot.action(/^approve_dep_(DEP_\d+_\d+)$/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Unauthorized');

  const depositId = ctx.match[1];
  const deposit = db.pendingDeposits[depositId];

  if (!deposit) return ctx.answerCbQuery('⚠️ Deposit request already processed.');

  ctx.reply(`Please reply with the exact amount to credit User \`${deposit.userId}\` using this command format:\n\n\`/credit ${deposit.userId} ${depositId} <amount>\``, { parse_mode: 'Markdown' });
  ctx.answerCbQuery('Action required: execute credit command.');
});

// Admin Credit Command
bot.command('credit', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const args = ctx.message.text.split(' ');
  if (args.length < 4) {
    return ctx.reply('Usage: /credit <userID> <depositID> <amount>');
  }

  const targetId = args[1];
  const depositId = args[2];
  const amount = parseFloat(args[3]);

  if (isNaN(amount) || amount < 200 || amount > 10000) {
    return ctx.reply('❌ Invalid amount. Must be between 200 and 10000 without symbols.');
  }

  if (db.users[targetId]) {
    db.users[targetId].balance += amount;
    delete db.pendingDeposits[depositId];
    saveDB();

    ctx.reply(`✅ Successfully credited ₦${amount} to User ${targetId}.`);

    bot.telegram.sendMessage(
      targetId,
      `🎉 *DEPOSIT APPROVED!*\n\nYour wallet balance has been credited with *₦${amount}*. You can now tap *📈 Invest Balance* to pick a daily yield plan!`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  } else {
    ctx.reply('❌ User not found in database.');
  }
});

// Admin Decline Deposit
bot.action(/^decline_dep_(DEP_\d+_\d+)$/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Unauthorized');

  const depositId = ctx.match[1];
  const deposit = db.pendingDeposits[depositId];

  if (!deposit) return ctx.answerCbQuery('⚠️ Already processed.');

  const targetId = deposit.userId;
  delete db.pendingDeposits[depositId];
  saveDB();

  ctx.editMessageCaption(`${ctx.callbackQuery.message.caption}\n\nSTATUS: ❌ *DECLINED*`).catch(() => {});

  bot.telegram.sendMessage(
    targetId,
    `❌ *DEPOSIT REJECTED*\n\nYour transfer receipt could not be verified. Please ensure the payment went through and contact support: @oluwasegraphicdesigner`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  ctx.answerCbQuery('Deposit declined.');
});

// ==========================================
// 7. INVEST FLOW (START 3-DAY TIMER PLAN)
// ==========================================
bot.action('menu_invest', (ctx) => {
  registerUser(ctx);
  const balance = db.users[ctx.from.id].balance;

  const text = `
📈 *INVESTMENT PACKAGES (3-Day Duration)*

Your Current Wallet Balance: *₦${balance}*

Select a plan to start your 3-day daily yield timer:
  `;

  ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
    [Markup.button.callback('Starter: ₦200 (₦50/day)', 'invest_plan_200'), Markup.button.callback('Basic: ₦500 (₦130/day)', 'invest_plan_500')],
    [Markup.button.callback('Silver: ₦1,000 (₦280/day)', 'invest_plan_1000'), Markup.button.callback('Gold: ₦2,000 (₦600/day)', 'invest_plan_2000')],
    [Markup.button.callback('VIP: ₦5,000 (₦1,600/day)', 'invest_plan_5000'), Markup.button.callback('Pro VIP: ₦10,000 (₦3,500/day)', 'invest_plan_10000')],
    [Markup.button.callback('⬅️ Main Menu', 'menu_main')]
  ]));
});

// Process Investment Selection
Object.keys(PLANS).forEach((planKey) => {
  bot.action(`invest_${planKey}`, (ctx) => {
    registerUser(ctx);
    const userId = ctx.from.id;
    const user = db.users[userId];
    const plan = PLANS[planKey];

    if (user.balance < plan.price) {
      return ctx.answerCbQuery(`❌ Insufficient balance! You need ₦${plan.price}, but your balance is ₦${user.balance}. Please deposit first.`, { show_alert: true });
    }

    if (!user.activeInvestments) user.activeInvestments = [];

    // Deduct balance & create active investment record
    user.balance -= plan.price;
    user.totalInvested += plan.price;

    const now = Date.now();
    user.activeInvestments.push({
      planKey: planKey,
      planName: plan.name,
      price: plan.price,
      dailyYield: plan.dailyYield,
      durationDays: plan.durationDays,
      daysPaid: 0,
      startTime: now,
      lastPayoutTime: now
    });

    saveDB();

    ctx.reply(
      `🚀 *INVESTMENT STARTED!*\n\n• *Plan:* ${plan.name}\n• *Daily Yield:* ₦${plan.dailyYield}\n• *Duration:* ${plan.durationDays} Days\n\n⏱️ Your 24-hour payout countdown timer has started! Tap "⏱️ Active Timers" in the main menu to check remaining time anytime.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('⏱️ View Live Timer', 'menu_timers')]])
      }
    );
  });
});

// ==========================================
// 8. WITHDRAWAL FLOW (MINIMUM ₦1,000)
// ==========================================
bot.action('menu_withdraw', (ctx) => {
  registerUser(ctx);
  const userId = ctx.from.id;
  const user = db.users[userId];

  if (user.balance < 1000) {
    return ctx.reply(`❌ *Minimum withdrawal amount is ₦1,000.*\n\nYour current withdrawable balance is *₦${user.balance}*. Keep investing or let your yield run to reach ₦1,000!`, { parse_mode: 'Markdown' });
  }

  user.state = 'AWAITING_WITHDRAWAL_DETAILS';
  saveDB();

  const text = `
🏧 *WITHDRAWAL REQUEST*

Current Withdrawable Balance: *₦${user.balance}*

Please send your bank transfer details in this exact format:
\`<Bank Name>, <Account Number>, <Account Name>, <Amount>\`

*Example:*
\`OPay, 8088189547, Muhammad Rekiyatu, 1000\`
  `;

  ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
    [Markup.button.callback('❌ Cancel', 'menu_main')]
  ]));
});

// Handle Text Messages for Withdrawal
bot.on('text', (ctx) => {
  registerUser(ctx);
  const userId = ctx.from.id;
  const user = db.users[userId];

  if (user.state === 'AWAITING_WITHDRAWAL_DETAILS') {
    const input = ctx.message.text.split(',');

    if (input.length < 4) {
      return ctx.reply('⚠️ Invalid format. Please send in this format:\n`Bank Name, Account Number, Account Name, Amount`', { parse_mode: 'Markdown' });
    }

    const bankName = input[0].trim();
    const accountNumber = input[1].trim();
    const accountName = input[2].trim();
    const amount = parseFloat(input[3].trim());

    if (isNaN(amount) || amount < 1000) {
      return ctx.reply('❌ Minimum withdrawal amount is ₦1,000.');
    }

    if (amount > user.balance) {
      return ctx.reply(`❌ Insufficient balance. Maximum you can withdraw right now is ₦${user.balance}.`);
    }

    user.balance -= amount;
    user.state = 'IDLE';
    saveDB();

    ctx.reply(`✅ *Withdrawal Request Submitted!*\n\n₦${amount} has been requested for transfer to ${bankName} (${accountNumber}). Admin will process payment shortly.`, { parse_mode: 'Markdown' });

    bot.telegram.sendMessage(
      ADMIN_ID,
      `🏧 *NEW WITHDRAWAL REQUEST*\n\n• *User ID:* \`${userId}\`\n• *Username:* @${user.username}\n• *Amount:* ₦${amount}\n• *Bank:* ${bankName}\n• *Account Number:* \`${accountNumber}\`\n• *Account Name:* ${accountName}`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
});

// ==========================================
// 9. ADMIN COMMANDS
// ==========================================
bot.command('admin', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('❌ Unauthorized access.');

  const totalUsers = Object.keys(db.users).length;
  const adminText = `
⚙️ *ADMIN PANEL*

• *Total Subscribers:* ${totalUsers}

*Commands:*
• \`/credit <userID> <depositID> <amount>\` - Credit user wallet
• \`/broadcast <message>\` - Send message to all users
  `;
  ctx.replyWithMarkdown(adminText);
});

bot.command('broadcast', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const message = ctx.message.text.replace('/broadcast', '').trim();
  if (!message) return ctx.reply('Usage: /broadcast <message>');

  const userIds = Object.keys(db.users);
  ctx.reply(`📢 Broadcasting to ${userIds.length} users...`);

  let count = 0;
  for (const id of userIds) {
    try {
      await bot.telegram.sendMessage(id, `📢 *ANNOUNCEMENT*\n\n${message}`, { parse_mode: 'Markdown' });
      count++;
    } catch (e) {}
  }

  ctx.reply(`✅ Broadcast sent to ${count} users.`);
});

// ==========================================
// 10. START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

