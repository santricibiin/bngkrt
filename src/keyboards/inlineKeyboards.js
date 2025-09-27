const { Markup } = require('telegraf');

// Function to convert text to small caps
function toSmallCaps(text) {
    const normalToSmallCaps = {
        'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ғ', 'g': 'ɢ', 'h': 'ʜ',
        'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ',
        'q': 'ǫ', 'r': 'ʀ', 's': 's', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x',
        'y': 'ʏ', 'z': 'ᴢ',
        'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ', 'F': 'ғ', 'G': 'ɢ', 'H': 'ʜ',
        'I': 'ɪ', 'J': 'ᴊ', 'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ', 'N': 'ɴ', 'O': 'ᴏ', 'P': 'ᴘ',
        'Q': 'ǫ', 'R': 'ʀ', 'S': 's', 'T': 'ᴛ', 'U': 'ᴜ', 'V': 'ᴠ', 'W': 'ᴡ', 'X': 'x',
        'Y': 'ʏ', 'Z': 'ᴢ'
    };
    
    return text.split('').map(char => normalToSmallCaps[char] || char).join('');
}

const preLoginMenu = Markup.inlineKeyboard([
    [
        Markup.button.callback('🌐 ʟᴏɢɪɴ ᴘᴏʀᴛᴀʟ', 'start_scrape')
    ]
]);

// Define button limits
const BUTTONS_PER_PAGE = 6;
const BUTTONS_PER_ROW = 2;

// List semua fitur utama (label, action)
const mainMenuButtons = [
    { label: '📦 ᴄʜᴇᴄᴋ sᴛᴏᴄᴋ', action: 'check_stock' },
    { label: '📋 ᴘᴘʀ ʟɪsᴛ', action: 'check_ppr' },
    { label: '🏭 ᴘʀᴅ ʟɪsᴛ', action: 'check_production' },
    { label: '💰 ᴄᴀsʜ ᴘʀᴅ', action: 'check_cash_production' },
    { label: '🛒 ᴘʙ ᴘᴏ/ᴘʟ', action: 'check_purchase' },
    { label: '💰 ᴘᴊʟɴ ʟɪsᴛ', action: 'check_sales' },
    { label: '📦 ᴘʏsɴ sᴛᴏᴋ', action: 'check_adjustment' },
    { label: '🔄 ʀᴇᴛᴜʀ ʙʀɢ', action: 'check_retur' },
    { label: '💸 ᴘɪᴜᴛᴀɴɢ', action: 'check_piutang' },
    { label: '📤 ᴀʙsᴇɴsɪ', action: 'check_absensi' },
    { label: '📋 ᴛғ sᴛᴏᴋ', action: 'check_transfer_stock' }
];

// Fungsi umum untuk membuat pagination keyboard
function createPaginatedKeyboard(buttons, page = 1, pageAction, additionalButtons = [], customTotalPages = null) {
    const totalButtons = buttons.length;
    const totalPages = customTotalPages || Math.ceil(totalButtons / BUTTONS_PER_PAGE);
    const startIdx = (page - 1) * BUTTONS_PER_PAGE;
    const endIdx = Math.min(startIdx + BUTTONS_PER_PAGE, totalButtons);

    // Buat baris 2 button sejajar
    const pageButtons = [];
    const sliced = buttons.slice(startIdx, endIdx);
    for (let i = 0; i < sliced.length; i += BUTTONS_PER_ROW) {
        const row = [];
        row.push(Markup.button.callback(sliced[i].label, sliced[i].action));
        if (sliced[i + 1]) {
            row.push(Markup.button.callback(sliced[i + 1].label, sliced[i + 1].action));
        }
        pageButtons.push(row);
    }

    // Navigation row
    const navRow = [];
    if (page > 1) navRow.push(Markup.button.callback('⬅️ ᴘʀᴇᴠ', `${pageAction}_page_${page - 1}`));
    if (page < totalPages) navRow.push(Markup.button.callback('ɴᴇxᴛ ➡️', `${pageAction}_page_${page + 1}`));
    if (navRow.length > 0) pageButtons.push(navRow);

    // Add additional buttons (like back to menu)
    additionalButtons.forEach(btn => {
        pageButtons.push([btn]);
    });

    return Markup.inlineKeyboard(pageButtons);
}

// Menu utama dengan pagination
function getPaginatedMainMenu(page = 1) {
    return createPaginatedKeyboard(mainMenuButtons, page, 'mainmenu');
}

// Redefine postLoginMenu to use pagination
const postLoginMenu = getPaginatedMainMenu(1);

// Generate feature-specific keyboards with pagination
const getPPRKeyboard = (currentPage = 1, totalPages = 1) => {
    return createPaginatedKeyboard(
        [], // Empty array since we're only using pagination
        currentPage,
        'ppr',
        [
            Markup.button.callback('✅ ᴄᴏɴғɪʀᴍ ᴘᴘʀ', 'confirm_ppr'),
            Markup.button.callback('🏠 ʙᴀᴄᴋ ᴛᴏ ᴍᴀɪɴ ᴍᴇɴᴜ', 'back_to_main_menu')
        ],
        totalPages // Pass the totalPages parameter
    );
};

