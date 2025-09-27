const { toSmallCaps, formatTableHeader, formatDataRow, formatStatus } = require('../utils/textFormatter');

class CashProductionChecker {
    constructor(page) {
        this.page = page;
        this.cashProductionUrl = 'https://portal.rajawalielastis.com/prd/transaksi/bayar-produksi';
        this.itemsPerPage = 5; // Show 5 items per telegram message
        this.cachedData = null;
        this.lastCheckedData = null; // Store last checked data for comparison
    }

    async fetchCashProductionData(pageNum = 1, forceRefresh = false) {
        try {
            // Use cached data if available and not forcing refresh
            if (this.cachedData && !forceRefresh) {
                console.log('💰 Using cached Cash Production data...');
                console.log(`💰 Total cached items: ${this.cachedData.length}`);
                console.log(`💰 Requested page: ${pageNum}`);
                
                const totalItems = this.cachedData.length;
                const totalPages = Math.ceil(totalItems / this.itemsPerPage);
                
                // Ensure valid page number
                pageNum = Math.max(1, Math.min(pageNum, totalPages));
                console.log(`💰 Valid page number: ${pageNum} of ${totalPages}`);
                
                const startIdx = (pageNum - 1) * this.itemsPerPage;
                const endIdx = Math.min(startIdx + this.itemsPerPage, totalItems);
                
                console.log(`💰 Slice indices: ${startIdx} to ${endIdx}`);
                console.log(`💰 Data slice length: ${this.cachedData.slice(startIdx, endIdx).length}`);
                
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
            console.log('💰 Fetching fresh Cash Production data from web...');
            await this.page.goto(this.cashProductionUrl, {
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
                return Array.from(document.querySelectorAll('#data-transaction tbody tr'))
                    .map(row => {
                        const cells = row.querySelectorAll('td');
                        return cells.length >= 7 ? {
                            number: cells[1]?.textContent?.trim() || '',
                            karyawan: cells[2]?.textContent?.trim() || '',
                            biaya: cells[3]?.textContent?.trim() || '',
                            sisa: cells[4]?.textContent?.trim() || '',
                            tanggal: cells[5]?.textContent?.trim() || '',
                            status: cells[6]?.textContent?.trim() || ''
                        } : null;
                    })
                    .filter(item => item && item.number);
            });

            // Use cached data for pagination
            const totalItems = this.cachedData.length;
            const totalPages = Math.ceil(totalItems / this.itemsPerPage);
            const startIdx = (pageNum - 1) * this.itemsPerPage;
            const endIdx = Math.min(startIdx + this.itemsPerPage, totalItems);

            console.log(`✅ Cached ${totalItems} fresh Cash Production entries`);
            
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
            console.error('❌ Error fetching Cash Production data:', error);
            
            // Attempt to get data even if waiting times out
            try {
                console.log('⚠️ Timeout occurred, attempting to get available data...');
                this.cachedData = await this.page.evaluate(() => {
                    return Array.from(document.querySelectorAll('#data-transaction tbody tr'))
                        .map(row => {
                            const cells = row.querySelectorAll('td');
                            return {
                                number: cells[1]?.textContent?.trim() || '',
                                karyawan: cells[2]?.textContent?.trim() || '',
                                biaya: cells[3]?.textContent?.trim() || '',
                                sisa: cells[4]?.textContent?.trim() || '',
                                tanggal: cells[5]?.textContent?.trim() || '',
                                status: cells[6]?.textContent?.trim() || ''
                            };
                        })
                        .filter(item => item.number && item.karyawan);
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

    formatCashProductionResult(data, pagination) {
        if (!data || data.length === 0) return '❌ ɴᴏ ᴄᴀsʜ ᴘʀᴏᴅᴜᴄᴛɪᴏɴ ᴅᴀᴛᴀ ғᴏᴜɴᴅ';

        const header = `💰 ᴄᴀsʜ ᴘʀᴏᴅᴜᴄᴛɪᴏɴ ʟɪsᴛ (ᴘᴀɢᴇ ${pagination.currentPage}/${pagination.totalPages})\n` +
                      `sʜᴏᴡɪɴɢ ɪᴛᴇᴍs ${pagination.startItem}-${pagination.endItem} ᴏғ ${pagination.totalItems}\n\n`;
        
        const items = data.map(item => 
            `💰 ${toSmallCaps(item.number)}\n` +
            `👤 ${toSmallCaps(item.karyawan)}\n` +
            `💵 ʙɪᴀʏᴀ: ${item.biaya}\n` +
            `🔄 sɪsᴀ: ${item.sisa}\n` +
            `📅 ${toSmallCaps(item.tanggal)}\n` +
            `📊 sᴛᴀᴛᴜs: ${formatStatus(item.status)}`
        ).join('\n\n');

        return header + items;
    }

    async ensureDataLoaded() {
        if (!this.cachedData) {
            await this.fetchCashProductionData(1);
        }
    }

    async getCashProductionDetail(productionId) {
        try {
            console.log(`💰 Getting cash details for Production ID: ${productionId}`);
            
            // Set smaller viewport for better content fitting
            await this.page.setViewport({
                width: 1440,
                height: 900,
                deviceScaleFactor: 1
            });

            // Click payment button in the table
            const clicked = await this.page.evaluate((id) => {
                const rows = document.querySelectorAll('#data-transaction tbody tr');
                for (const row of rows) {
                    const idCell = row.querySelector('td:nth-child(2)'); // ID Produksi column
                    if (idCell?.textContent?.trim() === id) {
                        // Look for payment button in the Opsi column (last column)
                        const opsiCell = row.querySelector('td:last-child');
                        if (opsiCell) {
                            // Look for the payment button with money icon
                            const paymentBtn = opsiCell.querySelector('a.bayar, .btn.bayar, [class*="bayar"]');
                            if (paymentBtn) {
                                paymentBtn.click();
                                return true;
                            }
                            
                            // Fallback to any button with money icon
                            const moneyBtn = opsiCell.querySelector('a[class*="bx-money"], button[class*="bx-money"]');
                            if (moneyBtn) {
                                moneyBtn.click();
                                return true;
                            }
                        }
                    }
                }
                return false;
            }, productionId);

            if (!clicked) {
                console.log('❌ Payment button not found for ID:', productionId);
                return null;
            }

            // Wait for modal to open
            console.log('⌛ Waiting for payment modal to load...');
            await this.page.waitForSelector('#BayarModal', { 
                visible: true,
                timeout: 10000 
            });
            
            // Wait for content to fully load
            await new Promise(r => setTimeout(r, 3000));

            console.log('📸 Taking payment modal screenshot...');
            
            // Enhance modal styling for better screenshot
            await this.page.evaluate(() => {
                const modal = document.querySelector('#BayarModal .modal-dialog');
                if (modal) {
                    modal.style.maxWidth = '90%';
                    modal.style.width = '1000px';
                    modal.style.backgroundColor = '#ffffff';
                }
                
                // Style tables in modal for better visibility
                const tables = document.querySelectorAll('#BayarModal .table');
                tables.forEach(table => {
                    table.style.fontSize = '12px';
                    table.style.fontFamily = 'Arial, sans-serif';
                    table.style.backgroundColor = '#ffffff';
                    table.style.border = '1px solid #333';
                    
                    const cells = table.querySelectorAll('td, th');
                    cells.forEach((cell, index) => {
                        cell.style.padding = '6px 4px';
                        cell.style.border = '1px solid #333';
                        cell.style.backgroundColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
                        cell.style.color = '#000000';
                        cell.style.fontSize = '11px';
                        cell.style.wordWrap = 'break-word';
                    });
                });
                
                // Style form elements
                const formElements = document.querySelectorAll('#BayarModal .form-control, #BayarModal .form-label');
                formElements.forEach(element => {
                    element.style.fontFamily = 'Arial, sans-serif';
                    element.style.fontSize = '12px';
                    element.style.color = '#000000';
                });
            });
            
            await new Promise(r => setTimeout(r, 1000));
            
            // Get modal content dimensions
            const dimensions = await this.page.evaluate(() => {
                const modalContent = document.querySelector('#BayarModal .modal-content');
                if (modalContent) {
                    const rect = modalContent.getBoundingClientRect();
                    return {
                        x: Math.max(0, rect.x),
                        y: Math.max(0, rect.y),
                        width: Math.min(rect.width, 1000),
                        height: Math.min(rect.height, 800)
                    };
                }
                return null;
            });

            if (dimensions && dimensions.width >= 200 && dimensions.height >= 200) {
                const screenshot = await this.page.screenshot({
                    type: 'jpeg',
                    quality: 80,
                    clip: {
                        x: dimensions.x,
                        y: dimensions.y,
                        width: dimensions.width,
                        height: dimensions.height
                    },
                    omitBackground: false,
                    captureBeyondViewport: false,
                    optimizeForSpeed: false
                });

                // Close modal
                await this.page.evaluate(() => {
                    const closeBtn = document.querySelector('#BayarModal button.btn-close, #BayarModal .btn-close');
                    if (closeBtn) closeBtn.click();
                });

                console.log('✅ Payment modal screenshot captured');
                return {
                    type: 'image',
                    data: screenshot,
                    caption: `💰 Detail Pembayaran Produksi #${productionId}`
                };
            }

            console.log('❌ Could not capture payment modal');
            return null;

        } catch (error) {
            console.error('❌ Cash production detail fetch error:', error);
            try {
                await this.page.goto(this.cashProductionUrl, {
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });
            } catch (navError) {
                console.error('❌ Error navigating back to payment list:', navError);
            }
            return null;
        }
    }

    async checkNewPayments() {
        try {
            console.log('💰 Checking for new payment productions...');
            await this.page.goto(this.cashProductionUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            
            // Wait for table to load
            await this.page.waitForSelector('#data-transaction');
            await new Promise(r => setTimeout(r, 2000));
            
            // Get current payment pending productions
            const currentData = await this.page.evaluate(() => {
                const rows = document.querySelectorAll('#data-transaction tbody tr');
                return Array.from(rows)
                    .map(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 7) {
                            return {
                                number: cells[1]?.textContent?.trim() || '',
                                karyawan: cells[2]?.textContent?.trim() || '',
                                biaya: cells[3]?.textContent?.trim() || '',
                                sisa: cells[4]?.textContent?.trim() || '',
                                tanggal: cells[5]?.textContent?.trim() || '',
                                status: cells[6]?.textContent?.trim() || ''
                            };
                        }
                        return null;
                    })
                    .filter(item => item && item.status && 
                                   (item.status.includes('Belum Lunas') || 
                                    item.status.includes('Proses')));
            });

            // Check for new payment requests
            if (!this.lastCheckedData) {
                this.lastCheckedData = currentData;
                return currentData;
            }

            // Find new payment requests
            const newPayments = currentData.filter(current => 
                !this.lastCheckedData.some(last => last.number === current.number)
            );

            // Update last checked data
            this.lastCheckedData = currentData;

            return newPayments;
        } catch (error) {
            console.error('❌ Error checking new payments:', error);
            return [];
        }
    }

    formatNewPaymentNotification(payments) {
        if (!payments || payments.length === 0) return null;

        const header = `💰 ɴᴇᴡ ᴘʀᴏᴅᴜᴄᴛɪᴏɴ ᴘᴀʏᴍᴇɴᴛs!\n\n`;
        const items = payments.map(payment => 
            `💰 ᴘʀᴏᴅᴜᴄᴛɪᴏɴ #${toSmallCaps(payment.number)}\n` +
            `👤 ${toSmallCaps(payment.karyawan)}\n` +
            `💵 ʙɪᴀʏᴀ: ${payment.biaya}\n` +
            `🔄 sɪsᴀ: ${payment.sisa}\n` +
            `📅 ${toSmallCaps(payment.tanggal)}\n` +
            `📊 sᴛᴀᴛᴜs: ${formatStatus(payment.status)}`
        ).join('\n\n');

        return header + items;
    }

    async fetchCashProductionByEmployee(employeeName) {
        try {
            console.log(`💰 Fetching Cash Production data for employee: ${employeeName}`);
            
            // Navigate to cash production page
            await this.page.goto(this.cashProductionUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            
            // Wait for the filter form to load
            await this.page.waitForSelector('#karyawan');
            
            // Click on employee dropdown to open options
            await this.page.click('#karyawan');
            await new Promise(r => setTimeout(r, 1000));
            
            // Find and select the employee by name
            const employeeSelected = await this.page.evaluate((name) => {
                const select = document.querySelector('#karyawan');
                const options = Array.from(select.options);
                
                // Find option that contains the employee name
                const matchingOption = options.find(option => 
                    option.text.toLowerCase().includes(name.toLowerCase())
                );
                
                if (matchingOption) {
                    select.value = matchingOption.value;
                    // Trigger change event
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    return {
                        found: true,
                        employeeName: matchingOption.text,
                        employeeId: matchingOption.value
                    };
                }
                return { found: false };
            }, employeeName);
            
            if (!employeeSelected.found) {
                return {
                    success: false,
                    error: `Employee "${employeeName}" not found`
                };
            }
            
            console.log(`✅ Selected employee: ${employeeSelected.employeeName} (ID: ${employeeSelected.employeeId})`);
            
            // Wait for table to update after filter
            await new Promise(r => setTimeout(r, 3000));
            
            // Get filtered data from table
            const employeeData = await this.page.evaluate(() => {
                return Array.from(document.querySelectorAll('#data-transaction tbody tr'))
                    .map(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 7) {
                            return {
                                number: cells[1]?.textContent?.trim() || '',
                                karyawan: cells[2]?.textContent?.trim() || '',
                                biaya: cells[3]?.textContent?.trim() || '',
                                sisa: cells[4]?.textContent?.trim() || '',
                                tanggal: cells[5]?.textContent?.trim() || '',
                                status: cells[6]?.textContent?.trim() || ''
                            };
                        }
                        return null;
                    })
                    .filter(item => item && item.number);
            });
            
            console.log(`✅ Found ${employeeData.length} records for ${employeeSelected.employeeName}`);
            
            return {
                success: true,
                employeeName: employeeSelected.employeeName,
                data: employeeData,
                totalItems: employeeData.length
            };
            
        } catch (error) {
            console.error('❌ Error fetching employee data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    formatEmployeeResult(data, employeeName) {
        if (!data || data.length === 0) {
            return `❌ ɴᴏ ᴄᴀsʜ ᴘʀᴏᴅᴜᴄᴛɪᴏɴ ᴅᴀᴛᴀ ғᴏᴜɴᴅ ғᴏʀ ᴇᴍᴘʟᴏʏᴇᴇ: ${toSmallCaps(employeeName)}`;
        }

        // Calculate total from all records
        const totalAmount = data.reduce((sum, item) => {
            // Extract numeric value from biaya (remove "Rp." and dots, convert to number)
            const biayaNumeric = parseFloat(item.biaya.replace(/[Rp.\s]/g, '').replace(/\./g, '')) || 0;
            return sum + biayaNumeric;
        }, 0);

        // Calculate total sisa 
        const totalSisa = data.reduce((sum, item) => {
            // Extract numeric value from sisa (remove "Rp." and dots, convert to number)
            const sisaNumeric = parseFloat(item.sisa.replace(/[Rp.\s]/g, '').replace(/\./g, '')) || 0;
            return sum + sisaNumeric;
        }, 0);

        // Format numbers with thousand separators
        const formatRupiah = (amount) => {
            return `ʀᴘ. ${amount.toLocaleString('id-ID')}`;
        };

        const header = `💰 ᴄᴀsʜ ᴘʀᴏᴅᴜᴄᴛɪᴏɴ ғᴏʀ ${toSmallCaps(employeeName)}\n` +
                      `ᴛᴏᴛᴀʟ ʀᴇᴄᴏʀᴅs: ${data.length}\n` +
                      `💰 ᴛᴏᴛᴀʟ ʙɪᴀʏᴀ: ${formatRupiah(totalAmount)}\n` +
                      `🔄 ᴛᴏᴛᴀʟ sɪsᴀ: ${formatRupiah(totalSisa)}\n\n`;
        
        const items = data.map(item => 
            `💰 ${item.number}\n` +
            `👤 ${item.karyawan}\n` +
            `💵 Biaya: ${item.biaya}\n` +
            `🔄 Sisa: ${item.sisa}\n` +
            `📅 ${item.tanggal}\n` +
            `📊 Status: ${item.status}`
        ).join('\n\n');

        // Add summary footer
        const footer = `\n\n📊 SUMMARY:\n` +
                      `💰 Total All Biaya: ${formatRupiah(totalAmount)}\n` +
                      `🔄 Total All Sisa: ${formatRupiah(totalSisa)}\n` +
                      `💸 Total Paid: ${formatRupiah(totalAmount - totalSisa)}`;

        return header + items + footer;
    }
}



module.exports = CashProductionChecker;


