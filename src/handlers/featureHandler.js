// Import all feature handlers
const loginHandler = require('./features/loginHandler');
const stockHandler = require('./features/stockHandler');
const pprHandler = require('./features/pprHandler');
const productionHandler = require('./features/productionHandler');
const cashProductionHandler = require('./features/cashProductionHandler');
const purchaseHandler = require('./features/purchaseHandler');
const salesHandler = require('./features/salesHandler');
const adjustmentHandler = require('./features/adjustmentHandler');
const returHandler = require('./features/returHandler');
const piutangHandler = require('./features/piutangHandler');
const absensiHandler = require('./features/absensiHandler');
const confirmPPRHandler = require('./features/confirmPPRHandler');
const transferStockHandler = require('./features/transferStockHandler');
const navigationHandler = require('./features/navigationHandler');

// Import existing handlers
const commandHandler = require('./commandHandler');
const menuHandler = require('./menuHandler');

module.exports = (bot) => {
    // Initialize global state to share between handlers
    const globalState = {
        scraper: null,
        pprChecker: null,
        productionChecker: null,
        cashProductionChecker: null,
        purchaseChecker: null,
        salesChecker: null,
        adjustmentChecker: null,
        confirmStockChecker: null,
        purchaseTransactionChecker: null,
        returChecker: null,
        confirmReturChecker: null,
        absensiChecker: null,
        confirmPPRChecker: null,
        piutangChecker: null,
        transferStockChecker: null,
        userStates: new Map(),
        lastNotifiedUsers: new Set()
    };

    // Add debug logging for all actions
    bot.use(async (ctx, next) => {
        if (ctx.callbackQuery) {
            console.log(`🔍 Action received: ${ctx.callbackQuery.data}`);
        }
        return next();
    });

    // Register all handlers
    commandHandler(bot);
    menuHandler(bot);
    
    // Register feature handlers
    loginHandler(bot, globalState);
    stockHandler(bot, globalState);
    pprHandler(bot, globalState);
    productionHandler(bot, globalState);
    cashProductionHandler(bot, globalState);
    purchaseHandler(bot, globalState);
    salesHandler(bot, globalState);
    adjustmentHandler(bot, globalState);
    returHandler(bot, globalState);
    piutangHandler(bot, globalState);
    absensiHandler(bot, globalState);
    confirmPPRHandler(bot, globalState);
    transferStockHandler(bot, globalState);
    navigationHandler(bot, globalState); // Should be last to handle fallback text messages

    // Error handling
    bot.catch((err, ctx) => {
        console.error(`Error for ${ctx.updateType}`, err);
        ctx.reply('⚠️ An error occurred. Please try again later.');
    });
};
