const { Telegraf } = require('telegraf');
const config = require('./config/config');
const featureHandler = require('./handlers/featureHandler');

const bot = new Telegraf(config.BOT_TOKEN);

// Register all feature handlers
featureHandler(bot);

// Start bot
bot.launch()
    .then(() => {
        console.log('🤖 Bot is running...');
    })
    .catch((err) => {
        console.error('Bot launch error:', err);
    });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = bot;
