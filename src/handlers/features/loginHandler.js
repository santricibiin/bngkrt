const WebScraper = require('../../services/scraper');
const keyboards = require('../../keyboards/inlineKeyboards');

let scraper = null;

const startOrderChecking = (bot, chatId, globalState) => {
    const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
    
    setInterval(async () => {
        try {
            // Check if pprChecker exists and scraper is available
            if (!globalState.pprChecker && globalState.scraper && globalState.scraper.page) {
                // Initialize pprChecker if it doesn't exist
                const PPRChecker = require('../../services/pprChecker');
                globalState.pprChecker = new PPRChecker(globalState.scraper.page);
            }
            
            // Only proceed if pprChecker is available
            if (globalState.pprChecker) {
                const newOrders = await globalState.pprChecker.checkNewOrders();
                if (newOrders && newOrders.length > 0) {
                    const message = globalState.pprChecker.formatNewOrderNotification(newOrders);
                    if (message) {
                        await bot.telegram.sendMessage(chatId, message, {
                            parse_mode: 'HTML',
                            ...keyboards.getPaginatedMainMenu(1)
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Order checking error:', error);
        }
    }, CHECK_INTERVAL);
};

module.exports = (bot, globalState) => {
    // Scraping action handler
    bot.action('start_scrape', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            await ctx.editMessageText('🔄 Starting login process...');
            
            scraper = new WebScraper(); // Assign to global scraper
            globalState.scraper = scraper; // Share with global state
            
            await scraper.initBrowser(false);
            const loginSuccess = await scraper.loginWithCookie();
            
            if (loginSuccess) {
                // Use paginated main menu
                await ctx.editMessageText('✅ sᴜᴄᴄᴇssғᴜʟʟʏ ʟᴏɢɡᴇᴅ ɪɴ ᴛᴏ ᴘᴏʀᴛᴀʟ!\n\n🏠 ᴍᴀɪɴ ᴍᴇɴᴜ:', keyboards.getPaginatedMainMenu(1));
                
                // Start order checking after successful login
                startOrderChecking(bot, ctx.chat.id, globalState);
            } else {
                await ctx.editMessageText('❌ ʟᴏɡɪɴ ғᴀɪʟᴇᴅ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ.', keyboards.preLoginMenu);
            }
        } catch (error) {
            console.error('Scraping error:', error);
            await ctx.editMessageText('⚠️ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴅᴜʀɪɴɢ ʟᴏɡɪɴ.', keyboards.preLoginMenu);
        }
    });

    // Portal status action
    bot.action('portal_status', async (ctx) => {
        await ctx.answerCbQuery('Portal is active');
    });
};
