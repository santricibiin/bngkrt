const { toSmallCaps, formatTableHeader, formatDataRow, formatStatus } = require('../utils/textFormatter');

class SalesChecker {
    constructor(page) {
        this.page = page;
        this.salesUrl = 'https://portal.rajawalielastis.com/bo/report/penjualan';
        this.itemsPerPage = 5; // Show 5 stores per telegram message
        this.cachedData = null;
    }

    async fetchSalesData(pageNum = 1, forceRefresh = false) {
        try {
            // Use cached data if available and not forcing refresh
            if (this.cachedData && !forceRefresh) {
                console.log('💰 Using cached Sales data...');
                const totalItems = this.cachedData.length;
                const totalPages = Math.ceil(totalItems / this.itemsPerPage);
                
                // Ensure valid page number
                pageNum = Math.max(1, Math.min(pageNum, totalPages));
                
                const startIdx = (pageNum - 1) * this.itemsPerPage;
                const endIdx = Math.min(startIdx + this.itemsPerPage, totalItems);
                
                return {
                    success: true,
                    data: this.cachedData.slice(startIdx, endIdx),
                    pagination: {
                        currentPage: pageNum,
                        totalPages,
                        totalItems,
                        startItem: startIdx + 1,
                        endItem: endIdx
                    }
                };
            }

            // Fetch fresh data from web (first time or forced refresh)
            console.log('💰 Fetching fresh Sales data from web...');
            await this.page.goto(this.salesUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Wait for page to load completely
            await new Promise(r => setTimeout(r, 3000));

            // Set date range to today (if form exists)
            const today = new Date().toISOString().split('T')[0];
            try {
                await this.page.waitForSelector('#tanggal1', { timeout: 5000 });
                await this.page.$eval('#tanggal1', (el, date) => el.value = date, today);
                await this.page.$eval('#tanggal2', (el, date) => el.value = date, today);
                // Set type to "Rekap"
                await this.page.select('#Type_Update', 'Rekap');
                console.log('✅ Date range and type set');
            } catch (dateError) {
                console.log('⚠️ Form fields not found, continuing...');
            }

            // Klik tombol cari untuk memuat data
            console.log('🔍 Clicking search button...');
            const searchClicked = await this.page.evaluate(() => {
                const submitBtn = document.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.click();
                    return true;
                }
                return false;
            });

            if (searchClicked) {
                console.log('✅ Search button clicked, waiting for data...');
                // Wait for data to load after search
                await new Promise(r => setTimeout(r, 5000));
            } else {
                console.log('⚠️ Search button not found, proceeding with existing data...');
            }

            // Extract sales data from tables - based on actual HTML structure
            this.cachedData = await this.page.evaluate(() => {
                const results = [];
                
                // Look for cards containing sales data
                const cards = document.querySelectorAll('.card');
                
                cards.forEach(card => {
                    // Get store name from card header
                    const cardHeader = card.querySelector('.card-header .card-title');
                    let storeName = '';
                    
                    if (cardHeader) {
                        const headerText = cardHeader.textContent?.trim() || '';
                        // Extract store name from "Rekap Penjualan - Toko Fadillah Soreang"
                        const storeMatch = headerText.match(/Rekap Penjualan\s*-\s*(.+)/);
                        if (storeMatch) {
                            storeName = storeMatch[1].trim();
                        }
                    }
                    
                    if (storeName) {
                        // Look for table footer with totals
                        const table = card.querySelector('.table');
                        let totalPenjualan = 'Rp. 0';
                        let totalCash = 'Rp. 0';
                        let totalPiutang = 'Rp. 0';
                        let totalTransfer = 'Rp. 0';
                        
                        if (table) {
                            // Get tfoot rows with totals
                            const tfootRows = Array.from(table.querySelectorAll('tfoot tr'));
                            
                            tfootRows.forEach(row => {
                                const cells = row.querySelectorAll('td');
                                if (cells.length >= 8) {
                                    const labelCell = cells[1]?.textContent?.trim() || '';
                                    
                                    // Look for specific total rows based on label in second column
                                    if (labelCell === 'Total Penjualan') {
                                        totalPenjualan = cells[7]?.textContent?.trim() || 'Rp. 0';
                                    } else if (labelCell === 'Total Cash') {
                                        totalCash = cells[7]?.textContent?.trim() || 'Rp. 0';
                                    } else if (labelCell === 'Total Piutang') {
                                        totalPiutang = cells[7]?.textContent?.trim() || 'Rp. 0';
                                    } else if (labelCell === 'Total Transfer') {
                                        totalTransfer = cells[7]?.textContent?.trim() || 'Rp. 0';
                                    }
                                }
                            });
                        }
                        
                        // Add store data - include stores even with Rp. 0 for completeness
                        results.push({
                            storeName: storeName,
                            date: new Date().toLocaleDateString('id-ID'),
                            totalPenjualan: totalPenjualan,
                            totalCash: totalCash,
                            totalPiutang: totalPiutang,
                            totalTransfer: totalTransfer
                        });
                    }
                });

                return results;
            });

            // Use cached data for pagination
            const totalItems = this.cachedData.length;
            const totalPages = Math.ceil(totalItems / this.itemsPerPage);
            const startIdx = (pageNum - 1) * this.itemsPerPage;
            const endIdx = Math.min(startIdx + this.itemsPerPage, totalItems);

            console.log(`✅ Cached ${totalItems} Sales entries`);
            
            return {
                success: true,
                data: this.cachedData.slice(startIdx, endIdx),
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalItems,
                    startItem: startIdx + 1,
                    endItem: endIdx
                }
            };
        } catch (error) {
            console.error('❌ Error fetching Sales data:', error);
            
            // Attempt to get data even if waiting times out
            try {
                console.log('⚠️ Timeout occurred, attempting to get available data...');
                this.cachedData = await this.page.evaluate(() => {
                    const results = [];
                    const cards = document.querySelectorAll('.card');
                    
                    cards.forEach(card => {
                        const cardHeader = card.querySelector('.card-header .card-title');
                        if (cardHeader && cardHeader.textContent.includes('Rekap Penjualan')) {
                            const headerText = cardHeader.textContent.trim();
                            const storeMatch = headerText.match(/Rekap Penjualan\s*-\s*(.+)/);
                            if (storeMatch) {
                                const storeName = storeMatch[1].trim();
                                results.push({
                                    storeName: storeName,
                                    date: new Date().toLocaleDateString('id-ID'),
                                    totalPenjualan: 'Rp. 0',
                                    totalCash: 'Rp. 0',
                                    totalPiutang: 'Rp. 0',
                                    totalTransfer: 'Rp. 0'
                                });
                            }
                        }
                    });
                    
                    return results;
                });

                if (this.cachedData && this.cachedData.length > 0) {
                    const totalItems = this.cachedData.length;
                    const startIdx = (pageNum - 1) * this.itemsPerPage;
                    const endIdx = Math.min(startIdx + this.itemsPerPage, totalItems);
                    
                    return {
                        success: true,
                        data: this.cachedData.slice(startIdx, endIdx),
                        pagination: {
                            currentPage: pageNum,
                            totalPages: Math.ceil(totalItems / this.itemsPerPage),
                            totalItems: totalItems,
                            startItem: startIdx + 1,
                            endItem: endIdx
                        }
                    };
                }
            } catch (fallbackError) {
                console.error('❌ Fallback attempt failed:', fallbackError);
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    formatSalesResult(data, pagination) {
        if (!data || data.length === 0) return '❌ ɴᴏ sᴀʟᴇs ᴅᴀᴛᴀ ғᴏᴜɴᴅ';

        const today = new Date().toLocaleDateString('id-ID');
        const header = `💰 sᴀʟᴇs ʀᴇᴘᴏʀᴛ - ${today}\n` +
                      `(ᴘᴀɢᴇ ${pagination.currentPage}/${pagination.totalPages})\n` +
                      `sʜᴏᴡɪɴɢ ${pagination.startItem}-${pagination.endItem} ᴏғ ${pagination.totalItems} sᴛᴏʀᴇs\n\n`;
        
        const items = data.map(item => 
            `🏪 ${toSmallCaps(item.storeName)}\n` +
            `📅 ${toSmallCaps(item.date)}\n` +
            `💰 ᴛᴏᴛᴀʟ ᴘᴇɴᴊᴜᴀʟᴀɴ: ${item.totalPenjualan}\n` +
            `💵 ᴛᴏᴛᴀʟ ᴄᴀsʜ: ${item.totalCash}\n` +
            `🏦 ᴛᴏᴛᴀʟ ᴘɪᴜᴛᴀɴɢ: ${item.totalPiutang}\n` +
            `💳 ᴛᴏᴛᴀʟ ᴛʀᴀɴsғᴇʀ: ${item.totalTransfer}`
        ).join('\n\n');

        return header + items;
    }

    async ensureDataLoaded() {
        if (!this.cachedData) {
            await this.fetchSalesData(1);
        }
    }
}



module.exports = SalesChecker;
