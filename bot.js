const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');

// ==========================================
// 1. INITIALIZATION & CONFIGURATION
// ==========================================
const BOT_TOKEN = process.env.BOT_TOKEN || '8661124178:AAF7fHANTSWMbqm9O_LR9VnXGKgN7AdcK6E';
const bot = new Telegraf(BOT_TOKEN);

const app = express();
const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
const SECRET_PATH = `/telegraf/${bot.secretToken || 'secret_webhook_path'}`;

// ADMIN SETTINGS
const ADMIN_ID = 7829040420;

// DATABASE SETUP (JSON Storage)
const DB_FILE = './database.json';
let db = { users: {}, activeInvestments: [], pendingReceipts: {} };

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE));
    if (!db.pendingReceipts) db.pendingReceipts = {};
  } catch (err) {
    console.error('Error reading database file:', err);
  }
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ==========================================
// 2. INVESTMENT TIERS DATA
// ==========================================
const PLANS = {
  plan_200: { name: 'Starter Plan', price: 200, dailyYield: 50, durationDays: 7 },
  plan_500: { name: 'Basic Plan', price: 500, dailyYield: 130, durationDays: 7 },
  plan_1000: { name: 'Silver Plan', price: 1000, dailyYield: 280, durationDays: 7 },
  plan_2000: { name: 'Gold Plan', price: 2000, dailyYield: 600, durationDays: 7 },
  plan_5000: { name: 'VIP Plan', price: 5000, dailyYield: 1600, durationDays: 7 }
};

// ==========================================
// 3. WEBHOOK & EXPRESS SETUP
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
  res.send('Naira Investment Bot Service is Active!');
});

// ==========================================
// 4. USER REGISTRATION & MENUS
// ==========================================

function registerUser(ctx) {
  const userId = ctx.from.id;
  if (!db.users[userId]) {
    db.users[userId] = {
      id: userId,
      username: ctx.from.username || 'NoUsername',
      balance: 0,
      totalEarned: 0,
      state: 'IDLE',
      selectedPlan: null,
      joinedAt: new Date().toISOString()
    };
    saveDB();
  }
}

// /start Command
bot.start((ctx) => {
  registerUser(ctx);
  db.users[ctx.from.id].state = 'IDLE';
  saveDB();

  const text = `
👋 *Welcome to the Smart Naira Investment Platform!*

Multiply your money daily with our secure high-yield investment tiers.

💰 *Available Tiers:*
• ₦200  ➔ Earns ₦50 / daily
• ₦500  ➔ Earns ₦130 / daily
• ₦1,000 ➔ Earns ₦280 / daily
• ₦2,000 ➔ Earns ₦600 / daily
• ₦5,000 ➔ Earns ₦1,600 / daily

Select an option below to begin:
  `;

  ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
    [Markup.button.callback('💳 Deposit / Invest', 'menu_deposit')],
    [Markup.button.callback('📊 Dashboard', 'menu_dashboard'), Markup.button.callback('📜 Plans', 'menu_plans')],
    [Markup.button.callback('📞 Contact Admin / Support', 'menu_support')]
  ]));
});

// Plans Menu
bot.action('menu_plans', (ctx) => {
  const text = `
📈 *INVESTMENT PACKAGES*

1️⃣ *Starter:* ₦200 (₦50 Daily for 7 Days)
2️⃣ *Basic:* ₦500 (₦130 Daily for 7 Days)
3️⃣ *Silver:* ₦1,000 (₦280 Daily for 7 Days)
4️⃣ *Gold:* ₦2,000 (₦600 Daily for 7 Days)
5️⃣ *VIP:* ₦5,000 (₦1,600 Daily for 7 Days)

Tap **Deposit / Invest** to make your deposit and activate a plan!
  `;
  ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
    [Markup.button.callback('💳 Deposit Now', 'menu_deposit')],
    [Markup.button.callback('⬅️ Back to Main Menu', 'menu_main')]
  ]));
});

// Main Menu Callback
bot.action('menu_main', (ctx) => {
  registerUser(ctx);
  db.users[ctx.from.id].state = 'IDLE';
  saveDB();
  ctx.deleteMessage().catch(() => {});
  return bot.handleUpdate({
    ...ctx.update,
    message: { ...ctx.update.callback_query.message, text: '/start' }
  });
});

