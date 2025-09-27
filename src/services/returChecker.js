const { toSmallCaps, formatTableHeader, formatDataRow, formatStatus } = require('../utils/textFormatter');

class ReturChecker {
    constructor(page) {
        this.page = page;
        this.returUrl = 'https://portal.rajawalielastis.com/bo/transaksi/p_retur';
        this.itemsPerPage = 5;
        this.cachedData = null;
    }

    async fetchReturData(pageNum = 1, forceRefresh = false) {
        try {
            // Use cached data if available and not forcing refresh
            if (this.cachedData && !forceRefresh) {
                console.log('🔄 Using cached Retur data...');
                const totalItems = this.cachedData.length;
                const totalPages = Math.ceil(totalItems / this.itemsPerPage);
                
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
            console.log('🔄 Fetching fresh Retur data from web...');
            await this.page.goto(this.returUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            
            // Set to 100 entries and get all data
            await this.page.waitForSelector('div.dataTables_length select');
            await this.page.select('div.dataTables_length select', '100');
            
            // Wait for table to update
            await new Promise(r => setTimeout(r, 2000));
            
            // Store all data in cache
            this.cachedData = await this.page.evaluate(() => {
                return Array.from(document.querySelectorAll('.table tbody tr'))
                    .map(row => {
                        const cells = row.querySelectorAll('td');
                        return cells.length >= 5 ? {
                            number: cells[1]?.textContent?.trim() || '',
                            plant: cells[2]?.textContent?.trim() || '',
                            date: cells[3]?.textContent?.trim() || '',
                            status: cells[4]?.textContent?.trim() || ''
                        } : null;
                    })
                    .filter(item => item && item.number);
            });

            // Use cached data for pagination
            const totalItems = this.cachedData.length;
            const totalPages = Math.ceil(totalItems / this.itemsPerPage);
            const startIdx = (pageNum - 1) * this.itemsPerPage;
            const endIdx = Math.min(startIdx + this.itemsPerPage, totalItems);

            console.log(`✅ Cached ${totalItems} fresh Retur entries`);
            
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
            console.error('❌ Error fetching Retur data:', error);
            
            // Attempt to get data even if waiting times out
            try {
                console.log('⚠️ Timeout occurred, attempting to get available data...');
                this.cachedData = await this.page.evaluate(() => {
                    return Array.from(document.querySelectorAll('.table tbody tr'))
                        .map(row => {
                            const cells = row.querySelectorAll('td');
                            return {
                                number: cells[1]?.textContent?.trim() || '',
                                plant: cells[2]?.textContent?.trim() || '',
                                date: cells[3]?.textContent?.trim() || '',
                                status: cells[4]?.textContent?.trim() || ''
                            };
                        })
                        .filter(item => item.number);
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

    formatReturResult(data, pagination) {
        if (!data || data.length === 0) return '❌ ɴᴏ ʀᴇᴛᴜʀ ᴅᴀᴛᴀ ғᴏᴜɴᴅ';

        const header = `🔄 ʀᴇᴛᴜʀ ʟɪsᴛ (ᴘᴀɢᴇ ${pagination.currentPage}/${pagination.totalPages})\n` +
                      `sʜᴏᴡɪɴɢ ɪᴛᴇᴍs ${pagination.startItem}-${pagination.endItem} ᴏғ ${pagination.totalItems}\n\n`;
        
        const items = data.map(item => 
            `🔄 ${toSmallCaps(item.number)}\n` +
            `🏢 ${toSmallCaps(item.plant)}\n` +
            `📅 ${toSmallCaps(item.date)}\n` +
            `📊 sᴛᴀᴛᴜs: ${formatStatus(item.status)}`
        ).join('\n\n');

        return header + items;
    }

    async ensureDataLoaded() {
        if (!this.cachedData) {
            await this.fetchReturData(1);
        }
    }

    async getDetailData(returId) {
        try {
            console.log(`🔍 Getting details for Retur ID: ${returId}`);
            
            // Set larger viewport to accommodate modal
            await this.page.setViewport({
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1
            });

            // Click detail button
            const clicked = await this.page.evaluate((id) => {
                const rows = document.querySelectorAll('.table tbody tr');
                for (const row of rows) {
                    const idCell = row.querySelector('td:nth-child(2)');
                    if (idCell?.textContent?.trim() === id) {
                        const detailBtn = row.querySelector('a.detail-doc');
                        if (detailBtn) {
                            detailBtn.click();
                            return true;
                        }
                    }
                }
                return false;
            }, returId);

            if (!clicked) return null;

            // Wait for modal and enhance its appearance
            await this.page.waitForSelector('#DetailModal', { visible: true });
            await this.page.evaluate(() => {
                const modal = document.querySelector('#DetailModal .modal-dialog');
                if (modal) {
                    modal.style.maxWidth = '800px';
                    modal.style.margin = '30px auto';
                    modal.style.backgroundColor = 'white';
                    document.body.style.backgroundColor = 'rgba(0,0,0,0.5)';
                }
            });

            // Wait for all content to load
            await new Promise(r => setTimeout(r, 1000));

            // Get modal dimensions
            const dimensions = await this.page.evaluate(() => {
                const modal = document.querySelector('#DetailModal .modal-content');
                if (!modal) return null;
                const rect = modal.getBoundingClientRect();
                return {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height
                };
            });

            if (!dimensions) return null;

            // Take screenshot of just the modal
            const screenshot = await this.page.screenshot({
                type: 'png',
                clip: {
                    x: dimensions.x,
                    y: dimensions.y,
                    width: dimensions.width,
                    height: dimensions.height
                },
                omitBackground: false
            });

            // Close modal
            await this.page.evaluate(() => {
                const closeBtn = document.querySelector('#DetailModal button.btn-close');
                if (closeBtn) closeBtn.click();
            });

            return {
                type: 'image',
                data: screenshot,
                caption: `🔄 Detail Retur #${returId}`
            };

        } catch (error) {
            console.error('❌ Detail fetch error:', error);
            return null;
        }
    }
}

module.exports = ReturChecker;
