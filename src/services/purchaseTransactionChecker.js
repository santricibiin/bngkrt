const { toSmallCaps, formatTableHeader, formatDataRow, formatStatus } = require('../utils/textFormatter');

class PurchaseTransactionChecker {
    constructor(page) {
        this.page = page;
        this.purchaseUrl = 'https://portal.rajawalielastis.com/bo/transaksi/pembelian';
        this.itemsPerPage = 5;
        this.cachedData = null;
    }

    async fetchPurchaseData(pageNum = 1, forceRefresh = false) {
        try {
            // Use cached data if available and not forcing refresh
            if (this.cachedData && !forceRefresh) {
                console.log('🛒 Using cached Purchase data...');
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
            console.log('🛒 Fetching fresh Purchase data from web...');
            await this.page.goto(this.purchaseUrl, {
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
                            supplier: cells[2]?.textContent?.trim() || '',
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

            console.log(`✅ Cached ${totalItems} fresh Purchase entries`);
            
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
                    return Array.from(document.querySelectorAll('.table tbody tr'))
                        .map(row => {
                            const cells = row.querySelectorAll('td');
                            return {
                                number: cells[1]?.textContent?.trim() || '',
                                supplier: cells[2]?.textContent?.trim() || '',
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

    formatPurchaseResult(data, pagination) {
        if (!data || data.length === 0) return `❌ ${toSmallCaps('No Purchase data found')}`;

        const header = `🛒 ${toSmallCaps(`Purchase List (Page ${pagination.currentPage}/${pagination.totalPages})`)}\n` +
                      `${toSmallCaps(`Showing items ${pagination.startItem}-${pagination.endItem} of ${pagination.totalItems}`)}\n\n`;
        
        const items = data.map(item => 
            `🛒 ${toSmallCaps(item.number)}\n` +
            `🏪 ${toSmallCaps(item.supplier)}\n` +
            `📅 ${toSmallCaps(item.date)}\n` +
            `📊 ${toSmallCaps('Status')}: ${toSmallCaps(item.status)}`
        ).join('\n\n');

        return header + items;
    }

    async createPurchaseTransaction(transactionData) {
        try {
            console.log('🛒 Creating purchase transaction...');
            
            // Parse transaction data untuk multiple items
            // Format: "PL,TOKO AP CIKADU,piutang,0,1234,Item1,Qty1,Disc1,Item2,Qty2,Disc2,..."
            const parts = transactionData.split(',').map(part => part.trim());
            if (parts.length < 8) {
                return {
                    success: false,
                    error: 'Invalid data format. Expected: Type,Supplier,Payment,Termin,Invoice,Item,Qty,Discount[,Item2,Qty2,Disc2,...]'
                };
            }

            const [typeCode, supplierName, paymentType, termin, invoice] = parts.slice(0, 5);
            
            // Parse items (mulai dari index 5, setiap 3 element adalah satu item)
            const items = [];
            for (let i = 5; i < parts.length; i += 3) {
                if (i + 2 < parts.length) { // Pastikan ada nama, qty, dan discount
                    items.push({
                        name: parts[i],
                        qty: parts[i + 1],
                        discount: parts[i + 2]
                    });
                }
            }

            if (items.length === 0) {
                return {
                    success: false,
                    error: 'No valid items found. Each item needs: Name,Qty,Discount'
                };
            }

            console.log(`📦 Found ${items.length} items to process:`, items.map(item => item.name));

            // Navigate to purchase page
            await this.page.goto(this.purchaseUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Wait for the DataTables to fully load
            await this.page.waitForSelector('#data-transaction', { timeout: 10000 });
            await new Promise(r => setTimeout(r, 2000));

            // Click add button to open modal - using same approach as HTML shows
            console.log('🔍 Clicking add button...');
            const clicked = await this.page.evaluate(() => {
                // Look for the "Tambah" button as shown in the HTML
                const addBtn = document.querySelector('.create-new.btn.btn-primary');
                if (addBtn) {
                    addBtn.click();
                    return true;
                }
                return false;
            });

            if (!clicked) {
                console.log('❌ Add button not found');
                return {
                    success: false,
                    error: 'Add button not found on page'
                };
            }

            // Wait for modal to open
            console.log('⌛ Waiting for add modal to open...');
            await this.page.waitForSelector('#Add', { visible: true, timeout: 10000 });
            await new Promise(r => setTimeout(r, 2000)); // Jeda 2 detik

            // Wait for all form elements to be ready
            await this.page.waitForSelector('#POS_TPBH_FlagLangsung');
            await this.page.waitForSelector('#POS_TPBH_MS_ID');
            await this.page.waitForSelector('#POS_TPBH_MTB_ID');

            // Fill Type Pembelian
            console.log('📋 Filling Type Pembelian...');
            const typeValue = typeCode.toUpperCase() === 'PL' ? 'Y' : 'N';
            await this.page.select('#POS_TPBH_FlagLangsung', typeValue);
            await new Promise(r => setTimeout(r, 2000)); // Jeda 2 detik

            // Fill Supplier
            console.log('🏪 Filling Supplier...');
            await this.page.evaluate((supplier) => {
                const select = document.querySelector('#POS_TPBH_MS_ID');
                const option = Array.from(select.options).find(opt => 
                    opt.text.toLowerCase().includes(supplier.toLowerCase())
                );
                if (option) {
                    select.value = option.value;
                    // Trigger change event
                    select.dispatchEvent(new Event('change'));
                }
            }, supplierName);
            await new Promise(r => setTimeout(r, 2000)); // Jeda 2 detik

            // Fill Payment Type
            console.log('💰 Filling Payment Type...');
            await this.page.evaluate((payment) => {
                const select = document.querySelector('#POS_TPBH_MTB_ID');
                const option = Array.from(select.options).find(opt => 
                    opt.text.toLowerCase().includes(payment.toLowerCase())
                );
                if (option) {
                    select.value = option.value;
                    // Trigger change event
                    select.dispatchEvent(new Event('change'));
                }
            }, paymentType);
            await new Promise(r => setTimeout(r, 2000)); // Jeda 2 detik

            // Fill Termin
            console.log('📅 Filling Termin...');
            await this.page.evaluate((value) => {
                const field = document.querySelector('#POS_TPBH_Termin');
                if (field) {
                    field.value = '';
                    field.value = value;
                    field.dispatchEvent(new Event('input'));
                }
            }, termin);
            await new Promise(r => setTimeout(r, 2000)); // Jeda 2 detik

            // Fill Invoice Number
            console.log('📄 Filling Invoice Number...');
            await this.page.evaluate((value) => {
                const field = document.querySelector('#POS_TPBH_NoFaktur');
                if (field) {
                    field.value = '';
                    field.value = value;
                    field.dispatchEvent(new Event('input'));
                }
            }, invoice);
            await new Promise(r => setTimeout(r, 2000)); // Jeda 2 detik

            // Process multiple items
            console.log(`📦 Processing ${items.length} items...`);
            const processedItems = [];
            
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                console.log(`� Processing item ${i + 1}/${items.length}: ${item.name}`);
                
                // Fill Item details for current item
                await this.fillItemDetails(item, i + 1);
                processedItems.push(item);
                
                // Jika bukan item terakhir, klik tombol "Tambah Barang"
                if (i < items.length - 1) {
                    console.log('➕ Adding new item row...');
                    await this.clickAddItemButton();
                    await new Promise(r => setTimeout(r, 2000)); // Jeda setelah tambah item
                }
            }

            console.log('✅ All items processed. Ready for manual save verification.');
            
            // Sekarang klik tombol simpan setelah semua form terisi
            console.log('💾 Clicking save button...');
            const saveClicked = await this.page.evaluate(() => {
                const saveBtn = document.querySelector('#Add .modal-footer button[type="submit"].btn-primary');
                if (saveBtn) {
                    saveBtn.click();
                    return true;
                }
                return false;
            });

            if (!saveClicked) {
                console.log('❌ Save button not found');
                return {
                    success: false,
                    error: 'Save button not found in modal'
                };
            }

            // Wait for form submission and modal to close
            console.log('⌛ Waiting for form submission...');
            await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds for submission

            // Check if modal is closed (indicating successful submission)
            const modalClosed = await this.page.evaluate(() => {
                const modal = document.querySelector('#Add');
                return !modal || !modal.classList.contains('show');
            });
            
            return {
                success: true,
                data: {
                    type: typeCode.toUpperCase() === 'PL' ? 'Pembelian Langsung (PL)' : 'Purchase Order (PO)',
                    supplier: supplierName,
                    paymentType: paymentType,
                    termin: termin,
                    invoice: invoice,
                    itemsProcessed: processedItems.length,
                    items: processedItems,
                    status: modalClosed ? 'Transaction saved successfully to database!' : 'Form submitted, please verify manually',
                    modalClosed: modalClosed,
                    note: modalClosed ? '✅ Transaksi berhasil disimpan ke database' : '⚠️ Form telah disubmit, silakan verifikasi manual'
                }
            };

        } catch (error) {
            console.error('❌ Error creating purchase transaction:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async fillItemDetails(item, itemIndex = 1) {
        try {
            console.log(`📦 Filling details for item ${itemIndex}: ${item.name}`);
            
            let itemSelector, qtySelector, discSelector;
            
            if (itemIndex === 1) {
                // Item pertama menggunakan ID standar
                itemSelector = '#POS_TPBD_MBR_ID';
                qtySelector = '#POS_TPBD_QTY_1';
                discSelector = 'input[data-targetcurrency="POS_TPBD_Disc_1"]';
            } else {
                // Item selanjutnya menggunakan timestamp, kita perlu mencari yang terbaru
                const selectors = await this.page.evaluate(() => {
                    // Ambil semua select dengan nama POS_TPBD_MBR_ID[]
                    const allSelects = Array.from(document.querySelectorAll('select[name="POS_TPBD_MBR_ID[]"]'));
                    if (allSelects.length === 0) return null;
                    
                    // Ambil yang terakhir (yang baru saja ditambahkan)
                    const lastSelect = allSelects[allSelects.length - 1];
                    const selectId = lastSelect.id;
                    
                    // Extract timestamp dari ID (format: POS_TPBD_MBR_ID{timestamp})
                    const timestamp = selectId.replace('POS_TPBD_MBR_ID', '');
                    
                    return {
                        itemSelector: `#${selectId}`,
                        qtySelector: `#POS_TPBD_QTY_${timestamp}`,
                        discSelector: `input[data-targetcurrency="POS_TPBD_Disc_${timestamp}"]`
                    };
                });
                
                if (!selectors) {
                    console.log(`❌ Could not find selectors for item ${itemIndex}`);
                    return false;
                }
                
                itemSelector = selectors.itemSelector;
                qtySelector = selectors.qtySelector;
                discSelector = selectors.discSelector;
            }
            
            console.log(`🎯 Using selectors - Item: ${itemSelector}, Qty: ${qtySelector}, Disc: ${discSelector}`);
            
            // Wait for item selector to be available
            await this.page.waitForSelector(itemSelector, { timeout: 5000 });
            
            // Fill Item Name
            console.log(`📝 Selecting item: ${item.name}`);
            await this.page.evaluate((itemName, selector) => {
                const select = document.querySelector(selector);
                if (select) {
                    const option = Array.from(select.options).find(opt => 
                        opt.text.toLowerCase().includes(itemName.toLowerCase())
                    );
                    if (option) {
                        select.value = option.value;
                        // Trigger change event to load price
                        select.dispatchEvent(new Event('change'));
                        // Also trigger the setHarga function
                        if (typeof setHarga === 'function') {
                            setHarga(select);
                        }
                    }
                }
            }, item.name, itemSelector);
            await new Promise(r => setTimeout(r, 2000)); // Wait for price loading

            // Fill Quantity
            console.log(`🔢 Setting quantity: ${item.qty}`);
            await this.page.evaluate((qty, selector) => {
                const field = document.querySelector(selector);
                if (field) {
                    field.value = '';
                    field.value = qty;
                    field.dispatchEvent(new Event('input'));
                    field.dispatchEvent(new Event('keyup')); // Trigger keyup untuk kalkulasi
                }
            }, item.qty, qtySelector);
            await new Promise(r => setTimeout(r, 1000));

            // Fill Discount
            console.log(`💸 Setting discount: ${item.discount}`);
            await this.page.evaluate((discount, selector) => {
                const field = document.querySelector(selector);
                if (field) {
                    field.value = '';
                    field.value = discount;
                    field.dispatchEvent(new Event('input'));
                    field.dispatchEvent(new Event('keyup')); // Trigger keyup untuk kalkulasi
                }
            }, item.discount, discSelector);
            await new Promise(r => setTimeout(r, 1000));

            console.log(`✅ Item ${itemIndex} filled successfully`);
            return true;

        } catch (error) {
            console.error(`❌ Error filling item ${itemIndex}:`, error);
            return false;
        }
    }

    async clickAddItemButton() {
        try {
            console.log('➕ Clicking add item button...');
            
            // Cari dan klik tombol "Tambah Barang" berdasarkan HTML structure yang diberikan
            const clicked = await this.page.evaluate(() => {
                // Cari tombol berdasarkan onClick="add_field()" dari HTML structure
                const addFieldButton = document.querySelector('button[onclick="add_field()"]');
                if (addFieldButton) {
                    addFieldButton.click();
                    return true;
                }
                
                // Alternatif: cari berdasarkan text content "Tambah Barang"
                const buttons = Array.from(document.querySelectorAll('button'));
                const tambahBarangButton = buttons.find(btn => 
                    btn.textContent.toLowerCase().includes('tambah barang') ||
                    btn.innerHTML.toLowerCase().includes('tambah barang')
                );
                
                if (tambahBarangButton) {
                    tambahBarangButton.click();
                    return true;
                }
                
                // Alternatif ketiga: cari berdasarkan class dan icon
                const buttonWithIcon = document.querySelector('button.btn-secondary.btn-primary');
                if (buttonWithIcon && buttonWithIcon.innerHTML.includes('bx-plus')) {
                    buttonWithIcon.click();
                    return true;
                }
                
                return false;
            });

            if (!clicked) {
                console.log('❌ Add item button not found');
                return false;
            }

            console.log('✅ Add item button clicked successfully');
            
            // Wait untuk DOM update setelah add_field() dipanggil
            await new Promise(r => setTimeout(r, 1000));
            
            return true;

        } catch (error) {
            console.error('❌ Error clicking add item button:', error);
            return false;
        }
    }

    async ensureDataLoaded() {
        if (!this.cachedData) {
            await this.fetchPurchaseData(1);
        }
    }
}

module.exports = PurchaseTransactionChecker;
