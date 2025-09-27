const { toSmallCaps } = require('../utils/textFormatter');

module.exports = {
    welcome: (username) => `🌟 ᴡᴇʟᴄᴏᴍᴇ ${username}!\n\n✨ ɪ'ᴍ ʏᴏᴜʀ ᴘʀᴇᴍɪᴜᴍ ᴀssɪsᴛᴀɴᴛ ʙᴏᴛ. ʜᴏᴡ ᴄᴀɴ ɪ ʜᴇʟᴘ ʏᴏᴜ ᴛᴏᴅᴀʏ?`,
    profile: '👤 ʏᴏᴜʀ ᴘʀᴏғɪʟᴇ ɪɴғᴏʀᴍᴀᴛɪᴏɴ:\n\n🎭 ᴜsᴇʀɴᴀᴍᴇ: {username}\n📅 ᴊᴏɪɴ ᴅᴀᴛᴇ: {date}',
    features: '✨ ᴀᴠᴀɪʟᴀʙʟᴇ ᴘʀᴇᴍɪᴜᴍ ғᴇᴀᴛᴜʀᴇs:\n\n🎯 ғᴇᴀᴛᴜʀᴇ 1\n🎲 ғᴇᴀᴛᴜʀᴇ 2\n💫 ғᴇᴀᴛᴜʀᴇ 3',
    help: '❓ ɴᴇᴇᴅ ʜᴇʟᴘ? ʜᴇʀᴇ ᴀʀᴇ sᴏᴍᴇ ᴄᴏᴍᴍᴀɴᴅs:\n\n/start - sᴛᴀʀᴛ ᴛʜᴇ ʙᴏᴛ\n/menu - sʜᴏᴡ ᴍᴀɪɴ ᴍᴇɴᴜ\n/help - sʜᴏᴡ ᴛʜɪs ʜᴇʟᴘ ᴍᴇssᴀɢᴇ',
    error: '⚠️ ᴏᴏᴘs! sᴏᴍᴇᴛʜɪɴɢ ᴡᴇɴᴛ ᴡʀᴏɴɢ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ.',
    scraping: {
        start: '🔄 sᴛᴀʀᴛɪɴɢ sᴄʀᴀᴘɪɴɢ ᴘʀᴏᴄᴇss...',
        success: '✅ sᴜᴄᴄᴇssғᴜʟʟʏ ʟᴏɢɢᴇᴅ ɪɴ ᴛᴏ ᴘᴏʀᴛᴀʟ!',
        failed: '❌ ғᴀɪʟᴇᴅ ᴛᴏ ʟᴏɢɪɴ. ᴘʟᴇᴀsᴇ ᴄʜᴇᴄᴋ ᴄᴏᴏᴋɪᴇs.',
        error: '⚠️ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ sᴄʀᴀᴘɪɴɢ'
    }
};
