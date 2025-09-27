const SalesChecker = require('../../services/salesChecker');
const keyboards = require('../../keyboards/inlineKeyboards');

module.exports = (bot, globalState) => {
    // Sales action handler
    bot.action('check_sales', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ Please login first!', keyboards.preLoginMenu);
                return;
            }

            const loadingMessage = await ctx.editMessageText('🔄 Fetching fresh Sales data...');
            
            // Create new SalesChecker instance only if not exists
            if (!globalState.salesChecker) {
                console.log('💰 Creating new SalesChecker instance');
                globalState.salesChecker = new SalesChecker(globalState.scraper.page);
            } else {
                console.log('💰 Using existing SalesChecker instance');
            }
            
            console.log('💰 SalesChecker instance ready, fetching data...');
            // Force refresh data from web (always get latest data)
            const result = await globalState.salesChecker.fetchSalesData(1, true);

            if (result.success) {
                console.log(`✅ Successfully fetched ${result.data.length} sales items`);
                console.log(`✅ Total cached items: ${result.pagination.totalItems}`);
                console.log(`✅ Total pages: ${result.pagination.totalPages}`);
                
                const message = globalState.salesChecker.formatSalesResult(result.data, result.pagination);
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMessage.message_id,
                    null,
                    message,
                    { 
                        ...keyboards.getSalesKeyboard(
                            result.pagination.currentPage,
                            result.pagination.totalPages
                        )
                    }
                );
            } else {
                console.log('❌ Failed to fetch sales data:', result.error);
                await ctx.editMessageText('❌ No Sales data found or error occurred.', keyboards.postLoginMenu);
            }
        } catch (error) {
            console.error('Sales check error:', error);
            await ctx.editMessageText('⚠️ Error occurred while fetching Sales data.', keyboards.postLoginMenu);
        }
    });

    // Sales pagination handler
    bot.action(/sales_page_(\d+)/, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const page = parseInt(ctx.match[1]);
            
            // Use existing salesChecker instance
            if (!globalState.salesChecker) {
                await ctx.editMessageText('❌ Please fetch Sales data first!', keyboards.postLoginMenu);
                return;
            }

            // Use cached data for pagination (don't refresh on page navigation)
            const result = await globalState.salesChecker.fetchSalesData(page, false);

            if (result.success) {
                const message = globalState.salesChecker.formatSalesResult(result.data, result.pagination);
                await ctx.editMessageText(message, {
                    ...keyboards.getSalesKeyboard(
                        result.pagination.currentPage,
                        result.pagination.totalPages
                    )
                });
            }
        } catch (error) {
            console.error('Sales pagination error:', error);
            await ctx.answerCbQuery('Error changing page');
        }
    });
};