// Dashboard Menu
bot.action('menu_dashboard', (ctx) => {
  registerUser(ctx);
  const user = db.users[ctx.from.id];
  const text = `
👤 *YOUR ACCOUNT DASHBOARD*

• *User ID:* \`${user.id}\`
• *Username:* @${user.username}
• *Withdrawable Balance:* ₦${user.balance}
• *Total Yield Earned:* ₦${user.totalEarned}
  `;
  ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
    [Markup.button.callback('💳 Deposit / Invest', 'menu_deposit')],
    [Markup.button.callback('⬅️ Back to Main Menu', 'menu_main')]
  ]));
});

// Deposit Menu: Select Tier
bot.action('menu_deposit', (ctx) => {
  registerUser(ctx);
  const text = `
💳 *SELECT INVESTMENT TIER*

Choose the tier you wish to deposit for:
  `;

  ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
    [Markup.button.callback('Starter (₦200)', 'select_plan_200'), Markup.button.callback('Basic (₦500)', 'select_plan_500')],
    [Markup.button.callback('Silver (₦1,000)', 'select_plan_1000'), Markup.button.callback('Gold (₦2,000)', 'select_plan_2000')],
    [Markup.button.callback('VIP (₦5,000)', 'select_plan_5000')],
    [Markup.button.callback('⬅️ Back to Main Menu', 'menu_main')]
  ]));
});

// Handle Plan Selection
Object.keys(PLANS).forEach((planKey) => {
  bot.action(`select_${planKey}`, (ctx) => {
    registerUser(ctx);
    const plan = PLANS[planKey];
    db.users[ctx.from.id].selectedPlan = planKey;
    db.users[ctx.from.id].state = 'AWAITING_RECEIPT';
    saveDB();

    const depositText = `
💳 *PAYMENT DETAILS FOR ${plan.name.toUpperCase()}*

Please transfer exactly *₦${plan.price}* to the official account below:

📌 *Bank Name:* OPay
📌 *Account Number:* 8088189547
📌 *Account Name:* Muhammad Rekiyatu

---
⚠️ *INSTRUCTIONS:*
1. Make the bank transfer of *₦${plan.price}*.
2. Take a clear screenshot of your payment receipt.
3. **Send the photo directly to this chat right now!**
    `;

    ctx.replyWithMarkdown(depositText, Markup.inlineKeyboard([
      [Markup.button.callback('❌ Cancel', 'menu_main')]
    ]));
  });
});

// Support Menu
bot.action('menu_support', (ctx) => {
  ctx.replyWithMarkdown(
    '💬 *Customer Support*\n\nIf you have any questions or need help, contact the admin directly:\n\n👉 @oluwasegraphicdesigner'
  );
});

// ==========================================
// 5. RECEIPT SUBMISSION & APPROVAL LOGIC
// ==========================================

// Handle Incoming Photos (Payment Receipts)
bot.on('photo', async (ctx) => {
  registerUser(ctx);
  const userId = ctx.from.id;
  const user = db.users[userId];

  if (user.state !== 'AWAITING_RECEIPT' || !user.selectedPlan) {
    return ctx.reply('⚠️ Please select an investment tier first by tapping "💳 Deposit / Invest".');
  }

  const plan = PLANS[user.selectedPlan];
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const receiptId = `REC_${Date.now()}_${userId}`;

  // Store receipt in database
  db.pendingReceipts[receiptId] = {
    id: receiptId,
    userId: userId,
    username: user.username,
    planKey: user.selectedPlan,
    amount: plan.price,
    date: new Date().toISOString()
  };

  // Reset user state
  user.state = 'IDLE';
  user.selectedPlan = null;
  saveDB();

  // Confirm to user
  ctx.reply('✅ *Receipt Submitted Successfully!*\n\nYour payment receipt has been sent to the admin for verification. You will be notified automatically as soon as it is approved.', { parse_mode: 'Markdown' });

  // Send photo and action buttons directly to Admin
  const adminCaption = `
📥 *NEW DEPOSIT RECEIPT SUBMITTED*

• *User ID:* \`${userId}\`
• *Username:* @${user.username}
• *Selected Plan:* ${plan.name}
• *Amount:* ₦${plan.price}
• *Receipt ID:* \`${receiptId}\`
  `;

  try {
    await bot.telegram.sendPhoto(ADMIN_ID, photo.file_id, {
      caption: adminCaption,
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Approve', `approve_${receiptId}`),
          Markup.button.callback('❌ Decline', `decline_${receiptId}`)
        ]
      ])
    });
  } catch (err) {
    console.error('Failed to notify admin:', err);
  }
});

