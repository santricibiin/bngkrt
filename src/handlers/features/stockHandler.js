const StockChecker = require('../../services/stockChecker');
const keyboards = require('../../keyboards/inlineKeyboards');

module.exports = (bot, globalState) => {
    // Stock check action handler
    bot.action('check_stock', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ Please login first!', keyboards.preLoginMenu);
                return;
            }

            globalState.userStates.set(ctx.from.id, 'awaiting_item_name');
            await ctx.editMessageText('📝 Please enter item name (Example: KARET 07 P - KG)');
            
        } catch (error) {
            console.error('Stock check error:', error);
            await ctx.editMessageText('⚠️ Error occurred. Please try again.', keyboards.postLoginMenu);
        }
    });

    // Handle text messages for item search
    bot.on('text', async (ctx, next) => {
        const userId = ctx.from.id;
        const state = globalState.userStates.get(userId);

        if (state === 'awaiting_item_name') {
            try {
                // Support multiple items: "07 p,11 p,55 p"
                const itemNames = ctx.message.text;
                const searchMessage = await ctx.reply('🔍 Searching...');

                const stockChecker = new StockChecker(globalState.scraper.page);
                const result = await stockChecker.searchStock(itemNames);

                if (result.success && result.data.length > 0) {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        searchMessage.message_id,
                        null,
                        stockChecker.formatStockResult(result.data),
                        { 
                            parse_mode: 'HTML',
                            disable_web_page_preview: true
                        }
                    );
                } else {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        searchMessage.message_id,
                        null,
                        '❌ No stock data found for your search.'
                    );
                }

            } catch (error) {
                console.error('Search error:', error);
                await ctx.reply('⚠️ Error occurred while searching stock data.');
            } finally {
                globalState.userStates.delete(userId);
                await ctx.reply('Select an option:', keyboards.postLoginMenu);
            }
        } else {
            return next(); // Pass to next handler
        }
    });
};
