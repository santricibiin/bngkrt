const { toSmallCaps, formatTableHeader, formatDataRow, formatStatus } = require('../utils/textFormatter');

class ProductionChecker {
    constructor(page) {
        this.page = page;
        this.productionUrl = 'https://portal.rajawalielastis.com/prd/transaksi/produksi';
        this.itemsPerPage = 5; // Show 5 items per telegram message
        this.cachedData = null;
        this.lastCheckedData = null; // Store last checked data for comparison
    }

    async fetchProductionData(pageNum = 1, forceRefresh = false) {
        try {
            // Use cached data if available and not forcing refresh
            if (this.cachedData && !forceRefresh) {
                console.log('🏭 Using cached Production data...');
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
            console.log('🏭 Fetching fresh Production data from web...');
            await this.page.goto(this.productionUrl, {
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
                            tanggal: cells[2]?.textContent?.trim() || '',
                            jenis: cells[3]?.textContent?.trim() || '',
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

            console.log(`✅ Cached ${totalItems} fresh Production entries`);
            
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
            console.error('❌ Error fetching Production data:', error);
            
            // Attempt to get data even if waiting times out
            try {
                console.log('⚠️ Timeout occurred, attempting to get available data...');
                this.cachedData = await this.page.evaluate(() => {
                    return Array.from(document.querySelectorAll('.table tbody tr'))
                        .map(row => {
                            const cells = row.querySelectorAll('td');
                            return {
                                number: cells[1]?.textContent?.trim() || '',
                                tanggal: cells[2]?.textContent?.trim() || '',
                                jenis: cells[3]?.textContent?.trim() || '',
                                status: cells[4]?.textContent?.trim() || ''
                            };
                        })
                        .filter(item => item.number && item.tanggal);
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

    formatProductionResult(data, pagination) {
        if (!data || data.length === 0) return '❌ ɴᴏ ᴘʀᴏᴅᴜᴄᴛɪᴏɴ ᴅᴀᴛᴀ ғᴏᴜɴᴅ';

        const header = `🏭 ᴘʀᴏᴅᴜᴄᴛɪᴏɴ ʟɪsᴛ (ᴘᴀɢᴇ ${pagination.currentPage}/${pagination.totalPages})\n` +
                      `sʜᴏᴡɪɴɢ ɪᴛᴇᴍs ${pagination.startItem}-${pagination.endItem} ᴏғ ${pagination.totalItems}\n\n`;
        
        const items = data.map(item => 
            `🏭 ${toSmallCaps(item.number)}\n` +
            `📅 ${toSmallCaps(item.tanggal)}\n` +
            `📝 ${toSmallCaps(item.jenis)}\n` +
            `📊 sᴛᴀᴛᴜs: ${formatStatus(item.status)}`
        ).join('\n\n');

        return header + items;
    }

    async ensureDataLoaded() {
        if (!this.cachedData) {
            await this.fetchProductionData(1);
        }
    }

    async getProductionDetail(productionId) {
        try {
            console.log(`🔍 Getting details for Production ID: ${productionId}`);
            
            // Set smaller viewport for better content fitting
            await this.page.setViewport({
                width: 1440,
                height: 900,
                deviceScaleFactor: 1
            });

            // Click detail button - look for the correct structure in production table
            const clicked = await this.page.evaluate((id) => {
                const rows = document.querySelectorAll('.table tbody tr');
                for (const row of rows) {
                    const idCell = row.querySelector('td:nth-child(2)'); // Production ID column
                    if (idCell?.textContent?.trim() === id) {
                        // Look for detail button in the Opsi column (usually last column)
                        const opsiCell = row.querySelector('td:last-child');
                        if (opsiCell) {
                            // Look for various possible detail button selectors
                            const detailBtn = opsiCell.querySelector('a[href*="detail"], button[onclick*="detail"], .btn[data-target*="detail"], a.detail-doc');
                            if (detailBtn) {
                                detailBtn.click();
                                return true;
                            }
                            
                            // If no direct detail button, look for any clickable element in opsi
                            const clickableBtn = opsiCell.querySelector('a, button');
                            if (clickableBtn) {
                                clickableBtn.click();
                                return true;
                            }
                        }
                    }
                }
                return false;
            }, productionId);

            if (!clicked) {
                console.log('❌ Detail button not found for ID:', productionId);
                return null;
            }

            // Wait for page navigation or modal
            console.log('⌛ Waiting for detail page/modal to load...');
            try {
                await Promise.race([
                    this.page.waitForNavigation({ 
                        waitUntil: 'networkidle0',
                        timeout: 20000 
                    }),
                    this.page.waitForSelector('#DetailModal, .modal', { 
                        visible: true,
                        timeout: 10000 
                    })
                ]);
            } catch (waitError) {
                console.log('⚠️ Timeout waiting for navigation/modal, proceeding...');
            }
            
            // Wait for content to fully load
            await new Promise(r => setTimeout(r, 5000));

            // Check if we're on a new page or modal opened
            const currentUrl = this.page.url();
            if (currentUrl.includes('detail') || currentUrl !== this.productionUrl) {
                console.log('📸 Taking optimized compact screenshots...');
                
                // Wait for specific content to load
                await this.page.waitForSelector('.content-wrapper, .content, .card', { timeout: 10000 });
                
                // Enhanced page styling for compact clear screenshots
                await this.page.evaluate(() => {
                    // Hide sidebar if exists
                    const sidebar = document.querySelector('.main-sidebar, .sidebar, .left-side, aside');
                    if (sidebar) {
                        sidebar.style.display = 'none';
                    }
                    
                    // Hide navbar/header if exists
                    const navbar = document.querySelector('.main-header, .navbar, header');
                    if (navbar) {
                        navbar.style.display = 'none';
                    }
                    
                    // Compact table styling
                    const tables = document.querySelectorAll('.table, table');
                    tables.forEach(table => {
                        table.style.fontSize = '12px';
                        table.style.lineHeight = '1.3';
                        table.style.fontFamily = 'Arial, sans-serif';
                        table.style.fontWeight = '500';
                        table.style.backgroundColor = '#ffffff';
                        table.style.border = '1px solid #333';
                        table.style.borderCollapse = 'separate';
                        table.style.borderSpacing = '0';
                        table.style.width = '100%';
                        table.style.maxWidth = '100%';
                        
                        // Compact table cells
                        const cells = table.querySelectorAll('td, th');
                        cells.forEach((cell, index) => {
                            cell.style.padding = '6px 4px';
                            cell.style.border = '1px solid #333';
                            cell.style.backgroundColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
                            cell.style.color = '#000000';
                            cell.style.fontWeight = '500';
                            cell.style.textAlign = 'left';
                            cell.style.fontSize = '11px';
                            cell.style.wordWrap = 'break-word';
                            cell.style.maxWidth = '150px';
                        });
                        
                        // Compact headers
                        const headers = table.querySelectorAll('th');
                        headers.forEach(header => {
                            header.style.backgroundColor = '#e9ecef';
                            header.style.fontWeight = 'bold';
                            header.style.color = '#000000';
                            header.style.borderBottom = '2px solid #333';
                            header.style.fontSize = '11px';
                            header.style.padding = '4px 2px';
                        });
                    });
                    
                    // Compact text elements
                    const allText = document.querySelectorAll('p, span, div, label, h1, h2, h3, h4, h5, h6');
                    allText.forEach(element => {
                        if (element.textContent.trim()) {
                            element.style.fontFamily = 'Arial, sans-serif';
                            element.style.color = '#000000';
                            element.style.fontWeight = '500';
                            element.style.fontSize = '12px';
                        }
                    });
                    
                    // Set white background
                    document.body.style.backgroundColor = '#ffffff';
                });

                // Get optimized page dimensions
                const pageInfo = await this.page.evaluate(() => {
                    const contentSelectors = [
                        '.content-wrapper .content',
                        '.content-wrapper', 
                        '.container-fluid',
                        '.main-content',
                        '.content',
                        'main'
                    ];
                    
                    let bestElement = null;
                    let maxHeight = 0;
                    
                    for (const selector of contentSelectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            const rect = element.getBoundingClientRect();
                            if (rect.height > maxHeight && rect.width > 300) {
                                bestElement = element;
                                maxHeight = rect.height;
                            }
                        }
                    }
                    
                    if (bestElement) {
                        const rect = bestElement.getBoundingClientRect();
                        return {
                            x: Math.max(0, rect.x - 5),
                            y: Math.max(0, rect.y - 5),
                            width: Math.min(rect.width + 10, window.innerWidth - 20),
                            totalHeight: rect.height + 10,
                            viewportHeight: window.innerHeight
                        };
                    }
                    
                    // Compact fallback
                    const sidebarWidth = 220;
                    const headerHeight = 50;
                    
                    return {
                        x: sidebarWidth,
                        y: headerHeight,
                        width: window.innerWidth - sidebarWidth - 30,
                        totalHeight: document.body.scrollHeight - headerHeight,
                        viewportHeight: window.innerHeight
                    };
                });

                const screenshots = [];
                
                // Calculate compact screenshot areas
                const maxScreenshotHeight = 650; // Smaller height for better fit
                const maxWidth = Math.min(pageInfo.width, 900); // Smaller width limit
                const numScreenshots = Math.min(2, Math.ceil(pageInfo.totalHeight / maxScreenshotHeight));
                
                for (let i = 0; i < numScreenshots; i++) {
                    console.log(`📸 Taking compact screenshot ${i + 1}/${numScreenshots}...`);
                    
                    // Calculate y position and height for this screenshot
                    const startY = pageInfo.y + (i * maxScreenshotHeight);
                    const remainingHeight = pageInfo.totalHeight - (i * maxScreenshotHeight);
                    const currentHeight = Math.min(maxScreenshotHeight, remainingHeight);
                    
                    // Ensure minimum dimensions for Telegram
                    if (currentHeight < 100 || maxWidth < 200) {
                        console.log(`⚠️ Skipping screenshot ${i + 1} - dimensions too small`);
                        continue;
                    }
                    
                    // Scroll to position
                    await this.page.evaluate((scrollY) => {
                        window.scrollTo({
                            top: scrollY,
                            behavior: 'instant'
                        });
                    }, startY - pageInfo.y);
                    
                    // Wait for scroll to complete
                    await new Promise(r => setTimeout(r, 1000));
                    
                    // Take compact screenshot
                    const screenshot = await this.page.screenshot({
                        type: 'jpeg',
                        quality: 80, // Slightly reduced for smaller file size
                        clip: {
                            x: pageInfo.x,
                            y: startY,
                            width: maxWidth,
                            height: currentHeight
                        },
                        omitBackground: false,
                        captureBeyondViewport: false,
                        optimizeForSpeed: false
                    });
                    
                    // Validate screenshot size
                    if (screenshot && screenshot.length > 0) {
                        screenshots.push({
                            data: screenshot,
                            part: i + 1,
                            total: numScreenshots
                        });
                    } else {
                        console.log(`⚠️ Invalid screenshot ${i + 1} - skipping`);
                    }
                }

                // Navigate back to production list
                await this.page.goto(this.productionUrl, {
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });

                if (screenshots.length > 0) {
                    console.log(`✅ ${screenshots.length} compact production screenshots captured`);
                    return {
                        type: 'multiple_images',
                        screenshots: screenshots,
                        productionId: productionId
                    };
                } else {
                    console.log('❌ No valid screenshots captured');
                    return null;
                }
            } else {
                // Handle modal case with compact styling
                const modalExists = await this.page.$('#DetailModal, .modal');
                if (modalExists) {
                    console.log('📸 Taking compact modal screenshot...');
                    
                    // Compact modal content
                    await this.page.evaluate(() => {
                        const modal = document.querySelector('#DetailModal .modal-dialog, .modal .modal-dialog');
                        if (modal) {
                            modal.style.maxWidth = '70%';
                            modal.style.width = '700px';
                            modal.scrollTop = 0;
                            modal.style.backgroundColor = '#ffffff';
                        }
                        
                        // Compact tables in modal
                        const tables = document.querySelectorAll('#DetailModal .table, .modal .table');
                        tables.forEach(table => {
                            table.style.fontSize = '11px';
                            table.style.width = '100%';
                            table.style.fontFamily = 'Arial, sans-serif';
                            table.style.backgroundColor = '#ffffff';
                            table.style.border = '1px solid #333';
                            
                            const cells = table.querySelectorAll('td, th');
                            cells.forEach((cell, index) => {
                                cell.style.padding = '4px 3px';
                                cell.style.border = '1px solid #333';
                                cell.style.backgroundColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
                                cell.style.color = '#000000';
                                cell.style.fontWeight = '500';
                                cell.style.fontSize = '10px';
                                cell.style.wordWrap = 'break-word';
                            });
                        });
                    });
                    
                    // Wait for modal styling
                    await new Promise(r => setTimeout(r, 1000));
                    
                    // Get compact modal dimensions
                    const dimensions = await this.page.evaluate(() => {
                        const modalContent = document.querySelector('#DetailModal .modal-content, .modal .modal-content');
                        if (modalContent) {
                            const rect = modalContent.getBoundingClientRect();
                            return {
                                x: Math.max(0, rect.x),
                                y: Math.max(0, rect.y),
                                width: Math.min(rect.width, 700), // Compact width
                                height: Math.min(rect.height, 600) // Compact height
                            };
                        }
                        return null;
                    });

                    if (dimensions && dimensions.width >= 100 && dimensions.height >= 100) {
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
                            const closeBtn = document.querySelector('#DetailModal button.btn-close, .modal .btn-close, .modal .close');
                            if (closeBtn) closeBtn.click();
                        });

                        return {
                            type: 'image',
                            data: screenshot,
                            caption: `🏭 Detail Produksi #${productionId}`
                        };
                    }
                }
            }

            console.log('❌ Could not capture production detail');
            return null;

        } catch (error) {
            console.error('❌ Production detail fetch error:', error);
            // Try to navigate back to production list if error occurs
            try {
                await this.page.goto(this.productionUrl, {
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });
            } catch (navError) {
                console.error('❌ Error navigating back to production list:', navError);
            }
            return null;
        }
    }

    async checkNewProductions() {
        try {
            console.log('🔍 Checking for new productions...');
            await this.page.goto(this.productionUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            
            // Get current productions
            const currentData = await this.page.evaluate(() => {
                return Array.from(document.querySelectorAll('.table tbody tr'))
                    .map(row => {
                        const cells = row.querySelectorAll('td');
                        return {
                            number: cells[1]?.textContent.trim() || '',
                            tanggal: cells[2]?.textContent.trim() || '',
                            jenis: cells[3]?.textContent.trim() || '',
                            status: cells[4]?.textContent.trim() || ''
                        };
                    })
                    .filter(item => item.status && item.status !== 'Selesai');
            });

            // Check for new productions
            if (!this.lastCheckedData) {
                this.lastCheckedData = currentData;
                return currentData;
            }

            // Find new productions
            const newProductions = currentData.filter(current => 
                !this.lastCheckedData.some(last => last.number === current.number)
            );

            // Update last checked data
            this.lastCheckedData = currentData;

            return newProductions;
        } catch (error) {
            console.error('❌ Error checking new productions:', error);
            return [];
        }
    }

    formatNewProductionNotification(productions) {
        if (!productions || productions.length === 0) return null;

        const header = `🔔 ɴᴇᴡ ᴘʀᴏᴅᴜᴄᴛɪᴏɴ ᴏʀᴅᴇʀs!\n\n`;
        const items = productions.map(production => 
            `🏭 ᴘʀᴏᴅᴜᴄᴛɪᴏɴ #${toSmallCaps(production.number)}\n` +
            `📅 ᴛᴀɴɢɢᴀʟ: ${toSmallCaps(production.tanggal)}\n` +
            `📝 ᴊᴇɴɪs: ${toSmallCaps(production.jenis)}\n` +
            `📊 sᴛᴀᴛᴜs: ${formatStatus(production.status)}`
        ).join('\n\n');

        return header + items;
    }
}

module.exports = ProductionChecker;
