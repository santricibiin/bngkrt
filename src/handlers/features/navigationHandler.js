const keyboards = require('../../keyboards/inlineKeyboards');

module.exports = (bot, globalState) => {
    // Back to Main Menu action handler
    bot.action('back_to_main_menu', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ ᴘʟᴇᴀsᴇ ʟᴏɢɪɴ ғɪʀsᴛ!', keyboards.preLoginMenu);
                return;
            }

            // Clear any existing user state
            globalState.userStates.delete(ctx.from.id);
            
            // Show paginated main menu
            await ctx.editMessageText('🏠 ᴍᴀɪɴ ᴍᴇɴᴜ\n\nsᴇʟᴇᴄᴛ ᴀɴ ᴏᴘᴛɪᴏɴ:', keyboards.getPaginatedMainMenu(1));
            
        } catch (error) {
            console.error('Back to main menu error:', error);
            await ctx.editMessageText('⚠️ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ.', keyboards.getPaginatedMainMenu(1));
        }
    });

    // Handler untuk navigasi halaman menu utama
    bot.action(/mainmenu_page_(\d+)/, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const page = parseInt(ctx.match[1]);
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ ᴘʟᴇᴀsᴇ ʟᴏɢɪɴ ғɪʀsᴛ!', keyboards.preLoginMenu);
                return;
            }
            
            console.log(`🔄 ɴᴀᴠɪɢᴀᴛɪɴɢ ᴛᴏ ᴍᴀɪɴ ᴍᴇɴᴜ ᴘᴀɢᴇ ${page}`);
            await ctx.editMessageText(`🏠 ᴍᴀɪɴ ᴍᴇɴᴜ - ᴘᴀɢᴇ ${page}\n\nsᴇʟᴇᴄᴛ ᴀɴ ᴏᴘᴛɪᴏɴ:`, keyboards.getPaginatedMainMenu(page));
        } catch (error) {
            console.error('ᴍᴀɪɴ ᴍᴇɴᴜ ᴘᴀɢɪɴᴀᴛɪᴏɴ ᴇʀʀᴏʀ:', error);
            await ctx.answerCbQuery('ᴇʀʀᴏʀ ᴄʜᴀɴɢɪɴɢ ᴘᴀɢᴇ');
        }
    });

    // Handle text messages for ID validation
    bot.on('text', async (ctx, next) => {
        const text = ctx.message.text;

        if (text.match(/^25\d{7}$/)) {
            // If no state is set but user sends ID, ask them to select menu first
            if (!globalState.userStates.get(ctx.from.id)) {
                await ctx.reply('📋 Please select PPR List, PRD List, Cash PRD, PB PO/PL, RETUR BRG, or PYSN STOK from the menu first, then send the ID number.', keyboards.postLoginMenu);
                return;
            }
        }
        
        return next(); // Pass to next handler
    });
};
