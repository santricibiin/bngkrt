const cheerio = require('cheerio');
const { toSmallCaps, formatTableHeader, formatDataRow } = require('../utils/textFormatter');

class StockChecker {
    constructor(page) {
        this.page = page;
        this.stockUrl = 'https://portal.rajawalielastis.com/bo/report/stk_akhir';
    }

    async checkStock() {
        try {
            console.log('📊 Starting stock check process...');
            
            // Navigate to stock page
            console.log('🌐 Navigating to stock report page...');
            await this.page.goto(this.stockUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            console.log('✅ Stock page loaded successfully');

            // Wait for stock table
            console.log('🔍 Looking for stock data...');
            await this.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

            // Get stock data
            const stockData = await this.page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('table tr'));
                return rows.map(row => {
                    const cells = Array.from(row.querySelectorAll('td'));
                    return cells.map(cell => cell.textContent.trim());
                }).filter(row => row.length > 0);
            });

            console.log('✅ Stock data retrieved successfully');
            return {
                success: true,
                data: stockData
            };

        } catch (error) {
            console.error('❌ Error checking stock:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    formatStockData(data) {
        console.log('📝 ғᴏʀᴍᴀᴛᴛɪɴɢ sᴛᴏᴄᴋ ᴅᴀᴛᴀ...');
        return data.map(row => {
            if (row.length >= 3) {
                const formattedRow = formatDataRow(row);
                return `📦 ${formattedRow[0]} - sᴛᴏᴄᴋ: ${formattedRow[2]}`;
            }
            return null;
        }).filter(item => item !== null).join('\n');
    }

    async searchStock(itemNames) {
        try {
            console.log(`🔍 Searching for items: ${itemNames}`);
            
            // Navigate to stock page
            console.log('🌐 Navigating to stock report page...');
            await this.page.goto(this.stockUrl, { 
                waitUntil: 'networkidle0',
                timeout: 30000 
            });

            // Wait for form elements
            await this.page.waitForSelector('#Plant_Update');
            await this.page.waitForSelector('#Barang_Update');
            
            // Select Plant
            await this.page.select('#Plant_Update', 'All');
            
            // Parse multiple item names if comma-separated
            const itemList = itemNames.split(',').map(name => name.trim()).filter(name => name.length > 0);
            const allResults = [];

            // Search each item individually
            for (const itemName of itemList) {
                console.log(`🔍 Searching for: ${itemName}`);
                
                // Simple dropdown selection for current item
                await this.page.$eval('#Barang_Update', (select, searchName) => {
                    const option = Array.from(select.options)
                        .find(opt => opt.text.toLowerCase().includes(searchName.toLowerCase()));
                    if (option) {
                        select.value = option.value;
                    }
                }, itemName);

                // Submit form
                await Promise.all([
                    this.page.click('button[type="submit"]'),
                    this.page.waitForNavigation({ waitUntil: 'networkidle0' })
                ]);

                // Get table data for current item
                const tableData = await this.page.evaluate((searchName) => {
                    const results = [];
                    const tables = document.querySelectorAll('.table');
                    const locationOrder = [
                        'Gudang HO',
                        'Toko Fadillah Soreang',
                        'RAJAWALI 1'
                    ];
                    
                    tables.forEach(table => {
                        const headerText = table.closest('.card')?.querySelector('.card-header')?.textContent || '';
                        const location = headerText.match(/Rekap Stock Barang Akhir - (.+?)\n/)?.[1] || '';
                        
                        if (locationOrder.includes(location)) {
                            const rows = Array.from(table.querySelectorAll('tbody tr'));
                            if (rows.length > 0) {
                                const cols = rows[0].querySelectorAll('td');
                                if (cols.length >= 6) {
                                    results.push({
                                        name: cols[3]?.textContent?.trim() || '',
                                        unit: cols[4]?.textContent?.trim() || '',
                                        stock: cols[5]?.textContent?.trim() || '',
                                        location: location,
                                        stockValue: parseFloat(cols[5]?.textContent?.trim()) || 0
                                    });
                                }
                            } else {
                                results.push({
                                    name: searchName,
                                    unit: '-',
                                    stock: '0.00',
                                    location: location,
                                    stockValue: 0
                                });
                            }
                        }
                    });

                    return results.sort((a, b) => 
                        locationOrder.indexOf(a.location) - locationOrder.indexOf(b.location)
                    );
                }, itemName);

                // Add results for this item
                if (tableData.length > 0) {
                    allResults.push({
                        itemName: itemName,
                        data: tableData
                    });
                }

                // Navigate back to search page for next item (if there are more)
                if (itemList.indexOf(itemName) < itemList.length - 1) {
                    await this.page.goto(this.stockUrl, { 
                        waitUntil: 'networkidle0',
                        timeout: 30000 
                    });
                    await this.page.waitForSelector('#Plant_Update');
                    await this.page.waitForSelector('#Barang_Update');
                    await this.page.select('#Plant_Update', 'All');
                }
            }

            return {
                success: true,
                data: allResults
            };

        } catch (error) {
            console.error('❌ Search error:', error);
            return {
                success: false,
                error: 'Failed to search stock data'
            };
        }
    }

    formatStockResult(data) {
        if (!data || data.length === 0) return '❌ ɴᴏ sᴛᴏᴄᴋ ᴅᴀᴛᴀ ғᴏᴜɴᴅ';

        // Format results for multiple items using small caps
        return data.map(itemResult => {
            const itemHeader = `🔍 sᴇᴀʀᴄʜ: ${toSmallCaps(itemResult.itemName)}\n`;
            const itemData = itemResult.data
                .map(item => 
                    `📦 ${toSmallCaps(item.name)} - ${toSmallCaps(item.unit)} - ${item.stock}\n` +
                    `📍 ${toSmallCaps(item.location)}`
                )
                .join('\n\n');
            
            return itemHeader + itemData;
        }).join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');
    }
}

module.exports = StockChecker;


