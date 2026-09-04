const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');

// ==========================================
// 1. CONFIGURATION & BOT SETUP
// ==========================================
const BOT_TOKEN = '8661124178:AAF7fHANTSWMbqm9O_LR9VnXGKgN7AdcK6E';
const bot = new Telegraf(BOT_TOKEN);

const app = express();
const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://investment-bot-xk4d.onrender.com';
const WEBHOOK_PATH = '/secret-webhook';

// ADMIN & DATABASE
const ADMIN_ID = 123456789; // Replace with your numeric Telegram ID
const DB_FILE = './database.json';
let db = { users: {}, activeInvestments: [] };

if (fs.existsSync(DB_FILE)) {
  try { db = JSON.parse(fs.readFileSync(DB_FILE)); } catch (e) {}
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ==========================================
// 2. EXPRESS & WEBHOOK ROUTING
// ==========================================
app.use(express.json());

// Main HTTP health check (for UptimeRobot)
app.get('/', (req, res) => {
  res.send('Investment Bot Webhook is Active');
});

// Register Webhook route directly
app.use(WEBHOOK_PATH, bot.webhookCallback(WEBHOOK_PATH));

// Set Telegram Webhook directly on server boot
bot.telegram.setWebhook(`${RENDER_URL}${WEBHOOK_PATH}`)
  .then(() => console.log(`Webhook set successfully to ${RENDER_URL}${WEBHOOK_PATH}`))
  .catch((err) => console.error('Webhook set error:', err));

// ==========================================
// 3. BOT COMMANDS & HANDLERS
// ==========================================
function registerUser(ctx) {
  if (!ctx.from) return;
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

bot.start((ctx) => {
  registerUser(ctx);
  const text = `
👋 *Welcome to Smart Naira Investment Platform!*

Multiply your money daily with high-yield investment tiers.

💰 *Available Tiers:*
• ₦200 ➔ Earns ₦50 / daily
• ₦500 ➔ Earns ₦130 / daily
• ₦1,000 ➔ Earns ₦280 / daily
• ₦2,000 ➔ Earns ₦600 / daily
• ₦5,000 ➔ Earns ₦1,600 / daily
  `;

  ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
    [Markup.button.callback('💳 Deposit / Invest', 'menu_deposit')],
    [Markup.button.callback('📊 Dashboard', 'menu_dashboard'), Markup.button.callback('📜 Plans', 'menu_plans')],
    [Markup.button.callback('📞 Contact Admin', 'menu_support')]
  ]));
});

bot.action('menu_deposit', (ctx) => {
  const text = `
💳 *OFFICIAL PAYMENT & DEPOSIT DETAILS*

Make your payment to the official account below:

📌 *Bank Name:* OPay / PalmPay / Moniepoint
📌 *Account Number:* 1234567890
📌 *Account Name:* Olanrewaju Wasiu Bamidele

---
⚠️ *HOW TO ACTIVATE YOUR PLAN:*
1. Transfer chosen plan amount (₦200 - ₦5,000).
2. Take a screenshot of payment receipt.
3. Send receipt to Admin for manual activation.
  `;
  ctx.replyWithMarkdown(text, Markup.inlineKeyboard([
    [Markup.button.url('📩 Send Receipt to Admin', 'https://t.me/YourAdminUsername')],
    [Markup.button.callback('⬅️ Back', 'menu_main')]
  ]));
});

bot.action('menu_dashboard', (ctx) => {
  registerUser(ctx);
  const user = db.users[ctx.from.id] || { id: ctx.from.id, username: 'User', balance: 0, totalEarned: 0 };
  ctx.replyWithMarkdown(`👤 *ACCOUNT DASHBOARD*\n\n• *User ID:* \`${user.id}\`\n• *Balance:* ₦${user.balance}\n• *Earned:* ₦${user.totalEarned}`);
});

bot.action('menu_plans', (ctx) => {
  ctx.replyWithMarkdown('📈 *PLANS*\n1. ₦200 (₦50/day)\n2. ₦500 (₦130/day)\n3. ₦1,000 (₦280/day)\n4. ₦2,000 (₦600/day)\n5. ₦5,000 (₦1,600/day)');
});

bot.action('menu_support', (ctx) => {
  ctx.reply('Contact Admin: @YourAdminUsername');
});

// Admin commands
bot.command('admin', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  ctx.reply(`⚙️ Admin Panel: ${Object.keys(db.users).length} users registered.`);
});

// ==========================================
// 4. START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

