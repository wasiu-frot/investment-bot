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
let db = { users: {}, activeInvestments: [] };

if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE));
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
// 3. WEBHOOK & UPTIMEROBOT SETUP
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
  res.send('Naira Investment Bot Service is 100% Active and Healthy!');
});

// ==========================================
// 4. USER COMMANDS & MENUS
// ==========================================

// Helper to ensure user exists in database
function registerUser(ctx) {
  const userId = ctx.from.id;
  if (!db.users[userId]) {
    db.users[userId] = {
      id: userId,
      username: ctx.from.username || 'NoUsername',
      balance: 0,
      totalEarned: 0,
      joinedAt: new Date().toISOString()
    };
    saveDB();
  }
}

// /start Command
bot.start((ctx) => {
  registerUser(ctx);
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
    [Markup.button.callback('⬅️ Back', 'menu_main')]
  ]));
});

// Deposit & Bank Account Details
bot.action('menu_deposit', (ctx) => {
  const depositText = `
💳 *OFFICIAL PAYMENT & DEPOSIT DETAILS*

Make your payment to the official account below:

📌 *Bank Name:* OPay / PalmPay / Moniepoint
📌 *Account Number:* 1234567890
📌 *Account Name:* Olanrewaju Wasiu Bamidele

---
⚠️ *HOW TO ACTIVATE YOUR PLAN:*
1. Transfer the exact amount for your chosen plan (₦200 to ₦5,000).
2. Take a screenshot of your transfer receipt.
3. Send the receipt directly to the Admin below for instant account activation!
  `;

  ctx.replyWithMarkdown(depositText, Markup.inlineKeyboard([
    [Markup.button.url('📩 Send Payment Receipt to Admin', 'https://t.me/oluwasegraphicdesigner')],
    [Markup.button.callback('⬅️ Back to Main Menu', 'menu_main')]
  ]));
});

// Support Menu
bot.action('menu_support', (ctx) => {
  ctx.replyWithMarkdown(
    '💬 *Customer Support*\n\nIf you have any questions or need your payment approved, contact the admin directly:\n\n👉 @oluwasegraphicdesigner'
  );
});

// ==========================================
// 5. ADMINISTRATIVE COMMANDS (/admin & /broadcast)
// ==========================================

// /admin Panel
bot.command('admin', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply('❌ Unauthorized access.');
  }

  const totalUsers = Object.keys(db.users).length;
  const adminText = `
⚙️ *ADMIN CONTROL PANEL*

• *Total Subscribers:* ${totalUsers}
• *Active Server:* Render Webhook Active

*Commands:*
• \`/approve <userID> <amount>\` - Credit user balance/plan
• \`/broadcast <message>\` - Broadcast message to all subscribers
  `;
  ctx.replyWithMarkdown(adminText);
});

// Manual Credit Approval Command
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
    
    // Notify User
    bot.telegram.sendMessage(
      targetId,
      `🎉 *Payment Approved!*\n\nYour account has been credited with ₦${amount}. Your daily yield is now active!`,
      { parse_mode: 'Markdown' }
    ).catch(err => console.error('Failed to notify user:', err));
  } else {
    ctx.reply('❌ User ID not found in database.');
  }
});

// Broadcast Command to all Subscribers
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
      // Ignore errors for users who blocked the bot
    }
  }

  ctx.reply(`✅ Broadcast complete! Successfully delivered to ${successCount} users.`);
});

// ==========================================
// 6. START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

