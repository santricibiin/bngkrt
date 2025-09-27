const CashProductionChecker = require('../../services/cashProductionChecker');
const keyboards = require('../../keyboards/inlineKeyboards');

module.exports = (bot, globalState) => {
    // Cash Production action handler
    bot.action('check_cash_production', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ Please login first!', keyboards.preLoginMenu);
                return;
            }

            const loadingMessage = await ctx.editMessageText('🔄 Fetching fresh Cash Production data...');
            
            // Ensure CashProductionChecker instance exists and is properly initialized
            if (!globalState.cashProductionChecker) {
                console.log('💰 Creating new CashProductionChecker instance');
                globalState.cashProductionChecker = new CashProductionChecker(globalState.scraper.page);
            } else {
                console.log('💰 Using existing CashProductionChecker instance');
            }
            
            console.log('💰 CashProductionChecker instance ready, fetching data...');
            // Force refresh data from web (always get latest data)
            const result = await globalState.cashProductionChecker.fetchCashProductionData(1, true);

            if (result.success) {
                console.log(`✅ Successfully fetched ${result.data.length} cash production items`);
                console.log(`✅ Total cached items: ${result.pagination.totalItems}`);
                console.log(`✅ Total pages: ${result.pagination.totalPages}`);
                
                const message = globalState.cashProductionChecker.formatCashProductionResult(result.data, result.pagination);
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMessage.message_id,
                    null,
                    message + '\n\n💡 Send Production ID number to view payment details',
                    { 
                        ...keyboards.getCashProductionKeyboard(
                            result.pagination.currentPage,
                            result.pagination.totalPages
                        )
                    }
                );
                
                // Set state to await Cash Production ID
                globalState.userStates.set(ctx.from.id, 'awaiting_cash_production_id');
            } else {
                console.log('❌ Failed to fetch cash production data:', result.error);
                await ctx.editMessageText('❌ No Cash Production data found or error occurred.', keyboards.postLoginMenu);
            }
        } catch (error) {
            console.error('Cash Production check error:', error);
            await ctx.editMessageText('⚠️ Error occurred while fetching Cash Production data.', keyboards.postLoginMenu);
        }
    });

    // Cash Production pagination handler
    bot.action(/cashprd_page_(\d+)/, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const page = parseInt(ctx.match[1]);
            
            if (!globalState.cashProductionChecker) {
                await ctx.editMessageText('❌ Please fetch Cash Production data first!', keyboards.postLoginMenu);
                return;
            }

            // Use cached data for pagination (don't refresh on page navigation)
            const result = await globalState.cashProductionChecker.fetchCashProductionData(page, false);

            if (result.success) {
                const message = globalState.cashProductionChecker.formatCashProductionResult(result.data, result.pagination);
                await ctx.editMessageText(message + '\n\n💡 Send Production ID number to view payment details', {
                    ...keyboards.getCashProductionKeyboard(
                        result.pagination.currentPage,
                        result.pagination.totalPages
                    )
                });
                
                globalState.userStates.set(ctx.from.id, 'awaiting_cash_production_id');
            }
        } catch (error) {
            console.error('Cash Production pagination error:', error);
            await ctx.answerCbQuery('Error changing page');
        }
    });

    // Handle Cash Production ID/Employee input
    bot.on('text', async (ctx, next) => {
        const userId = ctx.from.id;
        const state = globalState.userStates.get(userId);
        const text = ctx.message.text;

        if (state === 'awaiting_cash_production_id') {
            if (text.match(/^25\d{7}$/)) {
                // Handle Production ID
                try {
                    const cashProductionId = text;
                    const loadingMsg = await ctx.reply('💰 Fetching Cash Production details...');

                    if (!globalState.cashProductionChecker) {
                        globalState.cashProductionChecker = new CashProductionChecker(globalState.scraper.page);
                    }

                    await globalState.cashProductionChecker.ensureDataLoaded();
                    const result = await globalState.cashProductionChecker.getCashProductionDetail(cashProductionId);
                    
                    if (result && result.type === 'multiple_images') {
                        // Send multiple screenshots
                        for (const screenshot of result.screenshots) {
                            await ctx.replyWithPhoto({ 
                                source: screenshot.data 
                            }, { 
                                caption: `💰 Cash Payment Produksi #${result.productionId} (Part ${screenshot.part}/${screenshot.total})`,
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
                        await ctx.reply('❌ Could not find Cash Production with that ID');
                    }

                    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
                } catch (error) {
                    console.error('Cash Production detail error:', error);
                    await ctx.reply('⚠️ Error fetching Cash Production details');
                } finally {
                    globalState.userStates.delete(userId);
                    await ctx.reply('Select an option:', keyboards.postLoginMenu);
                }
            } else {
                // Handle Employee Name
                try {
                    const employeeName = text;
                    const loadingMsg = await ctx.reply(`🔍 Searching Cash Production data for employee: ${employeeName}...`);

                    if (!globalState.cashProductionChecker) {
                        globalState.cashProductionChecker = new CashProductionChecker(globalState.scraper.page);
                    }

                    const result = await globalState.cashProductionChecker.fetchCashProductionByEmployee(employeeName);
                    
                    if (result.success) {
                        const message = globalState.cashProductionChecker.formatEmployeeResult(result.data, result.employeeName);
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
                    console.error('Employee search error:', error);
                    await ctx.reply('⚠️ Error searching employee data');
                } finally {
                    globalState.userStates.delete(userId);
                    await ctx.reply('Select an option:', keyboards.postLoginMenu);
                }
            }
        } else {
            return next(); // Pass to next handler
        }
    });
};