// Admin Button Handler: APPROVE
bot.action(/^approve_(REC_\d+_\d+)$/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Unauthorized');

  const receiptId = ctx.match[1];
  const receipt = db.pendingReceipts[receiptId];

  if (!receipt) {
    return ctx.answerCbQuery('⚠️ Receipt already processed or expired.');
  }

  const targetUserId = receipt.userId;
  const amount = receipt.amount;

  if (db.users[targetUserId]) {
    db.users[targetUserId].balance += amount;
    db.users[targetUserId].totalEarned += amount;
  }

  delete db.pendingReceipts[receiptId];
  saveDB();

  ctx.editMessageCaption(
    `${ctx.callbackQuery.message.caption}\n\n STATUS: ✅ *APPROVED* by Admin`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  // Notify User
  bot.telegram.sendMessage(
    targetUserId,
    `🎉 *PAYMENT APPROVED!*\n\nYour transfer of *₦${amount}* has been verified and credited to your balance. Your investment yield is now active!`,
    { parse_mode: 'Markdown' }
  ).catch(err => console.error('Failed to notify user:', err));

  ctx.answerCbQuery('Approved successfully!');
});

// Admin Button Handler: DECLINE
bot.action(/^decline_(REC_\d+_\d+)$/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Unauthorized');

  const receiptId = ctx.match[1];
  const receipt = db.pendingReceipts[receiptId];

  if (!receipt) {
    return ctx.answerCbQuery('⚠️ Receipt already processed or expired.');
  }

  const targetUserId = receipt.userId;
  const amount = receipt.amount;

  delete db.pendingReceipts[receiptId];
  saveDB();

  ctx.editMessageCaption(
    `${ctx.callbackQuery.message.caption}\n\n STATUS: ❌ *DECLINED* by Admin`,
    { parse_mode: 'Markdown' }
  ).catch(() => {});

  // Notify User
  bot.telegram.sendMessage(
    targetUserId,
    `❌ *PAYMENT DECLINED*\n\nYour receipt for *₦${amount}* could not be verified. Please double-check your bank transfer details and try again or contact support: @oluwasegraphicdesigner`,
    { parse_mode: 'Markdown' }
  ).catch(err => console.error('Failed to notify user:', err));

  ctx.answerCbQuery('Declined successfully.');
});

// ==========================================
// 6. ADMINISTRATIVE COMMANDS (/admin & /broadcast)
// ==========================================

bot.command('admin', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('❌ Unauthorized access.');

  const totalUsers = Object.keys(db.users).length;
  const pendingCount = Object.keys(db.pendingReceipts).length;

  const adminText = `
⚙️ *ADMIN CONTROL PANEL*

• *Total Users:* ${totalUsers}
• *Pending Receipts:* ${pendingCount}
• *Active Server:* Render Webhook Active

*Commands:*
• \`/approve <userID> <amount>\` - Manual balance credit
• \`/broadcast <message>\` - Send announcement to all users
  `;
  ctx.replyWithMarkdown(adminText);
});

bot.command('approve', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const args = ctx.message.text.split(' ');
  if (args.length < 3) {
    return ctx.reply('Usage: /approve <userID> <amount>');
  }

  const targetId = args[1];
  const amount = parseFloat(args[2]);

  if (db.users[targetId]) {
    db.users[targetId].balance += amount;
    saveDB();
    ctx.reply(`✅ Successfully credited ₦${amount} to User ${targetId}`);

    bot.telegram.sendMessage(
      targetId,
      `🎉 *Account Credited!*\n\nYour account has been credited with ₦${amount}.`,
      { parse_mode: 'Markdown' }
    ).catch(err => console.error('Failed to notify user:', err));
  } else {
    ctx.reply('❌ User ID not found in database.');
  }
});

bot.command('broadcast', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const message = ctx.message.text.replace('/broadcast', '').trim();
  if (!message) {
    return ctx.reply('Usage: /broadcast <your message here>');
  }

  const userIds = Object.keys(db.users);
  ctx.reply(`📢 Starting broadcast to ${userIds.length} users...`);

  let successCount = 0;
  for (const id of userIds) {
    try {
      await bot.telegram.sendMessage(id, `📢 *ANNOUNCEMENT*\n\n${message}`, { parse_mode: 'Markdown' });
      successCount++;
    } catch (err) {
      // Ignore users who blocked the bot
    }
  }

  ctx.reply(`✅ Broadcast complete! Delivered to ${successCount} users.`);
});

// ==========================================
// 7. START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

