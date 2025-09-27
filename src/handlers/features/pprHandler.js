const PPRChecker = require('../../services/pprChecker');
const keyboards = require('../../keyboards/inlineKeyboards');

module.exports = (bot, globalState) => {
    // PPR action handler
    bot.action('check_ppr', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ ᴘʟᴇᴀsᴇ ʟᴏɢɪɴ ғɪʀsᴛ!', keyboards.preLoginMenu);
                return;
            }

            const loadingMessage = await ctx.editMessageText('🔄 ғᴇᴛᴄʜɪɴɢ ғʀᴇsʜ ᴘᴘʀ ᴅᴀᴛᴀ...');
            
            // Create new PPRChecker instance only if not exists
            if (!globalState.pprChecker) {
                globalState.pprChecker = new PPRChecker(globalState.scraper.page);
            }
            
            // Force refresh data from web (always get latest data)
            const result = await globalState.pprChecker.fetchPPRData(1, true);

            if (result.success) {
                const message = globalState.pprChecker.formatPPRResult(result.data, result.pagination);
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMessage.message_id,
                    null,
                    message + '\n\n💡 sᴇɴᴅ ᴘᴘʀ ɪᴅ ɴᴜᴍʙᴇʀ ᴛᴏ ᴠɪᴇᴡ ᴅᴇᴛᴀɪʟs',
                    { 
                        ...keyboards.getPPRKeyboard(
                            result.pagination.currentPage,
                            result.pagination.totalPages
                        )
                    }
                );
                
                // Set state to await PPR ID
                globalState.userStates.set(ctx.from.id, 'awaiting_ppr_id');
            } else {
                await ctx.editMessageText('❌ ɴᴏ ᴘᴘʀ ᴅᴀᴛᴀ ғᴏᴜɴᴅ ᴏʀ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ.', keyboards.postLoginMenu);
            }
        } catch (error) {
            console.error('PPR check error:', error);
            await ctx.editMessageText('⚠️ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ғᴇᴛᴄʜɪɴɢ ᴘᴘʀ ᴅᴀᴛᴀ.', keyboards.postLoginMenu);
        }
    });

    // PPR pagination handler
    bot.action(/ppr_page_(\d+)/, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const page = parseInt(ctx.match[1]);
            
            // Use existing pprChecker instance
            if (!globalState.pprChecker) {
                await ctx.editMessageText('❌ ᴘʟᴇᴀsᴇ ғᴇᴛᴄʜ ᴘᴘʀ ᴅᴀᴛᴀ ғɪʀsᴛ!', keyboards.postLoginMenu);
                return;
            }

            // Use cached data for pagination (don't refresh on page navigation)
            const result = await globalState.pprChecker.fetchPPRData(page, false);

            if (result.success) {
                const message = globalState.pprChecker.formatPPRResult(result.data, result.pagination);
                await ctx.editMessageText(message + '\n\n💡 sᴇɴᴅ ᴘᴘʀ ɪᴅ ɴᴜᴍʙᴇʀ ᴛᴏ ᴠɪᴇᴡ ᴅᴇᴛᴀɪʟs', {
                    ...keyboards.getPPRKeyboard(
                        result.pagination.currentPage,
                        result.pagination.totalPages
                    )
                });
                
                // Maintain state for PPR ID input
                globalState.userStates.set(ctx.from.id, 'awaiting_ppr_id');
            }
        } catch (error) {
            console.error('Pagination error:', error);
            await ctx.answerCbQuery('ᴇʀʀᴏʀ ᴄʜᴀɴɢɪɴɢ ᴘᴀɢᴇ');
        }
    });

    // Handle PPR ID input
    bot.on('text', async (ctx, next) => {
        const userId = ctx.from.id;
        const state = globalState.userStates.get(userId);
        const text = ctx.message.text;

        if (state === 'awaiting_ppr_id' && text.match(/^25\d{7}$/)) { // PPR ID format
            try {
                const pprId = text;
                const loadingMsg = await ctx.reply('🔍 ғᴇᴛᴄʜɪɴɢ ᴘᴘʀ ᴅᴇᴛᴀɪʟs...');

                if (!globalState.pprChecker) {
                    globalState.pprChecker = new PPRChecker(globalState.scraper.page);
                }

                await globalState.pprChecker.ensureDataLoaded();
                const result = await globalState.pprChecker.getDetailData(pprId);
                
                if (result && result.type === 'image') {
                    await ctx.replyWithPhoto({ 
                        source: result.data 
                    }, { 
                        caption: result.caption,
                        parse_mode: 'HTML'
                    });
                } else {
                    await ctx.reply('❌ ᴄᴏᴜʟᴅ ɴᴏᴛ ғɪɴᴅ ᴘᴘʀ ᴡɪᴛʜ ᴛʜᴀᴛ ɪᴅ');
                }

                await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
            } catch (error) {
                console.error('PPR detail error:', error);
                await ctx.reply('⚠️ ᴇʀʀᴏʀ ғᴇᴛᴄʜɪɴɢ ᴘᴘʀ ᴅᴇᴛᴀɪʟs');
            } finally {
                globalState.userStates.delete(userId);
                await ctx.reply('sᴇʟᴇᴄᴛ ᴀɴ ᴏᴘᴛɪᴏɴ:', keyboards.postLoginMenu);
            }
        } else {
            return next(); // Pass to next handler
        }
    });
};
