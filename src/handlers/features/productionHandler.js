const ProductionChecker = require('../../services/productionChecker');
const keyboards = require('../../keyboards/inlineKeyboards');

module.exports = (bot, globalState) => {
    // Production action handler
    bot.action('check_production', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ Please login first!', keyboards.preLoginMenu);
                return;
            }

            const loadingMessage = await ctx.editMessageText('🔄 Fetching fresh Production data...');
            
            // Create new ProductionChecker instance only if not exists
            if (!globalState.productionChecker) {
                globalState.productionChecker = new ProductionChecker(globalState.scraper.page);
            }
            
            // Force refresh data from web (always get latest data)
            const result = await globalState.productionChecker.fetchProductionData(1, true);

            if (result.success) {
                const message = globalState.productionChecker.formatProductionResult(result.data, result.pagination);
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMessage.message_id,
                    null,
                    message + '\n\n💡 Send Production ID number to view details',
                    { 
                        ...keyboards.getProductionKeyboard(
                            result.pagination.currentPage,
                            result.pagination.totalPages
                        )
                    }
                );
                
                // Set state to await Production ID
                globalState.userStates.set(ctx.from.id, 'awaiting_production_id');
            } else {
                await ctx.editMessageText('❌ No Production data found or error occurred.', keyboards.postLoginMenu);
            }
        } catch (error) {
            console.error('Production check error:', error);
            await ctx.editMessageText('⚠️ Error occurred while fetching Production data.', keyboards.postLoginMenu);
        }
    });

    // Production pagination handler
    bot.action(/production_page_(\d+)/, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const page = parseInt(ctx.match[1]);
            
            // Use existing productionChecker instance
            if (!globalState.productionChecker) {
                await ctx.editMessageText('❌ Please fetch Production data first!', keyboards.postLoginMenu);
                return;
            }

            // Use cached data for pagination (don't refresh on page navigation)
            const result = await globalState.productionChecker.fetchProductionData(page, false);

            if (result.success) {
                const message = globalState.productionChecker.formatProductionResult(result.data, result.pagination);
                await ctx.editMessageText(message + '\n\n💡 Send Production ID number to view details', {
                    ...keyboards.getProductionKeyboard(
                        result.pagination.currentPage,
                        result.pagination.totalPages
                    )
                });
                
                // Maintain state for Production ID input
                globalState.userStates.set(ctx.from.id, 'awaiting_production_id');
            }
        } catch (error) {
            console.error('Production pagination error:', error);
            await ctx.answerCbQuery('Error changing page');
        }
    });

    // Handle Production ID input
    bot.on('text', async (ctx, next) => {
        const userId = ctx.from.id;
        const state = globalState.userStates.get(userId);
        const text = ctx.message.text;

        if (state === 'awaiting_production_id' && text.match(/^25\d{7}$/)) { // Production ID format
            try {
                const productionId = text;
                const loadingMsg = await ctx.reply('🔍 Fetching Production details...');

                if (!globalState.productionChecker) {
                    globalState.productionChecker = new ProductionChecker(globalState.scraper.page);
                }

                await globalState.productionChecker.ensureDataLoaded();
                const result = await globalState.productionChecker.getProductionDetail(productionId);
                
                if (result && result.type === 'multiple_images') {
                    // Send multiple screenshots
                    for (const screenshot of result.screenshots) {
                        await ctx.replyWithPhoto({ 
                            source: screenshot.data 
                        }, { 
                            caption: `🏭 Detail Produksi #${result.productionId} (Part ${screenshot.part}/${screenshot.total})`,
                            parse_mode: 'HTML'
                        });
                        
                        // Small delay between images
                        await new Promise(r => setTimeout(r, 500));
                    }
                } else if (result && result.type === 'image') {
                    // Single screenshot (fallback for modal)
                    await ctx.replyWithPhoto({ 
                        source: result.data 
                    }, { 
                        caption: result.caption,
                        parse_mode: 'HTML'
                    });
                } else {
                    await ctx.reply('❌ Could not find Production with that ID');
                }

                await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
            } catch (error) {
                console.error('Production detail error:', error);
                await ctx.reply('⚠️ Error fetching Production details');
            } finally {
                globalState.userStates.delete(userId);
                await ctx.reply('Select an option:', keyboards.postLoginMenu);
            }
        } else {
            return next(); // Pass to next handler
        }
    });
};