const getProductionKeyboard = (currentPage = 1, totalPages = 1) => {
    return createPaginatedKeyboard(
        [],
        currentPage,
        'production',
        [Markup.button.callback('🏠 ʙᴀᴄᴋ ᴛᴏ ᴍᴀɪɴ ᴍᴇɴᴜ', 'back_to_main_menu')],
        totalPages
    );
};

const getCashProductionKeyboard = (currentPage = 1, totalPages = 1) => {
    return createPaginatedKeyboard(
        [],
        currentPage,
        'cashprd',
        [Markup.button.callback('🏠 ʙᴀᴄᴋ ᴛᴏ ᴍᴀɪɴ ᴍᴇɴᴜ', 'back_to_main_menu')],
        totalPages
    );
};

const getPurchaseKeyboard = (currentPage = 1, totalPages = 1) => {
    return createPaginatedKeyboard(
        [],
        currentPage,
        'purchase',
        [
            Markup.button.callback('➕ ᴛᴀᴍʙᴀʜ ᴛʀx', 'add_purchase_transaction'),
            Markup.button.callback('🏠 ʙᴀᴄᴋ ᴛᴏ ᴍᴀɪɴ ᴍᴇɴᴜ', 'back_to_main_menu')
        ],
        totalPages
    );
};

const getSalesKeyboard = (currentPage = 1, totalPages = 1) => {
    return createPaginatedKeyboard(
        [],
        currentPage,
        'sales',
        [Markup.button.callback('🏠 ʙᴀᴄᴋ ᴛᴏ ᴍᴀɪɴ ᴍᴇɴᴜ', 'back_to_main_menu')],
        totalPages
    );
};

const getAdjustmentKeyboard = (currentPage = 1, totalPages = 1) => {
    return createPaginatedKeyboard(
        [],
        currentPage,
        'adjustment',
        [
            Markup.button.callback('✅ ᴄᴏɴғɪʀᴍ sᴛᴏᴋ', 'check_confirm_stock'),
            Markup.button.callback('🏠 ʙᴀᴄᴋ ᴛᴏ ᴍᴀɪɴ ᴍᴇɴᴜ', 'back_to_main_menu')
        ],
        totalPages
    );
};

const getConfirmStockKeyboard = (currentPage = 1, totalPages = 1) => {
    return createPaginatedKeyboard(
        [],
        currentPage,
        'confirm_stock',
        [Markup.button.callback('🔙 ʙᴀᴄᴋ ᴛᴏ ᴘʏsɴ sᴛᴏᴋ', 'check_adjustment')],
        totalPages
    );
};

const getReturKeyboard = (currentPage = 1, totalPages = 1) => {
    return createPaginatedKeyboard(
        [],
        currentPage,
        'retur',
        [
            Markup.button.callback('✅ ᴄᴏɴғɪʀᴍ ʀᴇᴛᴜʀ', 'confirm_retur'),
            Markup.button.callback('🏠 ʙᴀᴄᴋ ᴛᴏ ᴍᴀɪɴ ᴍᴇɴᴜ', 'back_to_main_menu')
        ],
        totalPages
    );
};

const getAbsensiKeyboard = (currentPage = 1, totalPages = 1) => {
    return createPaginatedKeyboard(
        [],
        currentPage,
        'absensi',
        [
            Markup.button.callback('📸 sᴄʀᴇᴇɴsʜᴏᴛ', 'absensi_screenshot'),
            Markup.button.callback('🏠 ʙᴀᴄᴋ ᴛᴏ ᴍᴀɪɴ ᴍᴇɴᴜ', 'back_to_main_menu')
        ],
        totalPages
    );
};

const getConfirmPPRKeyboard = (currentPage = 1, totalPages = 1) => {
    return createPaginatedKeyboard(
        [],
        currentPage,
        'confirm_ppr',
        [Markup.button.callback('🔙 ʙᴀᴄᴋ ᴛᴏ ᴘᴘʀ ʟɪsᴛ', 'check_ppr')],
        totalPages
    );
};

const getTransferStockKeyboard = (currentPage = 1, totalPages = 1) => {
    return createPaginatedKeyboard(
        [],
        currentPage,
        'transfer_stock',
        [
            Markup.button.callback('➕ ᴛᴀᴍʙᴀʜ ᴛʀᴀɴsғᴇʀ', 'add_transfer_stock'),
            Markup.button.callback('🏠 ʙᴀᴄᴋ ᴛᴏ ᴍᴀɪɴ ᴍᴇɴᴜ', 'back_to_main_menu')
        ],
        totalPages
    );
};

module.exports = {
    preLoginMenu,
    postLoginMenu,
    getPPRKeyboard,
    getProductionKeyboard,
    getCashProductionKeyboard,
    getPurchaseKeyboard,
    getSalesKeyboard,
    getAdjustmentKeyboard,
    getConfirmStockKeyboard,
    getReturKeyboard,
    getAbsensiKeyboard,
    getConfirmPPRKeyboard,
    getTransferStockKeyboard,
    getPaginatedMainMenu,
    toSmallCaps
};
      


