const cheerio = require('cheerio');

const { toSmallCaps, formatTableHeader, formatDataRow, formatStatus } = require('../utils/textFormatter');

class PiutangChecker {
    constructor(page) {
        this.page = page;
        this.piutangUrl = 'https://portal.rajawalielastis.com/bo/report/piutang_cust';
        this.cachedData = null;
        this.waitingForCustomerName = false;
    }

    async fetchPiutangData() {
        try {
            console.log('💰 Fetching piutang data from web...');
            
            // Navigate to piutang page
            await this.page.goto(this.piutangUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Set tanggal awal ke tanggal 1
            console.log('📅 Setting tanggal awal to 01...');
            await this.page.evaluate(() => {
                const tanggal1 = document.querySelector('#tanggal1');
                if (tanggal1) {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    tanggal1.value = `${year}-${month}-01`;
                }
            });

            // Set tanggal akhir ke tanggal 30
            console.log('📅 Setting tanggal akhir to 30...');
            await this.page.evaluate(() => {
                const tanggal2 = document.querySelector('#tanggal2');
                if (tanggal2) {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    // Get last day of month
                    const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
                    tanggal2.value = `${year}-${month}-${lastDay}`;
                }
            });

            // Set status to "Belum Lunas"
            console.log('📊 Setting status to Belum Lunas...');
            await this.page.evaluate(() => {
                const status = document.querySelector('#Status_Update');
                if (status) {
                    status.value = 'Belum Lunas';
                }
            });

            // Click search button to get data
            console.log('🔍 Clicking search button...');
            await this.page.evaluate(() => {
                const searchBtn = document.querySelector('button[type="submit"]');
                if (searchBtn) {
                    searchBtn.click();
                }
            });

            // Wait for page to load
            await new Promise(r => setTimeout(r, 5000));

            // Get the HTML content and parse with cheerio
            const htmlContent = await this.page.content();
            const $ = cheerio.load(htmlContent);

            const totalData = this.parsePiutangData($);
            
            console.log(`✅ Successfully fetched piutang data`);
            
            return {
                success: true,
                data: totalData
            };

        } catch (error) {
            console.error('❌ Error fetching piutang data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    parsePiutangData($) {
        const stores = [];
        let grandTotal = 0;
        let grandSisa = 0;

        // Find all cards that contain piutang data
        $('.card').each((index, card) => {
            const cardHeader = $(card).find('.card-header h5').text();
            if (cardHeader.includes('Rekap Piutang Customer -')) {
                const storeName = cardHeader.replace('Rekap Piutang Customer - ', '').trim();
                
                // Get total from tfoot
                const tfoot = $(card).find('tfoot tr');
                let storeTotal = 0;
                let storeSisa = 0;
                
                if (tfoot.length > 0) {
                    const totalText = tfoot.find('td').eq(2).text().replace(/[^\d]/g, '');
                    const sisaText = tfoot.find('td').eq(3).text().replace(/[^\d]/g, '');
                    storeTotal = parseInt(totalText) || 0;
                    storeSisa = parseInt(sisaText) || 0;
                }

                if (storeTotal > 0) {
                    stores.push({
                        name: storeName,
                        total: storeTotal,
                        sisa: storeSisa,
                        totalFormatted: this.formatCurrency(storeTotal),
                        sisaFormatted: this.formatCurrency(storeSisa)
                    });
                    
                    grandTotal += storeTotal;
                    grandSisa += storeSisa;
                }
            }
        });

        return {
            stores: stores,
            grandTotal: grandTotal,
            grandSisa: grandSisa,
            grandTotalFormatted: this.formatCurrency(grandTotal),
            grandSisaFormatted: this.formatCurrency(grandSisa)
        };
    }

    async searchCustomerPiutang(customerName) {
        try {
            console.log(`🔍 Searching piutang for customer: ${customerName}`);
            
            // Navigate to piutang page
            await this.page.goto(this.piutangUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Set tanggal forms
            await this.page.evaluate(() => {
                const tanggal1 = document.querySelector('#tanggal1');
                const tanggal2 = document.querySelector('#tanggal2');
                if (tanggal1 && tanggal2) {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
                    tanggal1.value = `${year}-${month}-01`;
                    tanggal2.value = `${year}-${month}-${lastDay}`;
                }
            });

            // Find and select customer
            console.log(`📝 Selecting customer: ${customerName}`);
            const customerSelected = await this.page.evaluate((name) => {
                const customerSelect = document.querySelector('#Customer_Update');
                if (customerSelect) {
                    const option = Array.from(customerSelect.options).find(opt => 
                        opt.text.toLowerCase().includes(name.toLowerCase())
                    );
                    if (option) {
                        customerSelect.value = option.value;
                        return option.text;
                    }
                }
                return null;
            }, customerName);

            if (!customerSelected) {
                return {
                    success: false,
                    error: `Customer "${customerName}" not found`
                };
            }

            // Set status to show all data
            await this.page.evaluate(() => {
                const status = document.querySelector('#Status_Update');
                if (status) {
                    status.value = 'All';
                }
            });

            // Click search button
            await this.page.evaluate(() => {
                const searchBtn = document.querySelector('button[type="submit"]');
                if (searchBtn) {
                    searchBtn.click();
                }
            });

            // Wait for results
            await new Promise(r => setTimeout(r, 5000));

            // Parse results
            const htmlContent = await this.page.content();
            const $ = cheerio.load(htmlContent);

            const customerData = this.parseCustomerPiutang($, customerSelected);

            return {
                success: true,
                customerName: customerSelected,
                data: customerData
            };

        } catch (error) {
            console.error('❌ Error searching customer piutang:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    parseCustomerPiutang($, customerName) {
        const stores = [];
        let totalPiutang = 0;
        let totalSisa = 0;

        $('.card').each((index, card) => {
            const cardHeader = $(card).find('.card-header h5').text();
            if (cardHeader.includes('Rekap Piutang Customer -')) {
                const storeName = cardHeader.replace('Rekap Piutang Customer - ', '').trim();
                
                // Check if this store has data for the customer
                const tbody = $(card).find('tbody tr');
                const transactions = [];
                let storeTotal = 0;
                let storeSisa = 0;

                tbody.each((i, row) => {
                    const customerNameInRow = $(row).find('td').eq(1).text().trim();
                    if (customerNameInRow.toLowerCase().includes(customerName.toLowerCase())) {
                        const jumlah = $(row).find('td').eq(2).text().replace(/[^\d]/g, '');
                        const sisa = $(row).find('td').eq(3).text().replace(/[^\d]/g, '');
                        const noStruk = $(row).find('td').eq(4).text().trim();
                        const tanggal = $(row).find('td').eq(5).text().trim();
                        const status = $(row).find('td').eq(6).text().trim();

                        const jumlahNum = parseInt(jumlah) || 0;
                        const sisaNum = parseInt(sisa) || 0;

                        transactions.push({
                            jumlah: jumlahNum,
                            sisa: sisaNum,
                            jumlahFormatted: this.formatCurrency(jumlahNum),
                            sisaFormatted: this.formatCurrency(sisaNum),
                            noStruk: noStruk,
                            tanggal: tanggal,
                            status: status
                        });

                        storeTotal += jumlahNum;
                        storeSisa += sisaNum;
                    }
                });

                if (transactions.length > 0) {
                    stores.push({
                        name: storeName,
                        transactions: transactions,
                        total: storeTotal,
                        sisa: storeSisa,
                        totalFormatted: this.formatCurrency(storeTotal),
                        sisaFormatted: this.formatCurrency(storeSisa)
                    });

                    totalPiutang += storeTotal;
                    totalSisa += storeSisa;
                }
            }
        });

        return {
            stores: stores,
            totalPiutang: totalPiutang,
            totalSisa: totalSisa,
            totalPiutangFormatted: this.formatCurrency(totalPiutang),
            totalSisaFormatted: this.formatCurrency(totalSisa)
        };
    }

    formatPiutangSummary(data) {
        if (!data || !data.stores || data.stores.length === 0) {
            return '❌ ɴᴏ ᴘɪᴜᴛᴀɴɢ ᴅᴀᴛᴀ ғᴏᴜɴᴅ';
        }

        let message = `💰 ᴛᴏᴛᴀʟ ᴘɪᴜᴛᴀɴɢ sᴜᴍᴍᴀʀʏ\n\n`;
        
        data.stores.forEach(store => {
            message += `🏪 ${toSmallCaps(store.name)}\n`;
            message += `   ᴛᴏᴛᴀʟ: ${store.totalFormatted}\n`;
            message += `   sɪsᴀ: ${store.sisaFormatted}\n\n`;
        });

        message += `📊 ɢʀᴀɴᴅ ᴛᴏᴛᴀʟ:\n`;
        message += `💰 ᴛᴏᴛᴀʟ ᴘɪᴜᴛᴀɴɢ: ${data.grandTotalFormatted}\n`;
        message += `💳 sɪsᴀ ᴘɪᴜᴛᴀɴɢ: ${data.grandSisaFormatted}\n\n`;
        message += `💬 sᴇɴᴅ ᴄᴜsᴛᴏᴍᴇʀ ɴᴀᴍᴇ ᴛᴏ sᴇᴇ ᴅᴇᴛᴀɪʟᴇᴅ ᴘɪᴜᴛᴀɴɢ (ᴇ.ɢ., "sɪʟᴍɪ")`;

        return message;
    }

    formatCustomerPiutang(customerName, data) {
        if (!data || !data.stores || data.stores.length === 0) {
            return `❌ ɴᴏ ᴘɪᴜᴛᴀɴɢ ᴅᴀᴛᴀ ғᴏᴜɴᴅ ғᴏʀ ᴄᴜsᴛᴏᴍᴇʀ "${toSmallCaps(customerName)}"`;
        }

        let message = `💰 ᴘɪᴜᴛᴀɴɢ ᴅᴇᴛᴀɪʟs - ${toSmallCaps(customerName.toUpperCase())}\n\n`;

        data.stores.forEach(store => {
            message += `🏪 ${toSmallCaps(store.name)}\n`;
            message += `   ᴛᴏᴛᴀʟ: ${store.totalFormatted} | sɪsᴀ: ${store.sisaFormatted}\n`;
            
            store.transactions.forEach((tx, index) => {
                message += `   ${index + 1}. ${toSmallCaps(tx.noStruk)}\n`;
                message += `      💰 ${tx.jumlahFormatted} | sɪsᴀ: ${tx.sisaFormatted}\n`;
                message += `      📅 ${toSmallCaps(tx.tanggal)}\n`;
            });
            message += `\n`;
        });

        message += `📊 ᴛᴏᴛᴀʟ ${toSmallCaps(customerName.toUpperCase())}:\n`;
        message += `💰 ᴛᴏᴛᴀʟ ᴘɪᴜᴛᴀɴɢ: ${data.totalPiutangFormatted}\n`;
        message += `💳 Sisa Piutang: ${data.totalSisaFormatted}`;

        return message;
    }

    formatCurrency(amount) {
        return `Rp. ${amount.toLocaleString('id-ID')}`;
    }

    async ensureDataLoaded() {
        if (!this.cachedData) {
            await this.fetchPiutangData();
        }
    }
}

module.exports = PiutangChecker;
