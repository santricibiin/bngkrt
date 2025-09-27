const AbsensiChecker = require('../../services/absensiChecker');
const keyboards = require('../../keyboards/inlineKeyboards');

module.exports = (bot, globalState) => {
    // Absensi action handler
    bot.action('check_absensi', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ Please login first!', keyboards.preLoginMenu);
                return;
            }

            const loadingMessage = await ctx.editMessageText('🔄 Fetching fresh Absensi data...');
            
            // Create new AbsensiChecker instance only if not exists
            if (!globalState.absensiChecker) {
                globalState.absensiChecker = new AbsensiChecker(globalState.scraper.page);
            }
            
            // Force refresh data from web (always get latest data)
            const result = await globalState.absensiChecker.fetchAbsensiData(1, true);

            if (result.success) {
                const message = globalState.absensiChecker.formatAbsensiResult(result.data, result.pagination);
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMessage.message_id,
                    null,
                    message,
                    { 
                        ...keyboards.getAbsensiKeyboard(
                            result.pagination.currentPage,
                            result.pagination.totalPages
                        )
                    }
                );
            } else {
                await ctx.editMessageText('❌ No Absensi data found or error occurred.', keyboards.postLoginMenu);
            }
        } catch (error) {
            console.error('Absensi check error:', error);
            await ctx.editMessageText('⚠️ Error occurred while fetching Absensi data.', keyboards.postLoginMenu);
        }
    });

    // Absensi pagination handler
    bot.action(/absensi_page_(\d+)/, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const page = parseInt(ctx.match[1]);
            
            // Use existing absensiChecker instance
            if (!globalState.absensiChecker) {
                await ctx.editMessageText('❌ Please fetch Absensi data first!', keyboards.postLoginMenu);
                return;
            }

            // Use cached data for pagination (don't refresh on page navigation)
            const result = await globalState.absensiChecker.fetchAbsensiData(page, false);

            if (result.success) {
                const message = globalState.absensiChecker.formatAbsensiResult(result.data, result.pagination);
                await ctx.editMessageText(message, {
                    ...keyboards.getAbsensiKeyboard(
                        result.pagination.currentPage,
                        result.pagination.totalPages
                    )
                });
            }
        } catch (error) {
            console.error('Absensi pagination error:', error);
            await ctx.answerCbQuery('Error changing page');
        }
    });

    // Absensi screenshot handler
    bot.action('absensi_screenshot', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ Please login first!', keyboards.preLoginMenu);
                return;
            }

            const loadingMsg = await ctx.reply('📸 Taking Absensi dashboard screenshot...');

            if (!globalState.absensiChecker) {
                globalState.absensiChecker = new AbsensiChecker(globalState.scraper.page);
            }

            const result = await globalState.absensiChecker.getAbsensiScreenshot();
            
            if (result && result.type === 'image') {
                await ctx.replyWithPhoto({ 
                    source: result.data 
                }, { 
                    caption: result.caption,
                    parse_mode: 'HTML'
                });
            } else {
                await ctx.reply('❌ Could not take screenshot of Absensi dashboard');
            }

            await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
        } catch (error) {
            console.error('Absensi screenshot error:', error);
            await ctx.reply('⚠️ Error taking Absensi screenshot');
        }
    });
};
