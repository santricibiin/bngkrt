const ConfirmPPRChecker = require('../../services/confirmPPRChecker');
const keyboards = require('../../keyboards/inlineKeyboards');
const { Markup } = require('telegraf');

module.exports = (bot, globalState) => {
    // Confirm PPR action handler
    bot.action('confirm_ppr', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ Please login first!', keyboards.preLoginMenu);
                return;
            }

            const loadingMessage = await ctx.editMessageText('🔄 ғᴇᴛᴄʜɪɴɢ ᴘᴇɴᴅɪɴɢ ᴘᴘʀ ᴄᴏɴғɪʀᴍᴀᴛɪᴏɴs...');
            
            // Create new ConfirmPPRChecker instance only if not exists
            if (!globalState.confirmPPRChecker) {
                console.log('✅ Creating new ConfirmPPRChecker instance');
                globalState.confirmPPRChecker = new ConfirmPPRChecker(globalState.scraper.page);
            } else {
                console.log('✅ Using existing ConfirmPPRChecker instance');
            }
            
            console.log('✅ ConfirmPPRChecker instance ready, fetching data...');
            // Force refresh data from web (always get latest data)
            const result = await globalState.confirmPPRChecker.fetchPendingPPRData(1, true);

            if (result.success) {
                console.log(`✅ Successfully fetched ${result.data.length} pending PPR items`);
                console.log(`✅ Total cached items: ${result.pagination.totalItems}`);
                console.log(`✅ Total pages: ${result.pagination.totalPages}`);
                
                const message = globalState.confirmPPRChecker.formatPendingPPRResult(result.data, result.pagination);
                
                // CREATE KEYBOARD MANUALLY INSTEAD OF USING THE FUNCTION
                const keyboard = Markup.inlineKeyboard([
                    // Navigation buttons
                    ...(result.pagination.totalPages > 1 ? [[
                        ...(result.pagination.currentPage > 1 ? [Markup.button.callback('⬅️ Prev', `confirm_ppr_page_${result.pagination.currentPage - 1}`)] : []),
                        ...(result.pagination.currentPage < result.pagination.totalPages ? [Markup.button.callback('Next ➡️', `confirm_ppr_page_${result.pagination.currentPage + 1}`)] : [])
                    ]] : []),
                    // Back to PPR menu button
                    [Markup.button.callback('🔙 ʙᴀᴄᴋ ᴛᴏ ᴘᴘʀ ʟɪsᴛ', 'check_ppr')]
                ]);
                
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMessage.message_id,
                    null,
                    message,
                    keyboard
                );
                
                // Set state to await PPR ID for confirmation
                globalState.userStates.set(ctx.from.id, 'awaiting_confirm_ppr_id');
            } else {
                console.log('❌ Failed to fetch pending PPR data:', result.error);
                await ctx.editMessageText('❌ No pending PPR confirmations found.', keyboards.getPPRKeyboard(1, 1));
            }
        } catch (error) {
            console.error('Confirm PPR check error:', error);
            await ctx.editMessageText('⚠️ Error occurred while fetching pending PPR data.', keyboards.getPPRKeyboard(1, 1));
        }
    });

    // Confirm PPR pagination handler
    bot.action(/confirm_ppr_page_(\d+)/, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const page = parseInt(ctx.match[1]);
            
            // Use existing confirmPPRChecker instance
            if (!globalState.confirmPPRChecker) {
                await ctx.editMessageText('❌ Please fetch pending PPR data first!', keyboards.getPPRKeyboard(1, 1));
                return;
            }

            // Use cached data for pagination (don't refresh on page navigation)
            const result = await globalState.confirmPPRChecker.fetchPendingPPRData(page, false);

            if (result.success) {
                const message = globalState.confirmPPRChecker.formatPendingPPRResult(result.data, result.pagination);
                
                // CREATE KEYBOARD MANUALLY INSTEAD OF USING THE FUNCTION
                const keyboard = Markup.inlineKeyboard([
                    // Navigation buttons
                    ...(result.pagination.totalPages > 1 ? [[
                        ...(result.pagination.currentPage > 1 ? [Markup.button.callback('⬅️ Prev', `confirm_ppr_page_${result.pagination.currentPage - 1}`)] : []),
                        ...(result.pagination.currentPage < result.pagination.totalPages ? [Markup.button.callback('Next ➡️', `confirm_ppr_page_${result.pagination.currentPage + 1}`)] : [])
                    ]] : []),
                    // Back to PPR menu button
                    [Markup.button.callback('🔙 ʙᴀᴄᴋ ᴛᴏ ᴘᴘʀ ʟɪsᴛ', 'check_ppr')]
                ]);
                
                await ctx.editMessageText(message, keyboard);
                
                // Maintain state for PPR ID input
                globalState.userStates.set(ctx.from.id, 'awaiting_confirm_ppr_id');
            }
        } catch (error) {
            console.error('Confirm PPR pagination error:', error);
            await ctx.answerCbQuery('Error changing page');
        }
    });

    // Handle Confirm PPR ID input and delivery data
    bot.on('text', async (ctx, next) => {
        const userId = ctx.from.id;
        const state = globalState.userStates.get(userId);
        const text = ctx.message.text;

        if (state === 'awaiting_confirm_ppr_id' && text.match(/^25\d{7}$/)) {
            try {
                const pprId = text;
                const loadingMsg = await ctx.reply('🔍 Processing PPR confirmation...');

                if (!globalState.confirmPPRChecker) {
                    globalState.confirmPPRChecker = new ConfirmPPRChecker(globalState.scraper.page);
                }

                const result = await globalState.confirmPPRChecker.processPPRConfirmation(pprId);
                
                if (result.success) {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMsg.message_id,
                        null,
                        result.message
                    );
                    
                    // Set state to await delivery data
                    globalState.confirmPPRChecker.waitingForDeliveryData = true;
                    globalState.userStates.set(ctx.from.id, 'awaiting_delivery_data');
                } else {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMsg.message_id,
                        null,
                        `❌ ${result.error}`
                    );
                    globalState.userStates.delete(userId);
                    await ctx.reply('Select an option:', keyboards.postLoginMenu);
                }

            } catch (error) {
                console.error('PPR confirmation error:', error);
                await ctx.reply('⚠️ Error processing PPR confirmation');
                globalState.userStates.delete(userId);
                await ctx.reply('Select an option:', keyboards.postLoginMenu);
            }
        } else if (state === 'awaiting_delivery_data' && globalState.confirmPPRChecker && globalState.confirmPPRChecker.waitingForDeliveryData) {
            try {
                const deliveryData = text;
                const loadingMsg = await ctx.reply('📝 Filling delivery data...');

                const result = await globalState.confirmPPRChecker.fillDeliveryData(deliveryData);
                
                if (result.success) {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMsg.message_id,
                        null,
                        result.message
                    );
                    
                    // Reset state
                    globalState.confirmPPRChecker.resetState();
                } else {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMsg.message_id,
                        null,
                        `❌ ${result.error}`
                    );
                }

            } catch (error) {
                console.error('Delivery data filling error:', error);
                await ctx.reply('⚠️ Error filling delivery data');
            } finally {
                globalState.userStates.delete(userId);
                await ctx.reply('Select an option:', keyboards.postLoginMenu);
            }
        } else {
            return next(); // Pass to next handler
        }
    });
};
