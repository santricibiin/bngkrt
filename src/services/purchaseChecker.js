const { toSmallCaps, formatTableHeader, formatDataRow, formatStatus } = require('../utils/textFormatter');

class PurchaseChecker {
    constructor(page) {
        this.page = page;
        this.purchaseUrl = 'https://portal.rajawalielastis.com/bo/transaksi/pembelian';
        this.itemsPerPage = 5; // Show 5 items per telegram message
        this.cachedData = null;
        this.lastCheckedData = null; // Store last checked data for comparison
    }

    async fetchPurchaseData(pageNum = 1) {
        try {
            // Use cached data if available
            if (this.cachedData) {
                console.log('🛒 Using cached Purchase data...');
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

            // First time only: fetch from web
            console.log('🛒 First time fetching Purchase data...');
            await this.page.goto(this.purchaseUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            
            // Set to 100 entries and get all data
            await this.page.waitForSelector('div.dataTables_length select');
            await this.page.select('div.dataTables_length select', '100');
            
            // Wait for table to update
            await new Promise(r => setTimeout(r, 2000));
            
            // Store all data in cache - sesuai dengan struktur tabel dari HTML
            this.cachedData = await this.page.evaluate(() => {
                return Array.from(document.querySelectorAll('#data-transaction tbody tr'))
                    .map(row => {
                        const cells = row.querySelectorAll('td');
                        return cells.length >= 7 ? {
                            number: cells[1]?.textContent?.trim() || '',
                            supplier: cells[2]?.textContent?.trim() || '',
                            date: cells[3]?.textContent?.trim() || '',
                            type: cells[4]?.textContent?.trim() || '',
                            status: cells[5]?.textContent?.trim() || ''
                        } : null;
                    })
                    .filter(item => item && item.number);
            });

            // Use cached data for pagination
            const totalItems = this.cachedData.length;
            const totalPages = Math.ceil(totalItems / this.itemsPerPage);
            const startIdx = (pageNum - 1) * this.itemsPerPage;
            const endIdx = Math.min(startIdx + this.itemsPerPage, totalItems);

            console.log(`✅ Cached ${totalItems} Purchase entries`);
            
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
            console.error('❌ Error fetching Purchase data:', error);
            
            // Attempt to get data even if waiting times out
            try {
                console.log('⚠️ Timeout occurred, attempting to get available data...');
                this.cachedData = await this.page.evaluate(() => {
                    return Array.from(document.querySelectorAll('#data-transaction tbody tr'))
                        .map(row => {
                            const cells = row.querySelectorAll('td');
                            return {
                                number: cells[1]?.textContent?.trim() || '',
                                supplier: cells[2]?.textContent?.trim() || '',
                                date: cells[3]?.textContent?.trim() || '',
                                type: cells[4]?.textContent?.trim() || '',
                                status: cells[5]?.textContent?.trim() || ''
                            };
                        })
                        .filter(item => item.number && item.supplier);
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

    formatPurchaseResult(data, pagination) {
        if (!data || data.length === 0) return '❌ ɴᴏ ᴘᴜʀᴄʜᴀsᴇ ᴅᴀᴛᴀ ғᴏᴜɴᴅ';

        const header = `🛒 ᴘᴜʀᴄʜᴀsᴇ ʟɪsᴛ (ᴘᴀɢᴇ ${pagination.currentPage}/${pagination.totalPages})\n` +
                      `sʜᴏᴡɪɴɢ ɪᴛᴇᴍs ${pagination.startItem}-${pagination.endItem} ᴏғ ${pagination.totalItems}\n\n`;
        
        const items = data.map(item => 
            `🛒 ${toSmallCaps(item.number)}\n` +
            `🏢 ${toSmallCaps(item.supplier)}\n` +
            `📅 ${toSmallCaps(item.date)}\n` +
            `🏷️ ᴛʏᴘᴇ: ${toSmallCaps(item.type)}\n` +
            `📊 sᴛᴀᴛᴜs: ${formatStatus(item.status)}`
        ).join('\n\n');

        return header + items;
    }

    async ensureDataLoaded() {
        if (!this.cachedData) {
            await this.fetchPurchaseData(1);
        }
    }

    async getPurchaseDetail(purchaseId) {
        try {
            console.log(`🔍 Getting details for Purchase ID: ${purchaseId}`);
            
            // Set larger viewport to accommodate modal - same as PPR
            await this.page.setViewport({
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1
            });

            // Click detail button - berdasarkan HTML yang diberikan
            const clicked = await this.page.evaluate((id) => {
                const rows = document.querySelectorAll('#data-transaction tbody tr');
                for (const row of rows) {
                    const idCell = row.querySelector('td:nth-child(2)'); // No ID column
                    const idLink = idCell?.querySelector('a');
                    if (idLink?.textContent?.trim() === id) {
                        // Look for detail button in the Opsi column (last column)
                        const opsiCell = row.querySelector('td:last-child');
                        if (opsiCell) {
                            // Look for detail button with bx-detail icon
                            const detailBtn = opsiCell.querySelector('a[title="Detail"], .bx-detail');
                            if (detailBtn) {
                                detailBtn.click();
                                return true;
                            }
                            
                            // Fallback to last button in the group (detail button)
                            const buttons = opsiCell.querySelectorAll('a.btn');
                            if (buttons.length > 0) {
                                const lastBtn = buttons[buttons.length - 1]; // Detail button is usually last
                                lastBtn.click();
                                return true;
                            }
                        }
                    }
                }
                return false;
            }, purchaseId);

            if (!clicked) {
                console.log('❌ Detail button not found for ID:', purchaseId);
                return null;
            }

            // Wait for modal or page navigation - similar to PPR
            console.log('⌛ Waiting for modal or page to load...');
            try {
                await Promise.race([
                    this.page.waitForSelector('#DetailModal, .modal', { 
                        visible: true,
                        timeout: 10000 
                    }),
                    this.page.waitForNavigation({ 
                        waitUntil: 'networkidle0',
                        timeout: 15000 
                    })
                ]);
            } catch (waitError) {
                console.log('⚠️ Timeout waiting for modal/navigation, proceeding...');
            }
            
            // Wait for content to fully load
            await new Promise(r => setTimeout(r, 3000));

            // Check if modal opened (like PPR)
            const modalExists = await this.page.$('#DetailModal, .modal');
            if (modalExists) {
                console.log('📸 Taking modal screenshot (PPR style)...');
                
                // Enhance modal appearance - same as PPR
                await this.page.evaluate(() => {
                    const modal = document.querySelector('#DetailModal .modal-dialog, .modal .modal-dialog');
                    if (modal) {
                        modal.style.maxWidth = '800px';
                        modal.style.margin = '30px auto';
                        modal.style.backgroundColor = 'white';
                        document.body.style.backgroundColor = 'rgba(0,0,0,0.5)';
                    }
                });

                // Wait for modal styling
                await new Promise(r => setTimeout(r, 1000));

                // Get modal dimensions - same as PPR
                const dimensions = await this.page.evaluate(() => {
                    const modal = document.querySelector('#DetailModal .modal-content, .modal .modal-content');
                    if (!modal) return null;
                    const rect = modal.getBoundingClientRect();
                    return {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height
                    };
                });

                if (!dimensions) {
                    console.log('❌ Modal dimensions not found');
                    return null;
                }

                // Take screenshot of modal - same as PPR
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

                // Close modal - same as PPR
                await this.page.evaluate(() => {
                    const closeBtn = document.querySelector('#DetailModal button.btn-close, .modal .btn-close, .modal .close');
                    if (closeBtn) closeBtn.click();
                });

                console.log('✅ Purchase modal screenshot captured');
                return {
                    type: 'image',
                    data: screenshot,
                    caption: `🛒 Detail Purchase #${purchaseId}`
                };
            }

            // Check if navigated to detail page
            const currentUrl = this.page.url();
            if (currentUrl.includes('pembelian') && !currentUrl.endsWith('/pembelian')) {
                console.log('📸 Taking page screenshot (fallback)...');
                
                // Take full page screenshot as fallback
                const screenshot = await this.page.screenshot({
                    type: 'png',
                    fullPage: true,
                    omitBackground: false
                });

                // Navigate back to purchase list
                await this.page.goto(this.purchaseUrl, {
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });

                console.log('✅ Purchase page screenshot captured');
                return {
                    type: 'image',
                    data: screenshot,
                    caption: `🛒 Detail Purchase #${purchaseId}`
                };
            }

            console.log('❌ No modal or detail page found');
            return null;

        } catch (error) {
            console.error('❌ Purchase detail fetch error:', error);
            // Try to navigate back to purchase list if error occurs
            try {
                await this.page.goto(this.purchaseUrl, {
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });
            } catch (navError) {
                console.error('❌ Error navigating back to purchase list:', navError);
            }
            return null;
        }
    }

    async checkNewPurchases() {
        try {
            console.log('🔍 Checking for new purchases...');
            await this.page.goto(this.purchaseUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            
            // Get current purchases
            const currentData = await this.page.evaluate(() => {
                return Array.from(document.querySelectorAll('.table tbody tr'))
                    .map(row => {
                        const cells = row.querySelectorAll('td');
                        return {
                            number: cells[1]?.textContent.trim() || '',
                            supplier: cells[2]?.textContent.trim() || '',
                            date: cells[3]?.textContent.trim() || '',
                            status: cells[4]?.textContent.trim() || ''
                        };
                    })
                    .filter(item => item.status === 'Menunggu Konfirmasi' || item.status === 'Diproses');
            });

            // Check for new purchases
            if (!this.lastCheckedData) {
                this.lastCheckedData = currentData;
                return currentData;
            }

            // Find new purchases
            const newPurchases = currentData.filter(current => 
                !this.lastCheckedData.some(last => last.number === current.number)
            );

            // Update last checked data
            this.lastCheckedData = currentData;

            return newPurchases;
        } catch (error) {
            console.error('❌ Error checking new purchases:', error);
            return [];
        }
    }

    formatNewPurchaseNotification(purchases) {
        if (!purchases || purchases.length === 0) return null;

        const header = `🔔 ɴᴇᴡ ᴘᴜʀᴄʜᴀsᴇ ᴏʀᴅᴇʀs!\n\n`;
        const items = purchases.map(purchase => 
            `🛒 ᴘᴜʀᴄʜᴀsᴇ #${toSmallCaps(purchase.number)}\n` +
            `🏢 sᴜᴘᴘʟɪᴇʀ: ${toSmallCaps(purchase.supplier)}\n` +
            `📅 ᴅᴀᴛᴇ: ${toSmallCaps(purchase.date)}\n` +
            `📊 sᴛᴀᴛᴜs: ${formatStatus(purchase.status)}`
        ).join('\n\n');

        return header + items;
    }
}

module.exports = PurchaseChecker;
                   
                      
