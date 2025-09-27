const messages = require('../messages/botMessages');
const keyboards = require('../keyboards/inlineKeyboards');

module.exports = (bot) => {
    bot.action('profile', async (ctx) => {
        await ctx.answerCbQuery();
        return ctx.editMessageText(
            messages.profile.replace('{username}', ctx.from.username)
            .replace('{date}', new Date().toLocaleDateString()),
            keyboards.mainMenu
        );
    });

    bot.action('features', async (ctx) => {
        await ctx.answerCbQuery();
        return ctx.editMessageText(
            messages.features,
            keyboards.featuresMenu
        );
    });

    bot.action('main_menu', async (ctx) => {
        await ctx.answerCbQuery();
        return ctx.editMessageText(
            '🎯 ᴍᴀɪɴ ᴍᴇɴᴜ',
            keyboards.getPaginatedMainMenu(1)
        );
    });

    // Handle main menu pagination
    bot.action(/^mainmenu_page_(\d+)$/, async (ctx) => {
        await ctx.answerCbQuery();
        const page = parseInt(ctx.match[1]);
        const pageText = page === 1 ? '🎯 ᴍᴀɪɴ ᴍᴇɴᴜ' : `🎯 ᴍᴀɪɴ ᴍᴇɴᴜ (ʜᴀʟᴀᴍᴀɴ ${page})`;
        
        return ctx.editMessageText(
            pageText + '\n\nsɪʟᴀᴋᴀɴ ᴘɪʟɪʜ ғɪᴛᴜʀ ᴅɪ ʙᴀᴡᴀʜ ɪɴɪ:',
            keyboards.getPaginatedMainMenu(page)
        );
    });

    // Add more action handlers for other buttons
};
