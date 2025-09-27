const messages = require('../messages/botMessages');
const keyboards = require('../keyboards/inlineKeyboards');

module.exports = (bot) => {
    bot.command('start', (ctx) => {
        const username = ctx.from.first_name;
        return ctx.reply(
            messages.welcome(username),
            keyboards.preLoginMenu
        );
    });

    bot.command('menu', (ctx) => {
        return ctx.reply(
            '🎯 ᴍᴀɪɴ ᴍᴇɴᴜ',
            keyboards.getPaginatedMainMenu(1)
        );
    });

    bot.command('help', (ctx) => {
        return ctx.reply(messages.help);
    });
};
