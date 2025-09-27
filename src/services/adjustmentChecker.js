const { toSmallCaps, formatTableHeader, formatDataRow, formatStatus } = require('../utils/textFormatter');

class AdjustmentChecker {
    constructor(page) {
        this.page = page;
        this.adjustmentUrl = 'https://portal.rajawalielastis.com/bo/transaksi/adjustment';
        this.itemsPerPage = 5;
        this.cachedData = null;
    }

    async fetchAdjustmentData(pageNum = 1, forceRefresh = false) {
        try {
            // Use cached data if available and not forcing refresh
            if (this.cachedData && !forceRefresh) {
                console.log('📦 Using cached Adjustment data...');
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
            console.log('📦 Fetching fresh Adjustment data from web...');
            await this.page.goto(this.adjustmentUrl, {
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
                        return cells.length >= 5 ? {
                            number: cells[1]?.textContent?.trim() || '',
                            date: cells[2]?.textContent?.trim() || '',
                            status: cells[3]?.textContent?.trim() || ''
                        } : null;
                    })
                    .filter(item => item && item.number);
            });

            // Use cached data for pagination
            const totalItems = this.cachedData.length;
            const totalPages = Math.ceil(totalItems / this.itemsPerPage);
            const startIdx = (pageNum - 1) * this.itemsPerPage;
            const endIdx = Math.min(startIdx + this.itemsPerPage, totalItems);

            console.log(`✅ Cached ${totalItems} fresh Adjustment entries`);
            
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
            console.error('❌ Error fetching Adjustment data:', error);
            
            // Attempt to get data even if waiting times out
            try {
                console.log('⚠️ Timeout occurred, attempting to get available data...');
                this.cachedData = await this.page.evaluate(() => {
                    return Array.from(document.querySelectorAll('#data-transaction tbody tr'))
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

    formatAdjustmentResult(data, pagination) {
        if (!data || data.length === 0) return '❌ ɴᴏ ᴀᴅᴊᴜsᴛᴍᴇɴᴛ ᴅᴀᴛᴀ ғᴏᴜɴᴅ';

        const header = `📦 ᴀᴅᴊᴜsᴛᴍᴇɴᴛ ʟɪsᴛ (ᴘᴀɢᴇ ${pagination.currentPage}/${pagination.totalPages})\n` +
                      `sʜᴏᴡɪɴɢ ɪᴛᴇᴍs ${pagination.startItem}-${pagination.endItem} ᴏғ ${pagination.totalItems}\n\n`;
        
        const items = data.map(item => 
            `📦 ${toSmallCaps(item.number)}\n` +
            `📅 ${toSmallCaps(item.date)}\n` +
            `📊 sᴛᴀᴛᴜs: ${formatStatus(item.status)}`
        ).join('\n\n');

        return header + items;
    }

    async createAdjustment(adjustmentData) {
        try {
            console.log('📦 Creating new stock adjustment...');
            
            // Navigate to adjustment page
            await this.page.goto(this.adjustmentUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Wait for page to load
            await new Promise(r => setTimeout(r, 2000));

            // Click Add button to open modal
            console.log('🔘 Clicking Add button...');
            const addClicked = await this.page.evaluate(() => {
                // Look for Add button (Tambah button) - fix the selector
                let addBtn = null;
                
                // Try different ways to find the Add button
                // 1. Try data-bs-target attribute
                addBtn = document.querySelector('button[data-bs-target="#Add"]');
                if (addBtn) {
                    addBtn.click();
                    return true;
                }
                
                // 2. Try a link with data-bs-target
                addBtn = document.querySelector('a[data-bs-target="#Add"]');
                if (addBtn) {
                    addBtn.click();
                    return true;
                }
                
                // 3. Look for button containing "Tambah" text
                const buttons = document.querySelectorAll('button, a');
                for (const btn of buttons) {
                    if (btn.textContent && btn.textContent.includes('Tambah')) {
                        btn.click();
                        return true;
                    }
                }
                
                // 4. Look for primary button with plus icon
                const primaryBtns = document.querySelectorAll('.btn-primary');
                for (const btn of primaryBtns) {
                    if (btn.querySelector('.bx-plus') || btn.textContent.includes('Tambah')) {
                        btn.click();
                        return true;
                    }
                }
                
                return false;
            });

            if (!addClicked) {
                console.log('❌ Add button not found');
                return {
                    success: false,
                    error: 'Add button not found'
                };
            }

            // Wait for modal to open
            console.log('⌛ Waiting for modal to open...');
            await this.page.waitForSelector('#Add', { 
                visible: true,
                timeout: 10000 
            });
            
            // Wait for modal content to load
            await new Promise(r => setTimeout(r, 2000));

            // Parse adjustment data: "Stock Masuk,Contoh catatan,Contoh Nama Barang,10"
            const [stockType, note, itemName, qty] = adjustmentData.split(',').map(item => item.trim());

            // Step 1: Select transaction type (Jenis Transaksi)
            console.log(`📝 Selecting transaction type: ${stockType}`);
            await this.page.evaluate((type) => {
                const select = document.querySelector('select[name="POS_TADH_MJT_ID"]');
                if (select) {
                    // Stock Masuk = value 15 (Adjustment Plus)
                    // Stock Keluar = value 16 (Adjustment Minus)
                    const value = type.toLowerCase().includes('masuk') ? '15' : '16';
                    select.value = value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, stockType);

            // Step 2: Fill note (Catatan Penyesuaian Stock)
            console.log(`📝 Filling note: ${note}`);
            await this.page.evaluate((noteText) => {
                const noteTextarea = document.querySelector('#POS_TADH_Note');
                if (noteTextarea) {
                    noteTextarea.value = noteText;
                    noteTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, note);

            // Step 3: Wait for item dropdown to load and select item
            console.log(`📝 Selecting item: ${itemName}`);
            await this.page.waitForSelector('#POS_TADD_MBR_ID');
            
            // Load item options first
            await this.page.evaluate(() => {
                const select = document.querySelector('#POS_TADD_MBR_ID');
                if (select) {
                    // Trigger focus to load options if needed
                    select.focus();
                    select.dispatchEvent(new Event('focus', { bubbles: true }));
                }
            });
            
            await new Promise(r => setTimeout(r, 1000));

            // Select the item
            const itemSelected = await this.page.evaluate((name) => {
                const select = document.querySelector('#POS_TADD_MBR_ID');
                if (select) {
                    const options = Array.from(select.options);
                    const matchingOption = options.find(option => 
                        option.text.toLowerCase().includes(name.toLowerCase())
                    );
                    
                    if (matchingOption) {
                        select.value = matchingOption.value;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                        return {
                            found: true,
                            itemName: matchingOption.text,
                            itemId: matchingOption.value
                        };
                    }
                }
                return { found: false };
            }, itemName);

            if (!itemSelected.found) {
                console.log(`❌ Item "${itemName}" not found`);
                return {
                    success: false,
                    error: `Item "${itemName}" not found`
                };
            }

            console.log(`✅ Selected item: ${itemSelected.itemName}`);

            // Step 4: Fill quantity
            console.log(`📝 Filling quantity: ${qty}`);
            await this.page.evaluate((quantity) => {
                const qtyInput = document.querySelector('input[name="POS_TADD_QTY[]"]');
                if (qtyInput) {
                    qtyInput.value = quantity;
                    qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, qty);

            // Step 5: Check "Langsung Menunggu Approve" checkbox
            console.log('✅ Checking "Langsung Menunggu Approve" checkbox...');
            await this.page.evaluate(() => {
                const checkbox = document.querySelector('input[name="flag_langsung"]');
                if (checkbox && !checkbox.checked) {
                    checkbox.click();
                }
            });

            // Step 6: Click Save button
            console.log('💾 Clicking Save button...');
            const saveClicked = await this.page.evaluate(() => {
                // Look for Save button (Simpan button) in the modal
                const modal = document.querySelector('#Add');
                if (modal) {
                    // Try different ways to find the Save button within the modal
                    let saveBtn = null;
                    
                    // 1. Look for submit button with type="submit"
                    saveBtn = modal.querySelector('button[type="submit"]');
                    if (saveBtn) {
                        saveBtn.click();
                        return true;
                    }
                    
                    // 2. Look for button containing "Simpan" text
                    const buttons = modal.querySelectorAll('button');
                    for (const btn of buttons) {
                        if (btn.textContent && btn.textContent.includes('Simpan')) {
                            btn.click();
                            return true;
                        }
                    }
                    
                    // 3. Look for primary button in modal footer
                    const primaryBtn = modal.querySelector('.modal-footer .btn-primary');
                    if (primaryBtn) {
                        primaryBtn.click();
                        return true;
                    }
                }
                return false;
            });

            if (!saveClicked) {
                console.log('❌ Save button not found');
                return {
                    success: false,
                    error: 'Save button not found'
                };
            }

            // Wait for form submission and modal to close
            console.log('⌛ Waiting for form submission...');
            await new Promise(r => setTimeout(r, 3000));

            // Check if modal is closed (indicating successful submission)
            const modalClosed = await this.page.evaluate(() => {
                const modal = document.querySelector('#Add');
                return !modal || modal.style.display === 'none' || !modal.classList.contains('show');
            });

            if (modalClosed) {
                console.log('✅ Adjustment created successfully');
                
                return {
                    success: true,
                    message: 'Stock adjustment created successfully',
                    data: {
                        stockType: stockType,
                        note: note,
                        itemName: itemSelected.itemName,
                        quantity: qty,
                        autoApprove: true,
                        status: 'Submitted'
                    }
                };
            } else {
                console.log('⚠️ Modal still open, checking for validation errors...');
                
                // Check for validation errors
                const validationError = await this.page.evaluate(() => {
                    const errorElements = document.querySelectorAll('.invalid-feedback, .text-danger, .alert-danger');
                    if (errorElements.length > 0) {
                        return Array.from(errorElements).map(el => el.textContent.trim()).join(', ');
                    }
                    return null;
                });

                if (validationError) {
                    return {
                        success: false,
                        error: `Validation error: ${validationError}`
                    };
                } else {
                    return {
                        success: false,
                        error: 'Form submission failed for unknown reason'
                    };
                }
            }

        } catch (error) {
            console.error('❌ Error creating adjustment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async ensureDataLoaded() {
        if (!this.cachedData) {
            await this.fetchAdjustmentData(1);
        }
    }

    async getAdjustmentDetail(adjustmentId) {
        try {
            console.log(`📦 Getting details for Adjustment ID: ${adjustmentId}`);
            
            // Set larger viewport to accommodate modal
            await this.page.setViewport({
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1
            });

            // Click detail button - sesuai dengan HTML yang diberikan
            const clicked = await this.page.evaluate((id) => {
                const rows = document.querySelectorAll('#data-transaction tbody tr');
                for (const row of rows) {
                    // Cari berdasarkan link di kolom No ID (kolom ke-2)
                    const idLink = row.querySelector('td:nth-child(2) a.detail-doc');
                    if (idLink && idLink.textContent.trim() === id) {
                        idLink.click();
                        return true;
                    }
                    
                    // Fallback: cari berdasarkan tombol detail di kolom Opsi (kolom terakhir)
                    const detailBtn = row.querySelector('td:last-child a.detail-doc');
                    if (detailBtn) {
                        // Cek apakah data-id sesuai dengan ID yang dicari
                        const dataId = detailBtn.getAttribute('data-id');
                        // Atau cek berdasarkan row yang mengandung ID
                        const idCell = row.querySelector('td:nth-child(2)');
                        if (idCell && idCell.textContent.trim() === id) {
                            detailBtn.click();
                            return true;
                        }
                    }
                }
                return false;
            }, adjustmentId);

            if (!clicked) {
                console.log('❌ Detail button not found for ID:', adjustmentId);
                return null;
            }

            // Wait for modal and enhance its appearance - sesuai dengan HTML modal
            console.log('⌛ Waiting for adjustment modal to open...');
            await this.page.waitForSelector('#DetailModal', { 
                visible: true,
                timeout: 10000 
            });
            
            // Enhance modal appearance
            await this.page.evaluate(() => {
                const modal = document.querySelector('#DetailModal .modal-dialog');
                if (modal) {
                    modal.style.maxWidth = '900px';
                    modal.style.margin = '30px auto';
                    modal.style.backgroundColor = 'white';
                    document.body.style.backgroundColor = 'rgba(0,0,0,0.5)';
                }
                
                // Ensure modal content is loaded
                const modalBody = document.querySelector('#DetailModal_Body');
                if (modalBody) {
                    modalBody.style.backgroundColor = 'white';
                    modalBody.style.padding = '20px';
                }
            });

            // Wait for modal content to load - penting untuk AJAX content
            await new Promise(r => setTimeout(r, 2000));

            // Wait for AJAX content to load in modal body
            await this.page.waitForFunction(() => {
                const modalBody = document.querySelector('#DetailModal_Body');
                return modalBody && modalBody.innerHTML.trim() !== '';
            }, { timeout: 5000 });

            // Get modal dimensions
            const dimensions = await this.page.evaluate(() => {
                const modal = document.querySelector('#DetailModal .modal-content');
                if (!modal) return null;
                const rect = modal.getBoundingClientRect();
                return {
                    x: Math.max(0, rect.x),
                    y: Math.max(0, rect.y),
                    width: rect.width,
                    height: rect.height
                };
            });

            if (!dimensions) {
                console.log('❌ Modal not found');
                return null;
            }

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

            // Close modal using the correct close button
            await this.page.evaluate(() => {
                const closeBtn = document.querySelector('#DetailModal button.btn-close') || 
                                document.querySelector('#DetailModal .btn-outline-secondary');
                if (closeBtn) closeBtn.click();
            });

            return {
                type: 'image',
                data: screenshot,
                caption: `📦 Detail Penyesuaian Stok #${adjustmentId}`
            };

        } catch (error) {
            console.error('❌ Adjustment detail fetch error:', error);
            return null;
        }
    }
}

module.exports = AdjustmentChecker;
