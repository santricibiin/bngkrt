const { toSmallCaps, formatTableHeader, formatDataRow, formatStatus } = require('../utils/textFormatter');

class ConfirmStockChecker {
    constructor(page) {
        this.page = page;
        this.confirmUrl = 'https://portal.rajawalielastis.com/bo/transaksi/adjustment-proses';
        this.itemsPerPage = 5;
        this.cachedData = null;
    }

    async fetchConfirmStockData(pageNum = 1, forceRefresh = false) {
        try {
            // Use cached data if available and not forcing refresh
            if (this.cachedData && !forceRefresh) {
                console.log('✅ Using cached Confirm Stock data...');
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

            // Fetch fresh data from web
            console.log('✅ Fetching fresh Confirm Stock data from web...');
            await this.page.goto(this.confirmUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            
            // Wait for page to load completely
            await new Promise(r => setTimeout(r, 3000));
            
            // Check if dataTables exists, if not use basic table selector
            const hasDataTables = await this.page.evaluate(() => {
                return document.querySelector('div.dataTables_length select') !== null;
            });

            if (hasDataTables) {
                // Set to 100 entries and get all data
                await this.page.waitForSelector('div.dataTables_length select');
                await this.page.select('div.dataTables_length select', '100');
                
                // Wait for table to update
                await new Promise(r => setTimeout(r, 2000));
            }
            
            // Store all data in cache
            this.cachedData = await this.page.evaluate(() => {
                // Try multiple table selectors
                const tableSelectors = [
                    '#data-transaction tbody tr',
                    '.table tbody tr',
                    'table tbody tr'
                ];
                
                let rows = [];
                for (const selector of tableSelectors) {
                    rows = document.querySelectorAll(selector);
                    if (rows.length > 0) break;
                }
                
                return Array.from(rows)
                    .map(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 4) {
                            return {
                                number: cells[1]?.textContent?.trim() || '',
                                date: cells[2]?.textContent?.trim() || '',
                                status: cells[3]?.textContent?.trim() || ''
                            };
                        }
                        return null;
                    })
                    .filter(item => item && item.number);
            });

            console.log(`✅ Found ${this.cachedData.length} confirm stock entries`);

            // Use cached data for pagination
            const totalItems = this.cachedData.length;
            const totalPages = Math.ceil(totalItems / this.itemsPerPage);
            const startIdx = (pageNum - 1) * this.itemsPerPage;
            const endIdx = Math.min(startIdx + this.itemsPerPage, totalItems);

            console.log(`✅ Cached ${totalItems} fresh Confirm Stock entries`);
            
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
            console.error('❌ Error fetching Confirm Stock data:', error);
            
            // Attempt to get data even if waiting times out
            try {
                console.log('⚠️ Timeout occurred, attempting to get available data...');
                this.cachedData = await this.page.evaluate(() => {
                    const tableSelectors = [
                        '#data-transaction tbody tr',
                        '.table tbody tr',
                        'table tbody tr'
                    ];
                    
                    let rows = [];
                    for (const selector of tableSelectors) {
                        rows = document.querySelectorAll(selector);
                        if (rows.length > 0) break;
                    }
                    
                    return Array.from(rows)
                        .map(row => {
                            const cells = row.querySelectorAll('td');
                            return {
                                number: cells[1]?.textContent?.trim() || '',
                                date: cells[2]?.textContent?.trim() || '',
                                status: cells[3]?.textContent?.trim() || ''
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

    formatConfirmStockResult(data, pagination) {
        if (!data || data.length === 0) return `❌ ${toSmallCaps('No Confirm Stock data found')}`;

        const header = `✅ ${toSmallCaps(`Confirm Stock List (Page ${pagination.currentPage}/${pagination.totalPages})`)}\n` +
                      `${toSmallCaps(`Showing items ${pagination.startItem}-${pagination.endItem} of ${pagination.totalItems}`)}\n\n`;
        
        const items = data.map(item => 
            `✅ ${toSmallCaps(item.number)}\n` +
            `📅 ${toSmallCaps(item.date)}\n` +
            `📊 ${toSmallCaps('Status')}: ${toSmallCaps(item.status)}`
        ).join('\n\n');

        return header + items;
    }

    async approveStockAdjustment(adjustmentId) {
        try {
            console.log(`✅ Approving stock adjustment ID: ${adjustmentId}`);
            
            // Navigate to confirm stock page
            await this.page.goto(this.confirmUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Wait for page to load
            await new Promise(r => setTimeout(r, 2000));

            // Find and click the edit/approve button for the specific ID
            const editClicked = await this.page.evaluate((id) => {
                const rows = document.querySelectorAll('#data-transaction tbody tr');
                for (const row of rows) {
                    const idCell = row.querySelector('td:nth-child(2)'); // ID column
                    if (idCell?.textContent?.trim() === id) {
                        // Look for edit/approve button in the Opsi column (last column)
                        const opsiCell = row.querySelector('td:last-child');
                        if (opsiCell) {
                            // Look for button with checkmark icon or edit action
                            const editBtn = opsiCell.querySelector('a.btn, button.btn, .btn');
                            if (editBtn) {
                                editBtn.click();
                                return true;
                            }
                        }
                    }
                }
                return false;
            }, adjustmentId);

            if (!editClicked) {
                console.log('❌ Edit button not found for ID:', adjustmentId);
                return {
                    success: false,
                    error: 'Edit button not found for this ID'
                };
            }

            // Wait for popup/modal to open
            console.log('⌛ Waiting for approval popup to open...');
            await new Promise(r => setTimeout(r, 3000));

            // Look for and click approve button
            console.log('✅ Clicking Approve button...');
            const approveClicked = await this.page.evaluate(() => {
                // Try different selectors for approve button
                const approveSelectors = [
                    'button:contains("Approve")',
                    'button:contains("Setuju")',
                    '.btn-success',
                    'button.btn-success',
                    '.btn:contains("Approve")',
                    '.btn:contains("Setuju")'
                ];

                // Look for approve button in modal or popup
                const modal = document.querySelector('.modal, .popup, .swal2-popup');
                if (modal) {
                    const buttons = modal.querySelectorAll('button, .btn');
                    for (const btn of buttons) {
                        const btnText = btn.textContent.toLowerCase();
                        if (btnText.includes('approve') || btnText.includes('setuju') || btnText.includes('ya')) {
                            btn.click();
                            return true;
                        }
                    }
                }

                // Fallback: look for approve button anywhere on page
                const allButtons = document.querySelectorAll('button, .btn');
                for (const btn of allButtons) {
                    const btnText = btn.textContent.toLowerCase();
                    if ((btnText.includes('approve') || btnText.includes('setuju')) && btn.offsetParent !== null) {
                        btn.click();
                        return true;
                    }
                }

                return false;
            });

            if (!approveClicked) {
                console.log('❌ Approve button not found');
                return {
                    success: false,
                    error: 'Approve button not found'
                };
            }

            // Wait for approval to process
            console.log('⌛ Processing approval...');
            await new Promise(r => setTimeout(r, 3000));

            // Check if approval was successful
            const approvalSuccess = await this.page.evaluate(() => {
                // Look for success message or modal closure
                const successIndicators = [
                    '.alert-success',
                    '.swal2-success',
                    '.toast-success'
                ];

                for (const selector of successIndicators) {
                    if (document.querySelector(selector)) {
                        return true;
                    }
                }

                // Check if modal is closed (another indicator of success)
                const modal = document.querySelector('.modal.show, .swal2-popup');
                return !modal;
            });

            if (approvalSuccess) {
                console.log('✅ Stock adjustment approved successfully');
                return {
                    success: true,
                    message: `Penyesuaian stok dengan ID ${adjustmentId} berhasil di approve`,
                    adjustmentId: adjustmentId
                };
            } else {
                return {
                    success: false,
                    error: 'Approval process may have failed'
                };
            }

        } catch (error) {
            console.error('❌ Error approving stock adjustment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async ensureDataLoaded() {
        if (!this.cachedData) {
            await this.fetchConfirmStockData(1);
        }
    }
}

module.exports = ConfirmStockChecker;
