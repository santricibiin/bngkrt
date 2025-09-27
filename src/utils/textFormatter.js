// Text formatting utilities for consistent small caps styling

// Function to convert text to small caps
function toSmallCaps(text) {
    if (!text) return text;
    
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

// Function to format table headers with small caps
function formatTableHeader(headers) {
    return headers.map(header => toSmallCaps(header));
}

// Function to format data rows with small caps for text content
function formatDataRow(row) {
    return row.map(cell => {
        // Only convert text content to small caps, preserve numbers and special chars
        if (typeof cell === 'string' && !/^\d+(\.\d+)?$/.test(cell)) {
            return toSmallCaps(cell);
        }
        return cell;
    });
}

// Function to format status text consistently
function formatStatus(status) {
    const statusMap = {
        'pending': 'ᴘᴇɴᴅɪɴɢ',
        'completed': 'ᴄᴏᴍᴘʟᴇᴛᴇᴅ',
        'approved': 'ᴀᴘᴘʀᴏᴠᴇᴅ',
        'rejected': 'ʀᴇᴊᴇᴄᴛᴇᴅ',
        'active': 'ᴀᴄᴛɪᴠᴇ',
        'inactive': 'ɪɴᴀᴄᴛɪᴠᴇ',
        'process': 'ᴘʀᴏᴄᴇss',
        'done': 'ᴅᴏɴᴇ',
        'cancel': 'ᴄᴀɴᴄᴇʟ',
        'open': 'ᴏᴘᴇɴ',
        'closed': 'ᴄʟᴏsᴇᴅ'
    };
    
    const lowerStatus = status?.toLowerCase();
    return statusMap[lowerStatus] || toSmallCaps(status || '');
}

// Function to format currency with small caps
function formatCurrency(amount, currency = 'ʀᴘ') {
    return `${currency} ${amount}`;
}

module.exports = {
    toSmallCaps,
    formatTableHeader,
    formatDataRow,
    formatStatus,
    formatCurrency
};
