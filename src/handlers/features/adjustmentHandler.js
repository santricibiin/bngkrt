const AdjustmentChecker = require('../../services/adjustmentChecker');
const ConfirmStockChecker = require('../../services/confirmStockChecker');
const keyboards = require('../../keyboards/inlineKeyboards');

module.exports = (bot, globalState) => {
    // Adjustment action handler
    bot.action('check_adjustment', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ Please login first!', keyboards.preLoginMenu);
                return;
            }

            const loadingMessage = await ctx.editMessageText('🔄 Fetching fresh Adjustment data...');
            
            // Create new AdjustmentChecker instance only if not exists
            if (!globalState.adjustmentChecker) {
                console.log('📦 Creating new AdjustmentChecker instance');
                globalState.adjustmentChecker = new AdjustmentChecker(globalState.scraper.page);
            } else {
                console.log('📦 Using existing AdjustmentChecker instance');
            }
            
            console.log('📦 AdjustmentChecker instance ready, fetching data...');
            // Force refresh data from web (always get latest data)
            const result = await globalState.adjustmentChecker.fetchAdjustmentData(1, true);

            if (result.success) {
                console.log(`✅ Successfully fetched ${result.data.length} adjustment items`);
                console.log(`✅ Total cached items: ${result.pagination.totalItems}`);
                console.log(`✅ Total pages: ${result.pagination.totalPages}`);
                
                const message = globalState.adjustmentChecker.formatAdjustmentResult(result.data, result.pagination);
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMessage.message_id,
                    null,
                    message + '\n\n💡 Send Adjustment ID to view details\n📝 Or send data to create: Stock Masuk,Note,Item Name,Qty',
                    { 
                        ...keyboards.getAdjustmentKeyboard(
                            result.pagination.currentPage,
                            result.pagination.totalPages
                        )
                    }
                );
                
                // Set state to await adjustment ID or data
                globalState.userStates.set(ctx.from.id, 'awaiting_adjustment_id');
            } else {
                console.log('❌ Failed to fetch adjustment data:', result.error);
                await ctx.editMessageText('❌ No Adjustment data found or error occurred.', keyboards.postLoginMenu);
            }
        } catch (error) {
            console.error('Adjustment check error:', error);
            await ctx.editMessageText('⚠️ Error occurred while fetching Adjustment data.', keyboards.postLoginMenu);
        }
    });

    // Adjustment pagination handler
    bot.action(/adjustment_page_(\d+)/, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const page = parseInt(ctx.match[1]);
            
            // Use existing adjustmentChecker instance
            if (!globalState.adjustmentChecker) {
                await ctx.editMessageText('❌ Please fetch Adjustment data first!', keyboards.postLoginMenu);
                return;
            }

            // Use cached data for pagination (don't refresh on page navigation)
            const result = await globalState.adjustmentChecker.fetchAdjustmentData(page, false);

            if (result.success) {
                const message = globalState.adjustmentChecker.formatAdjustmentResult(result.data, result.pagination);
                await ctx.editMessageText(message + '\n\n💡 Send Adjustment ID to view details\n📝 Or send data to create: Stock Masuk,Note,Item Name,Qty', {
                    ...keyboards.getAdjustmentKeyboard(
                        result.pagination.currentPage,
                        result.pagination.totalPages
                    )
                });
                
                // Maintain state for adjustment ID or data input
                globalState.userStates.set(ctx.from.id, 'awaiting_adjustment_id');
            }
        } catch (error) {
            console.error('Adjustment pagination error:', error);
            await ctx.answerCbQuery('Error changing page');
        }
    });

    // Confirm Stock action handler
    bot.action('check_confirm_stock', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ Please login first!', keyboards.preLoginMenu);
                return;
            }

            const loadingMessage = await ctx.editMessageText('🔄 Fetching Confirm Stock data...');
            
            // Create new ConfirmStockChecker instance only if not exists
            if (!globalState.confirmStockChecker) {
                console.log('✅ Creating new ConfirmStockChecker instance');
                globalState.confirmStockChecker = new ConfirmStockChecker(globalState.scraper.page);
            } else {
                console.log('✅ Using existing ConfirmStockChecker instance');
            }
            
            console.log('✅ ConfirmStockChecker instance ready, fetching data...');
            // Force refresh data from web (always get latest data)
            const result = await globalState.confirmStockChecker.fetchConfirmStockData(1, true);

            if (result.success) {
                console.log(`✅ Successfully fetched ${result.data.length} confirm stock items`);
                console.log(`✅ Total cached items: ${result.pagination.totalItems}`);
                console.log(`✅ Total pages: ${result.pagination.totalPages}`);
                
                const message = globalState.confirmStockChecker.formatConfirmStockResult(result.data, result.pagination);
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMessage.message_id,
                    null,
                    message + '\n\n💡 Send adjustment ID to approve (Example: 250800025)',
                    { 
                        ...keyboards.getConfirmStockKeyboard(
                            result.pagination.currentPage,
                            result.pagination.totalPages
                        )
                    }
                );
                
                // Set state to await confirm stock ID
                globalState.userStates.set(ctx.from.id, 'awaiting_confirm_stock_id');
            } else {
                console.log('❌ Failed to fetch confirm stock data:', result.error);
                await ctx.editMessageText('❌ No Confirm Stock data found or error occurred.', keyboards.getAdjustmentKeyboard(1, 1));
            }
        } catch (error) {
            console.error('Confirm Stock check error:', error);
            await ctx.editMessageText('⚠️ Error occurred while fetching Confirm Stock data.', keyboards.getAdjustmentKeyboard(1, 1));
        }
    });

    // Confirm Stock pagination handler
    bot.action(/confirm_stock_page_(\d+)/, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const page = parseInt(ctx.match[1]);
            
            // Use existing confirmStockChecker instance
            if (!globalState.confirmStockChecker) {
                await ctx.editMessageText('❌ Please fetch Confirm Stock data first!', keyboards.getAdjustmentKeyboard(1, 1));
                return;
            }

            // Use cached data for pagination (don't refresh on page navigation)
            const result = await globalState.confirmStockChecker.fetchConfirmStockData(page, false);

            if (result.success) {
                const message = globalState.confirmStockChecker.formatConfirmStockResult(result.data, result.pagination);
                await ctx.editMessageText(message + '\n\n💡 Send adjustment ID to approve (Example: 250800025)', {
                    ...keyboards.getConfirmStockKeyboard(
                        result.pagination.currentPage,
                        result.pagination.totalPages
                    )
                });
                
                // Maintain state for confirm stock ID input
                globalState.userStates.set(ctx.from.id, 'awaiting_confirm_stock_id');
            }
        } catch (error) {
            console.error('Confirm Stock pagination error:', error);
            await ctx.answerCbQuery('Error changing page');
        }
    });

    // Handle Adjustment ID/data and Confirm Stock ID input
    bot.on('text', async (ctx, next) => {
        const userId = ctx.from.id;
        const state = globalState.userStates.get(userId);
        const text = ctx.message.text;

        if (state === 'awaiting_adjustment_id') {
            // Deteksi apakah input adalah ID (angka) atau data create (mengandung koma)
            if (text.match(/^25\d{7}$/)) {
                // Handle Adjustment ID untuk detail
                try {
                    const adjustmentId = text;
                    const loadingMsg = await ctx.reply('📦 Fetching Adjustment details...');

                    if (!globalState.adjustmentChecker) {
                        globalState.adjustmentChecker = new AdjustmentChecker(globalState.scraper.page);
                    }

                    await globalState.adjustmentChecker.ensureDataLoaded();
                    const result = await globalState.adjustmentChecker.getAdjustmentDetail(adjustmentId);
                    
                    if (result && result.type === 'image') {
                        await ctx.replyWithPhoto({ 
                            source: result.data 
                        }, { 
                            caption: result.caption,
                            parse_mode: 'HTML'
                        });
                    } else {
                        await ctx.reply('❌ Could not find Adjustment with that ID');
                    }

                    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
                } catch (error) {
                    console.error('Adjustment detail error:', error);
                    await ctx.reply('⚠️ Error fetching Adjustment details');
                } finally {
                    globalState.userStates.delete(userId);
                    await ctx.reply('Select an option:', keyboards.postLoginMenu);
                }
            } else if (text.includes(',')) {
                // Handle Adjustment data untuk create
                try {
                    const adjustmentData = text;
                    const loadingMsg = await ctx.reply('📦 Creating stock adjustment...');

                    if (!globalState.adjustmentChecker) {
                        globalState.adjustmentChecker = new AdjustmentChecker(globalState.scraper.page);
                    }

                    const result = await globalState.adjustmentChecker.createAdjustment(adjustmentData);
                    
                    if (result.success) {
                        const message = `✅ Stock adjustment created successfully!\n\n` +
                                      `📦 Type: ${result.data.stockType}\n` +
                                      `📝 Note: ${result.data.note}\n` +
                                      `📋 Item: ${result.data.itemName}\n` +
                                      `🔢 Quantity: ${result.data.quantity}\n` +
                                      `✅ Auto Approve: ${result.data.autoApprove ? 'Yes' : 'No'}\n` +
                                      `📊 Status: ${result.data.status}\n\n` +
                                      `🎉 The stock adjustment has been submitted and is waiting for approval.`;
                                      
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
                    console.error('Adjustment creation error:', error);
                    await ctx.reply('⚠️ Error creating stock adjustment');
                } finally {
                    globalState.userStates.delete(userId);
                    await ctx.reply('Select an option:', keyboards.postLoginMenu);
                }
            } else {
                await ctx.reply('❌ Invalid format. Send ID (example: 250800025) for details or data (Stock Masuk,Note,Item Name,Qty) to create.');
            }
        } else if (state === 'awaiting_confirm_stock_id' && text.match(/^25\d{7}$/)) {
            try {
                const confirmStockId = text;
                const loadingMsg = await ctx.reply('✅ Processing stock adjustment approval...');

                if (!globalState.confirmStockChecker) {
                    globalState.confirmStockChecker = new ConfirmStockChecker(globalState.scraper.page);
                }

                const result = await globalState.confirmStockChecker.approveStockAdjustment(confirmStockId);
                
                if (result.success) {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMsg.message_id,
                        null,
                        `✅ ${result.message}`
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
                console.error('Confirm stock approval error:', error);
                await ctx.reply('⚠️ Error processing stock adjustment approval');
            } finally {
                globalState.userStates.delete(userId);
                await ctx.reply('Select an option:', keyboards.postLoginMenu);
            }
        } else {
            return next(); // Pass to next handler
        }
    });
};
