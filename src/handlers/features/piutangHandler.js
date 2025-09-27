const PiutangChecker = require('../../services/piutangChecker');
const keyboards = require('../../keyboards/inlineKeyboards');

module.exports = (bot, globalState) => {
    // Piutang action handler
    bot.action('check_piutang', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ Please login first!', keyboards.preLoginMenu);
                return;
            }

            const loadingMessage = await ctx.editMessageText('🔄 Fetching piutang data...');
            
            // Create new PiutangChecker instance only if not exists
            if (!globalState.piutangChecker) {
                globalState.piutangChecker = new PiutangChecker(globalState.scraper.page);
            }
            
            // Fetch piutang summary data
            const result = await globalState.piutangChecker.fetchPiutangData();

            if (result.success) {
                const message = globalState.piutangChecker.formatPiutangSummary(result.data);
                
                // Set state to await customer name
                globalState.userStates.set(ctx.from.id, 'awaiting_customer_name');
                
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMessage.message_id,
                    null,
                    message
                );
            } else {
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMessage.message_id,
                    null,
                    `❌ Error: ${result.error}`,
                    keyboards.postLoginMenu
                );
            }
        } catch (error) {
            console.error('Piutang check error:', error);
            await ctx.editMessageText('⚠️ Error occurred while fetching piutang data.', keyboards.postLoginMenu);
        }
    });

    // Handle customer name input
    bot.on('text', async (ctx, next) => {
        const userId = ctx.from.id;
        const state = globalState.userStates.get(userId);
        const text = ctx.message.text;

        if (state === 'awaiting_customer_name') {
            try {
                // Process customer name search
                const customerName = text;
                const loadingMsg = await ctx.reply('🔍 Searching piutang for customer...');

                if (!globalState.piutangChecker) {
                    globalState.piutangChecker = new PiutangChecker(globalState.scraper.page);
                }

                const result = await globalState.piutangChecker.searchCustomerPiutang(customerName);
                
                if (result.success) {
                    const message = globalState.piutangChecker.formatCustomerPiutang(result.customerName, result.data);
                                  
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMsg.message_id,
                        null,
                        message
                    );
                } else {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMsg.message_id,
                        null,
                        `❌ ${result.error}`
                    );
                }

            } catch (error) {
                console.error('Customer piutang search error:', error);
                await ctx.reply('⚠️ Error searching customer piutang');
            } finally {
                globalState.userStates.delete(userId);
                await ctx.reply('Select an option:', keyboards.postLoginMenu);
            }
        } else {
            return next(); // Pass to next handler
        }
    });
};
