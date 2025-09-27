const { toSmallCaps, formatTableHeader, formatDataRow, formatStatus } = require('../utils/textFormatter');

class AbsensiChecker {
    constructor(page) {
        this.page = page;
        this.absensiUrl = 'https://portal.rajawalielastis.com/att/dashboard';
        this.itemsPerPage = 5;
        this.cachedData = null;
    }

    async fetchAbsensiData(pageNum = 1, forceRefresh = false) {
        try {
            // Use cached data if available and not forcing refresh
            if (this.cachedData && !forceRefresh) {
                console.log('👥 Using cached Absensi data...');
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
            console.log('👥 Fetching fresh Absensi data from web...');
            await this.page.goto(this.absensiUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            
            // Wait for page to load
            await new Promise(r => setTimeout(r, 2000));
            
            // Store all data in cache
            this.cachedData = await this.page.evaluate(() => {
                const results = [];
                
                // Look for cards, tables, or any data containers
                const cards = document.querySelectorAll('.card, .widget, .info-box, .box');
                const tables = document.querySelectorAll('.table, table');
                
                // Try to extract data from cards first
                cards.forEach((card, index) => {
                    const title = card.querySelector('.card-title, .card-header, h3, h4, h5')?.textContent?.trim();
                    const content = card.querySelector('.card-body, .content, .info')?.textContent?.trim();
                    const value = card.querySelector('.number, .count, .value, .stat')?.textContent?.trim();
                    
                    if (title || content || value) {
                        results.push({
                            type: 'card',
                            title: title || `Card ${index + 1}`,
                            content: content || '',
                            value: value || '',
                            index: index
                        });
                    }
                });
                
                // Try to extract data from tables
                tables.forEach((table, tableIndex) => {
                    const rows = Array.from(table.querySelectorAll('tbody tr, tr'));
                    rows.forEach((row, rowIndex) => {
                        const cells = Array.from(row.querySelectorAll('td, th'));
                        if (cells.length >= 2) {
                            const rowData = cells.map(cell => cell.textContent?.trim() || '');
                            results.push({
                                type: 'table',
                                table: tableIndex,
                                row: rowIndex,
                                data: rowData,
                                name: rowData[0] || `Row ${rowIndex + 1}`,
                                info: rowData.slice(1).join(' | ')
                            });
                        }
                    });
                });
                
                // If no structured data found, try to get general content
                if (results.length === 0) {
                    const contentDivs = document.querySelectorAll('.content, .main-content, .dashboard-content, .container');
                    contentDivs.forEach((div, index) => {
                        const text = div.textContent?.trim();
                        if (text && text.length > 10 && text.length < 500) {
                            results.push({
                                type: 'content',
                                title: `Content ${index + 1}`,
                                content: text,
                                index: index
                            });
                        }
                    });
                }
                
                return results.filter(item => 
                    item.title || item.content || item.name || (item.data && item.data.length > 0)
                );
            });

            // Use cached data for pagination
            const totalItems = this.cachedData.length;
            const totalPages = Math.ceil(totalItems / this.itemsPerPage);
            const startIdx = (pageNum - 1) * this.itemsPerPage;
            const endIdx = Math.min(startIdx + this.itemsPerPage, totalItems);

            console.log(`✅ Cached ${totalItems} fresh Absensi entries`);
            
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
            console.error('❌ Error fetching Absensi data:', error);
            
            // Attempt to get data even if waiting times out
            try {
                console.log('⚠️ Timeout occurred, attempting to get available data...');
                this.cachedData = await this.page.evaluate(() => {
                    const results = [];
                    
                    // Simple text extraction as fallback
                    const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, p, div, span');
                    textElements.forEach((element, index) => {
                        const text = element.textContent?.trim();
                        if (text && text.length > 5 && text.length < 200) {
                            results.push({
                                type: 'text',
                                title: `Item ${index + 1}`,
                                content: text,
                                index: index
                            });
                        }
                    });
                    
                    return results.slice(0, 20); // Limit to 20 items
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

    formatAbsensiResult(data, pagination) {
        if (!data || data.length === 0) return `❌ ${toSmallCaps('No Absensi data found')}`;

        const header = `👥 ${toSmallCaps(`Absensi Dashboard (Page ${pagination.currentPage}/${pagination.totalPages})`)}\n` +
                      `${toSmallCaps(`Showing items ${pagination.startItem}-${pagination.endItem} of ${pagination.totalItems}`)}\n\n`;
        
        const items = data.map(item => {
            switch (item.type) {
                case 'card':
                    return `📊 ${toSmallCaps(item.title)}\n${item.content ? `📝 ${toSmallCaps(item.content)}` : ''}${item.value ? `\n🔢 ${toSmallCaps(item.value)}` : ''}`;
                case 'table':
                    return `📋 ${toSmallCaps(item.name)}\n📄 ${toSmallCaps(item.info)}`;
                case 'content':
                    return `📄 ${toSmallCaps(item.title)}\n${toSmallCaps(item.content)}`;
                case 'text':
                    return `📝 ${toSmallCaps(item.content)}`;
                default:
                    return `📌 ${toSmallCaps(item.title || 'Data')}\n${toSmallCaps(item.content || '')}`;
            }
        }).join('\n\n');

        return header + items;
    }

    async ensureDataLoaded() {
        if (!this.cachedData) {
            await this.fetchAbsensiData(1);
        }
    }

    async getAbsensiScreenshot() {
        try {
            console.log('📸 Taking Absensi dashboard screenshot...');
            
            // Set larger viewport to capture more content
            await this.page.setViewport({
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1
            });

            // Navigate to absensi page
            await this.page.goto(this.absensiUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Wait for content to load
            await new Promise(r => setTimeout(r, 3000));

            // Take full page screenshot
            const screenshot = await this.page.screenshot({
                type: 'png',
                fullPage: true,
                omitBackground: false
            });

            return {
                type: 'image',
                data: screenshot,
                caption: '👥 Absensi Dashboard'
            };

        } catch (error) {
            console.error('❌ Screenshot error:', error);
            return null;
        }
    }
}

module.exports = AbsensiChecker;
