const ReturChecker = require('../../services/returChecker');
const ConfirmReturChecker = require('../../services/confirmReturChecker');
const keyboards = require('../../keyboards/inlineKeyboards');

module.exports = (bot, globalState) => {
    // Retur action handler
    bot.action('check_retur', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ Please login first!', keyboards.preLoginMenu);
                return;
            }

            const loadingMessage = await ctx.editMessageText('🔄 Fetching fresh Retur data...');
            
            // Create new ReturChecker instance only if not exists
            if (!globalState.returChecker) {
                globalState.returChecker = new ReturChecker(globalState.scraper.page);
            }
            
            // Force refresh data from web (always get latest data)
            const result = await globalState.returChecker.fetchReturData(1, true);

            if (result.success) {
                const message = globalState.returChecker.formatReturResult(result.data, result.pagination);
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMessage.message_id,
                    null,
                    message + '\n\n💡 Send Retur ID number to view details',
                    { 
                        ...keyboards.getReturKeyboard(
                            result.pagination.currentPage,
                            result.pagination.totalPages
                        )
                    }
                );
                
                // Set state to await Retur ID
                globalState.userStates.set(ctx.from.id, 'awaiting_retur_id');
            } else {
                await ctx.editMessageText('❌ No Retur data found or error occurred.', keyboards.postLoginMenu);
            }
        } catch (error) {
            console.error('Retur check error:', error);
            await ctx.editMessageText('⚠️ Error occurred while fetching Retur data.', keyboards.postLoginMenu);
        }
    });

    // Retur pagination handler
    bot.action(/retur_page_(\d+)/, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const page = parseInt(ctx.match[1]);
            
            // Use existing returChecker instance
            if (!globalState.returChecker) {
                await ctx.editMessageText('❌ Please fetch Retur data first!', keyboards.postLoginMenu);
                return;
            }

            // Use cached data for pagination (don't refresh on page navigation)
            const result = await globalState.returChecker.fetchReturData(page, false);

            if (result.success) {
                const message = globalState.returChecker.formatReturResult(result.data, result.pagination);
                await ctx.editMessageText(message + '\n\n💡 Send Retur ID number to view details', {
                    ...keyboards.getReturKeyboard(
                        result.pagination.currentPage,
                        result.pagination.totalPages
                    )
                });
                
                // Maintain state for Retur ID input
                globalState.userStates.set(ctx.from.id, 'awaiting_retur_id');
            }
        } catch (error) {
            console.error('Retur pagination error:', error);
            await ctx.answerCbQuery('Error changing page');
        }
    });

    // Confirm Retur action handler
    bot.action('confirm_retur', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ Please login first!', keyboards.preLoginMenu);
                return;
            }

            // Set state to await retur ID for confirmation
            globalState.userStates.set(ctx.from.id, 'awaiting_confirm_retur_id');
            
            const instructionMessage = `✅ Konfirmasi Retur Barang\n\n` +
                                     `📝 Kirim ID Retur yang ingin dikonfirmasi\n\n` +
                                     `📄 Contoh: 250800025\n\n` +
                                     `⚠️ Pastikan ID retur dalam status "Terkirim" untuk bisa dikonfirmasi`;
            
            await ctx.editMessageText(instructionMessage);
            
        } catch (error) {
            console.error('Confirm retur action error:', error);
            await ctx.editMessageText('⚠️ Error occurred. Please try again.', keyboards.postLoginMenu);
        }
    });

    // Handle Retur ID input and confirm retur ID input
    bot.on('text', async (ctx, next) => {
        const userId = ctx.from.id;
        const state = globalState.userStates.get(userId);
        const text = ctx.message.text;

        if (state === 'awaiting_retur_id' && text.match(/^25\d{7}$/)) { // Retur ID format
            try {
                const returId = text;
                const loadingMsg = await ctx.reply('🔄 Fetching Retur details...');

                if (!globalState.returChecker) {
                    globalState.returChecker = new ReturChecker(globalState.scraper.page);
                }

                await globalState.returChecker.ensureDataLoaded();
                const result = await globalState.returChecker.getDetailData(returId);
                
                if (result && result.type === 'image') {
                    await ctx.replyWithPhoto({ 
                        source: result.data 
                    }, { 
                        caption: result.caption,
                        parse_mode: 'HTML'
                    });
                } else {
                    await ctx.reply('❌ Could not find Retur with that ID');
                }

                await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
            } catch (error) {
                console.error('Retur detail error:', error);
                await ctx.reply('⚠️ Error fetching Retur details');
            } finally {
                globalState.userStates.delete(userId);
                await ctx.reply('Select an option:', keyboards.postLoginMenu);
            }
        } else if (state === 'awaiting_confirm_retur_id' && text.match(/^25\d{7}$/)) {
            try {
                const returId = text;
                const loadingMsg = await ctx.reply('✅ Processing retur confirmation...');

                if (!globalState.confirmReturChecker) {
                    globalState.confirmReturChecker = new ConfirmReturChecker(globalState.scraper.page);
                }

                const result = await globalState.confirmReturChecker.confirmReturTransaction(returId);
                
                if (result.success) {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMsg.message_id,
                        null,
                        `✅ ${result.message}\n\n${result.modalClosed ? '🎉 Retur has been confirmed successfully!' : '⚠️ Please verify the confirmation in the portal.'}`
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
                console.error('Confirm retur error:', error);
                await ctx.reply('⚠️ Error processing retur confirmation');
            } finally {
                globalState.userStates.delete(userId);
                await ctx.reply('Select an option:', keyboards.postLoginMenu);
            }
        } else {
            return next(); // Pass to next handler
        }
    });
};
