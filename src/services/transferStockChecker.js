const cheerio = require('cheerio');
const { toSmallCaps, formatTableHeader, formatDataRow, formatStatus } = require('../utils/textFormatter');

class TransferStockChecker {
    constructor() {
        this.transferStockUrl = 'https://portal.rajawalielastis.com/bo/transaksi/transferstock';
    }

    async navigateToTransferStock(page) {
        try {
            console.log('Navigating to Transfer Stock page...');
            await page.goto(this.transferStockUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            // Wait for the main content to load
            await page.waitForSelector('.card-datatable', { timeout: 15000 });
            
            console.log('Successfully navigated to Transfer Stock page');
            return true;
        } catch (error) {
            console.error('Error navigating to Transfer Stock page:', error.message);
            throw error;
        }
    }

    async openAddTransferStockModal(page) {
        try {
            console.log('Opening Add Transfer Stock modal...');
            
            // Wait for and click the "Tambah" button (create-new class based on HTML)
            await page.waitForSelector('.create-new', { timeout: 10000 });
            await page.click('.create-new');
            
            // Wait for the modal to appear
            await page.waitForSelector('#Add', { timeout: 10000 });
            await page.waitForSelector('#Add.show', { timeout: 5000 });
            
            // Wait for the form elements to be ready
            await page.waitForSelector('#POS_TTSH_MP_Penerima', { timeout: 5000 });
            await page.waitForSelector('#POS_TTSH_NamaPengirim', { timeout: 5000 });
            await page.waitForSelector('#POS_TTSH_NoKendaraan', { timeout: 5000 });
            await page.waitForSelector('#POS_TTSH_Alasan_TF', { timeout: 5000 });
            
            console.log('Add Transfer Stock modal opened successfully');
            return true;
        } catch (error) {
            console.error('Error opening Add Transfer Stock modal:', error.message);
            throw error;
        }
    }

    async getPlantOptions(page) {
        try {
            console.log('Getting plant options...');
            
            // Wait for the plant dropdown to be available
            await page.waitForSelector('#POS_TTSH_MP_Penerima', { timeout: 10000 });
            
            // Get all plant options
            const plantOptions = await page.evaluate(() => {
                const select = document.querySelector('#POS_TTSH_MP_Penerima');
                const options = Array.from(select.querySelectorAll('option'));
                return options
                    .filter(option => option.value && option.value !== '')
                    .map(option => ({
                        value: option.value,
                        text: option.textContent.trim()
                    }));
            });
            
            console.log('Plant options retrieved:', plantOptions);
            return plantOptions;
        } catch (error) {
            console.error('Error getting plant options:', error.message);
            throw error;
        }
    }

    async getItemOptions(page) {
        try {
            console.log('Getting item options...');
            
            // Wait for the item dropdown to be available
            await page.waitForSelector('#POS_TTSD_MBR_ID', { timeout: 10000 });
            
            // Get all item options (they are loaded via AJAX)
            await page.waitForFunction(() => {
                const select = document.querySelector('#POS_TTSD_MBR_ID');
                return select && select.options.length > 1; // More than just the placeholder
            }, { timeout: 15000 });
            
            const itemOptions = await page.evaluate(() => {
                const select = document.querySelector('#POS_TTSD_MBR_ID');
                const options = Array.from(select.querySelectorAll('option'));
                return options
                    .filter(option => option.value && option.value !== '')
                    .map(option => ({
                        value: option.value,
                        text: option.textContent.trim()
                    }));
            });
            
            console.log(`Retrieved ${itemOptions.length} item options`);
            return itemOptions;
        } catch (error) {
            console.error('Error getting item options:', error.message);
            throw error;
        }
    }

    async fillTransferStockForm(page, formData) {
        try {
            console.log('Filling transfer stock form with data:', formData);
            
            // Add initial delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Fill Plant Penerima - need to select by value matching the plant name
            if (formData.plantPenerima) {
                console.log('Selecting Plant Penerima...');
                // Get all options to find the matching plant
                const plantOptions = await page.evaluate(() => {
                    const select = document.querySelector('#POS_TTSH_MP_Penerima');
                    const options = Array.from(select.querySelectorAll('option'));
                    return options.map(option => ({
                        value: option.value,
                        text: option.textContent.trim()
                    }));
                });
                
                // Find matching plant by name
                const matchingPlant = plantOptions.find(plant => 
                    plant.text.toLowerCase().includes(formData.plantPenerima.toLowerCase()) ||
                    formData.plantPenerima.toLowerCase().includes(plant.text.toLowerCase())
                );
                
                if (matchingPlant) {
                    await page.select('#POS_TTSH_MP_Penerima', matchingPlant.value);
                    console.log('Plant Penerima selected:', matchingPlant.text);
                    await new Promise(resolve => setTimeout(resolve, 1500));
                } else {
                    console.log('Plant not found, available options:', plantOptions);
                }
            }
            
            // Fill Nama Pengirim
            if (formData.namaPengirim) {
                console.log('Filling Nama Pengirim...');
                await page.click('#POS_TTSH_NamaPengirim', { clickCount: 3 }); // Select all
                await new Promise(resolve => setTimeout(resolve, 500));
                await page.type('#POS_TTSH_NamaPengirim', formData.namaPengirim, { delay: 100 });
                console.log('Nama Pengirim filled:', formData.namaPengirim);
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
            // Fill No Kendaraan
            if (formData.noKendaraan) {
                console.log('Filling No Kendaraan...');
                await page.click('#POS_TTSH_NoKendaraan', { clickCount: 3 }); // Select all
                await new Promise(resolve => setTimeout(resolve, 500));
                await page.type('#POS_TTSH_NoKendaraan', formData.noKendaraan, { delay: 100 });
                console.log('No Kendaraan filled:', formData.noKendaraan);
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
            // Fill Alasan Transfer
            if (formData.alasanTransfer) {
                console.log('Filling Alasan Transfer...');
                await page.click('#POS_TTSH_Alasan_TF', { clickCount: 3 }); // Select all
                await new Promise(resolve => setTimeout(resolve, 500));
                await page.type('#POS_TTSH_Alasan_TF', formData.alasanTransfer, { delay: 100 });
                console.log('Alasan Transfer filled:', formData.alasanTransfer);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Wait for item data to be loaded
            console.log('Waiting for item data to load...');
            await page.waitForFunction(() => {
                const select = document.querySelector('#POS_TTSD_MBR_ID');
                return select && select.options.length > 1; // More than just the placeholder
            }, { timeout: 15000 });

            // Loop untuk setiap item
            for (let i = 0; i < formData.items.length; i++) {
                const item = formData.items[i];
                console.log(`📦 Processing item ${i + 1}/${formData.items.length}: ${item.namaBarang} (${item.qty})`);

                // Get all item options to find the matching item
                const itemOptions = await page.evaluate(() => {
                    const select = document.querySelector('#POS_TTSD_MBR_ID');
                    const options = Array.from(select.querySelectorAll('option'));
                    return options
                        .filter(option => option.value && option.value !== '')
                        .map(option => ({
                            value: option.value,
                            text: option.textContent.trim()
                        }));
                });
                
                // Find matching item by name (flexible matching)
                const matchingItem = itemOptions.find(itemOption => {
                    const itemText = itemOption.text.toLowerCase();
                    const searchText = item.namaBarang.toLowerCase();
                    return itemText.includes(searchText) || searchText.includes(itemText.split(' - ')[0]);
                });
                
                if (matchingItem) {
                    // For the first item, use the default selectors
                    // For subsequent items, use index-based selectors that target the latest row
                    let itemSelector, qtySelector;
                    
                    if (i === 0) {
                        // First item uses the default selectors
                        itemSelector = '#POS_TTSD_MBR_ID';
                        qtySelector = 'input[name="POS_TTSD_QTY[]"]';
                    } else {
                        // For subsequent items, target the last/newest row
                        // Wait for new row to appear and then get all rows
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // Get the latest item dropdown and qty input from the table
                        const latestSelectors = await page.evaluate(() => {
                            // Based on HTML structure, items are in #t_material_detail table
                            const table = document.querySelector('#t_material_detail');
                            const itemSelects = Array.from(table.querySelectorAll('select[name="POS_TTSD_MBR_ID[]"], #POS_TTSD_MBR_ID'));
                            const qtyInputs = Array.from(table.querySelectorAll('input[name="POS_TTSD_QTY[]"]'));
                            
                            // Return info about the last elements
                            return {
                                itemCount: itemSelects.length,
                                qtyCount: qtyInputs.length
                            };
                        });
                        
                        console.log(`  📊 Found ${latestSelectors.itemCount} item selects, ${latestSelectors.qtyCount} qty inputs`);
                        
                        // Use nth-child or last selectors for the newest row
                        itemSelector = `select[name="POS_TTSD_MBR_ID[]"]:last-of-type, #POS_TTSD_MBR_ID`;
                        qtySelector = `input[name="POS_TTSD_QTY[]"]:last-of-type`;
                    }
                    
                    console.log(`  🎯 Using selectors - Item: ${itemSelector}, Qty: ${qtySelector}`);
                    
                    // Select the item in the appropriate dropdown (based on table structure)
                    await page.evaluate((selector, value, itemIndex) => {
                        const table = document.querySelector('#t_material_detail');
                        const selects = Array.from(table.querySelectorAll('select[name="POS_TTSD_MBR_ID[]"], #POS_TTSD_MBR_ID'));
                        const targetSelect = selects[selects.length - 1]; // Get the last/newest select
                        if (targetSelect) {
                            targetSelect.value = value;
                            // Trigger change event
                            targetSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }, itemSelector, matchingItem.value, i);
                    
                    console.log(`  ✅ Item selected: ${matchingItem.text}`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Fill quantity in the appropriate input
                    console.log('  🔢 Filling quantity carefully...');
                    
                    // Get and fill the last quantity input (based on table structure)
                    await page.evaluate((selector, qtyValue, itemIndex) => {
                        const table = document.querySelector('#t_material_detail');
                        const qtyInputs = Array.from(table.querySelectorAll('input[name="POS_TTSD_QTY[]"]'));
                        const targetQtyInput = qtyInputs[qtyInputs.length - 1]; // Get the last/newest input
                        if (targetQtyInput) {
                            targetQtyInput.focus();
                            targetQtyInput.select(); // Select all text
                            targetQtyInput.value = ''; // Clear
                            targetQtyInput.value = qtyValue; // Set new value
                            // Trigger events
                            targetQtyInput.dispatchEvent(new Event('input', { bubbles: true }));
                            targetQtyInput.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }, qtySelector, item.qty.toString(), i);
                    
                    console.log(`  ✅ Qty filled: ${item.qty}`);
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    // If not the last item, click "Tambah Barang" button
                    if (i < formData.items.length - 1) {
                        console.log(`  ➕ Adding new item row...`);
                        
                        // Try multiple selectors for the add button based on the HTML structure
                        const addButtonSelectors = [
                            'button[onclick="add_field()"]',  // Based on the HTML onClick="add_field()"
                            'button:contains("Tambah Barang")', 
                            '.btn-secondary.btn-primary',  // Class from HTML
                            'input[value*="Tambah"]',
                            'button[onclick*="tambah"]',
                            'button[onclick*="add"]',
                            '.btn-add',
                            '#add-item',
                            'a[href*="tambah"]',
                            'input[type="button"][value*="Add"]',
                            'button[title*="Add"]'
                        ];
                        
                        let buttonClicked = false;
                        for (const selector of addButtonSelectors) {
                            try {
                                const button = await page.$(selector);
                                if (button) {
                                    await button.click();
                                    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for new row
                                    console.log(`  ✅ New row added using selector: ${selector}`);
                                    buttonClicked = true;
                                    break;
                                }
                            } catch (e) {
                                continue;
                            }
                        }
                        
                        // If no button found, try JavaScript click with more comprehensive search
                        if (!buttonClicked) {
                            try {
                                const foundButton = await page.evaluate(() => {
                                    // Look for buttons with text containing "tambah" or "add"
                                    const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a, span[onclick], div[onclick]'));
                                    const addButton = buttons.find(btn => {
                                        const text = (btn.textContent || btn.value || '').toLowerCase();
                                        const onclick = (btn.onclick || '').toString().toLowerCase();
                                        const title = (btn.title || '').toLowerCase();
                                        return text.includes('tambah') || 
                                               text.includes('add') || 
                                               onclick.includes('tambah') || 
                                               onclick.includes('add') ||
                                               title.includes('tambah') ||
                                               title.includes('add');
                                    });
                                    if (addButton) {
                                        addButton.click();
                                        return true;
                                    }
                                    return false;
                                });
                                
                                if (foundButton) {
                                    await new Promise(resolve => setTimeout(resolve, 3000));
                                    console.log(`  ✅ New row added using JavaScript search`);
                                    buttonClicked = true;
                                } else {
                                    console.log(`  ⚠️ Add button not found. You may need to add rows manually.`);
                                }
                            } catch (e) {
                                console.log(`  ⚠️ Could not find add button. Error: ${e.message}`);
                            }
                        }
                    }
                } else {
                    console.log(`  ❌ Item "${item.namaBarang}" not found, available items:`);
                    console.log(itemOptions.slice(0, 10)); // Show first 10 items for debugging
                    throw new Error(`Item "${item.namaBarang}" not found in the list`);
                }
            }
            
            // Final delay to ensure all fields are filled properly
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            console.log('✅ Transfer stock form filled successfully with multiple items:');
            formData.items.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.namaBarang} - Qty: ${item.qty}`);
            });
            
            // Auto-click Save button
            console.log('🔄 Attempting to click Save button...');
            await this.clickSaveButton(page);
            
            return true;
        } catch (error) {
            console.error('Error filling transfer stock form:', error.message);
            throw error;
        }
    }

    async clickSaveButton(page) {
        try {
            console.log('🔍 Looking for Save button in the modal...');
            
            // Set up alert handler before clicking save button
            page.on('dialog', async dialog => {
                console.log('🔔 Alert dialog appeared:', dialog.message());
                await dialog.accept();
                console.log('✅ Alert dialog accepted');
            });
            
            // Wait a moment for form to be ready
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try multiple selectors for the save button based on the HTML structure
            const saveButtonSelectors = [
                '#Add button[type="submit"]',  // Submit button in the Add modal
                '#Add .btn-primary',  // Primary button in the Add modal
                'button[type="submit"]',
                'input[type="submit"]',
                'input[value*="Simpan"]',
                'button[onclick*="save"]',
                'button[onclick*="simpan"]',
                '.btn-primary',
                '.btn-save',
                '#save-btn',
                '#submit-btn',
                'button[title*="Save"]',
                'button[title*="Simpan"]'
            ];
            
            let buttonClicked = false;
            
            // Try each selector
            for (const selector of saveButtonSelectors) {
                try {
                    const button = await page.$(selector);
                    if (button) {
                        // Check if button is visible and enabled
                        const isVisible = await page.evaluate(el => {
                            const rect = el.getBoundingClientRect();
                            return rect.width > 0 && rect.height > 0 && 
                                   !el.disabled && 
                                   getComputedStyle(el).display !== 'none';
                        }, button);
                        
                        if (isVisible) {
                            await button.click();
                            console.log(`✅ Save button clicked using selector: ${selector}`);
                            buttonClicked = true;
                            break;
                        }
                    }
                } catch (e) {
                    continue;
                }
            }
            
            // If no button found with selectors, try JavaScript search
            if (!buttonClicked) {
                console.log('🔍 Trying JavaScript search for Save button...');
                
                const foundButton = await page.evaluate(() => {
                    // Look for buttons with text containing "simpan" or "save"
                    const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
                    const saveButton = buttons.find(btn => {
                        const text = (btn.textContent || btn.value || '').toLowerCase();
                        const onclick = (btn.onclick || '').toString().toLowerCase();
                        const title = (btn.title || '').toLowerCase();
                        const className = (btn.className || '').toLowerCase();
                        
                        return (text.includes('simpan') || 
                               text.includes('save') || 
                               onclick.includes('simpan') || 
                               onclick.includes('save') ||
                               title.includes('simpan') ||
                               title.includes('save') ||
                               className.includes('save') ||
                               className.includes('submit')) &&
                               !btn.disabled &&
                               getComputedStyle(btn).display !== 'none';
                    });
                    
                    if (saveButton) {
                        saveButton.click();
                        return true;
                    }
                    return false;
                });
                
                if (foundButton) {
                    console.log(`✅ Save button clicked using JavaScript search`);
                    buttonClicked = true;
                } else {
                    console.log(`⚠️ Save button not found. Please save manually.`);
                }
            }
            
            if (buttonClicked) {
                // Wait for the save action to complete
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Handle popup that appears after save
                console.log('🔍 Looking for popup after save...');
                await this.handleSavePopup(page);
                
                console.log('✅ Transfer stock data saved successfully!');
                
                // After saving and handling popup, show table data and handle submit process
                await this.handlePostSaveActions(page);
                
                return true;
            } else {
                console.log('⚠️ Could not find Save button. Form filled but not saved.');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Error clicking save button:', error.message);
            return false;
        }
    }

    async handleSavePopup(page) {
        try {
            console.log('🔍 Waiting for popup after save...');
            
            // Wait for popup to appear (could be alert, modal, or custom popup)
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Try to handle different types of popups
            let popupHandled = false;
            
            // 1. Try to handle JavaScript alert/confirm
            try {
                await page.waitForFunction(() => {
                    // Check if there's an active modal or alert-like element
                    const modals = document.querySelectorAll('.modal.show, .swal2-popup, .alert-popup, [role="dialog"]');
                    return modals.length > 0;
                }, { timeout: 3000 });
                
                popupHandled = await this.clickOkInPopup(page);
            } catch (e) {
                console.log('No visible modal popup found, trying alert handler...');
            }
            
            // 2. If no modal popup found, check for browser alerts
            if (!popupHandled) {
                try {
                    // Wait briefly for potential alert
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    console.log('✅ Save popup handling completed');
                    popupHandled = true;
                } catch (e) {
                    console.log('No alert dialog found');
                }
            }
            
            if (!popupHandled) {
                console.log('⚠️ No popup found after save, continuing...');
            }
            
        } catch (error) {
            console.error('❌ Error handling save popup:', error.message);
            // Continue anyway
        }
    }

    async clickOkInPopup(page) {
        try {
            console.log('🔍 Looking for OK button in popup...');
            
            // Try to find and click OK button in the popup
            const okClicked = await page.evaluate(() => {
                // Look for buttons with "OK", "Ya", "Simpan", "Confirm" text in visible modals
                const modals = Array.from(document.querySelectorAll('.modal.show, .swal2-popup, .alert-popup, [role="dialog"]'));
                
                for (const modal of modals) {
                    const buttons = Array.from(modal.querySelectorAll('button, input[type="button"], a, .btn'));
                    const okButton = buttons.find(btn => {
                        const text = (btn.textContent || btn.value || '').toLowerCase();
                        const className = (btn.className || '').toLowerCase();
                        
                        return text.includes('ok') || 
                               text.includes('ya') || 
                               text.includes('confirm') ||
                               text.includes('simpan') ||
                               text.includes('save') ||
                               className.includes('btn-primary') ||
                               className.includes('btn-success') ||
                               className.includes('swal2-confirm');
                    });
                    
                    if (okButton && !okButton.disabled) {
                        okButton.click();
                        return true;
                    }
                }
                
                // Also try global search if no modal-specific button found
                const allButtons = Array.from(document.querySelectorAll('button, input[type="button"], a, .btn'));
                const globalOkButton = allButtons.find(btn => {
                    const text = (btn.textContent || btn.value || '').toLowerCase();
                    const className = (btn.className || '').toLowerCase();
                    const isVisible = btn.offsetParent !== null;
                    
                    return isVisible && (
                        text.includes('ok') || 
                        text.includes('ya') || 
                        text.includes('confirm') ||
                        className.includes('swal2-confirm')
                    );
                });
                
                if (globalOkButton && !globalOkButton.disabled) {
                    globalOkButton.click();
                    return true;
                }
                
                return false;
            });
            
            if (okClicked) {
                console.log('✅ OK button clicked in popup!');
                await new Promise(resolve => setTimeout(resolve, 2000));
                return true;
            } else {
                console.log('⚠️ OK button not found in popup.');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Error clicking OK in popup:', error.message);
            return false;
        }
    }

    async handlePostSaveActions(page) {
        try {
            console.log('📊 Displaying table data and handling submit process...');
            
            // Wait for modal to close and table to refresh
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Get updated table data
            const tableData = await this.getTransferStockTable(page);
            if (tableData.length > 0) {
                console.log('📋 Latest transfer stock records:');
                // Show the latest few records
                const latestRecords = tableData.slice(0, 3);
                latestRecords.forEach((record, index) => {
                    console.log(`   ${index + 1}. ID: ${record.noId} - Plant: ${record.plantTujuan} - Status: ${record.status}`);
                });
                
                // Find the newest record (should be the one we just created)
                const newestRecord = tableData[0];
                if (newestRecord) {
                    console.log(`🎯 Processing newest record: ${newestRecord.noId}`);
                    
                    // Click the "Kirim" button for the newest record
                    await this.clickKirimButton(page, newestRecord);
                }
            }
            
        } catch (error) {
            console.error('❌ Error in post-save actions:', error.message);
        }
    }

    async clickKirimButton(page, record) {
        try {
            console.log(`📤 Looking for Kirim button for record ID: ${record.noId}`);
            
            // Try to find and click the "Kirim" button for this specific record
            const kirimClicked = await page.evaluate((recordId) => {
                // Look for buttons with "send" class or "kirim" text based on HTML structure
                const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"], .btn'));
                const kirimButton = buttons.find(btn => {
                    const text = (btn.textContent || btn.value || '').toLowerCase();
                    const onclick = (btn.onclick || '').toString();
                    const href = btn.href || '';
                    const className = btn.className || '';
                    
                    // Check if this button is related to the specific record and contains "kirim" or "send"
                    return (text.includes('kirim') || text.includes('send') || 
                           onclick.includes('kirim') || onclick.includes('send') ||
                           href.includes('kirim') || className.includes('send')) &&
                           (onclick.includes(recordId) || href.includes(recordId) ||
                            btn.closest('tr')?.textContent.includes(recordId) ||
                            btn.getAttribute('data-id') === recordId);
                });
                
                if (kirimButton) {
                    kirimButton.click();
                    return true;
                }
                return false;
            }, record.idCrypt || record.noId);
            
            if (kirimClicked) {
                console.log('✅ Kirim button clicked, waiting for popup...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Handle the popup that appears after clicking Kirim
                await this.handleKirimPopup(page);
            } else {
                console.log('⚠️ Kirim button not found for this record.');
            }
            
        } catch (error) {
            console.error('❌ Error clicking Kirim button:', error.message);
        }
    }

    async handleKirimPopup(page) {
        try {
            console.log('🔍 Looking for popup and Proses button...');
            
            // Wait for SendModal popup to appear
            await page.waitForSelector('#SendModal', { timeout: 5000 });
            await page.waitForSelector('#SendModal.show', { timeout: 3000 });
            
            console.log('✅ SendModal popup appeared');
            
            // Try to find and click "Proses" button in the SendModal
            const prosesClicked = await page.evaluate(() => {
                // Look specifically for buttons in the SendModal
                const sendModal = document.querySelector('#SendModal');
                if (!sendModal) return false;
                
                const buttons = Array.from(sendModal.querySelectorAll('button, input[type="submit"], input[type="button"]'));
                const prosesButton = buttons.find(btn => {
                    const text = (btn.textContent || btn.value || '').toLowerCase();
                    const type = btn.type || '';
                    const className = (btn.className || '').toLowerCase();
                    
                    // Based on HTML structure, look for "Proses" submit button
                    return text.includes('proses') ||
                           (type === 'submit' && className.includes('btn-primary'));
                });
                
                if (prosesButton && !prosesButton.disabled) {
                    prosesButton.click();
                    return true;
                }
                return false;
            });
            
            if (prosesClicked) {
                console.log('✅ Proses button clicked in SendModal!');
                
                // Wait for page redirect or response after clicking Proses
                console.log('⏳ Waiting for page redirect or response...');
                
                try {
                    // Wait for either navigation or success indicator
                    await Promise.race([
                        // Wait for navigation if page redirects
                        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }),
                        // Or wait for modal to close and success message
                        page.waitForFunction(() => {
                            // Check if modal is closed and there's a success indicator
                            const modal = document.querySelector('#SendModal');
                            const isModalClosed = !modal || !modal.classList.contains('show');
                            const hasSuccessMessage = document.body.textContent.toLowerCase().includes('sukses') ||
                                                    document.body.textContent.toLowerCase().includes('berhasil') ||
                                                    document.querySelector('.alert-success') ||
                                                    document.querySelector('.swal2-success');
                            return isModalClosed || hasSuccessMessage;
                        }, { timeout: 10000 })
                    ]);
                    
                    console.log('✅ Process completed - page may have redirected or shown success message');
                    
                    // Check current URL to see if we're still on the transfer stock page
                    const currentUrl = page.url();
                    console.log('📍 Current URL after Proses:', currentUrl);
                    
                    if (currentUrl.includes('transferstock')) {
                        console.log('✅ Still on transfer stock page - looking for success indicators');
                        await this.checkForSuccessMessage(page);
                    } else {
                        console.log('🔄 Page redirected - transfer process may be completed');
                        // If redirected, try to navigate back to see the result
                        await this.handlePageRedirect(page);
                    }
                    
                } catch (waitError) {
                    console.log('⏳ No immediate redirect detected, checking for success indicators...');
                    await this.checkForSuccessMessage(page);
                }
                
                console.log('🎉 Transfer stock process completed successfully!');
                
            } else {
                console.log('⚠️ Proses button not found in SendModal.');
            }
            
        } catch (error) {
            console.error('❌ Error handling Kirim popup:', error.message);
        }
    }

    async handlePageRedirect(page) {
        try {
            console.log('🔄 Handling page redirect after Proses...');
            
            // Wait a moment for any redirect to complete
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Try to navigate back to transfer stock page to see the updated status
            await page.goto(this.transferStockUrl, { 
                waitUntil: 'networkidle2',
                timeout: 15000 
            });
            
            console.log('🔙 Navigated back to transfer stock page');
            
            // Check for success message or updated table
            await this.checkForSuccessMessage(page);
            
        } catch (error) {
            console.error('❌ Error handling page redirect:', error.message);
        }
    }

    async checkForSuccessMessage(page) {
        try {
            console.log('🔍 Checking for success message or status update...');
            
            // Wait a moment for any success message to appear
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check for various success indicators
            const successFound = await page.evaluate(() => {
                // Check for success messages
                const successSelectors = [
                    '.alert-success',
                    '.swal2-success',
                    '.toast-success',
                    '.notification-success',
                    '[class*="success"]'
                ];
                
                for (const selector of successSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.offsetParent !== null) {
                        return element.textContent || element.innerText || 'Success indicator found';
                    }
                }
                
                // Check for success text in body
                const bodyText = document.body.textContent.toLowerCase();
                if (bodyText.includes('sukses') || 
                    bodyText.includes('berhasil') || 
                    bodyText.includes('success') ||
                    bodyText.includes('terkirim')) {
                    return 'Success message found in page content';
                }
                
                return null;
            });
            
            if (successFound) {
                console.log('✅ Success message found:', successFound);
            } else {
                console.log('ℹ️ No explicit success message found, but process may have completed');
            }
            
            // Try to get updated table data to see status change
            try {
                await new Promise(resolve => setTimeout(resolve, 2000));
                const tableData = await this.getTransferStockTable(page);
                if (tableData.length > 0) {
                    const latestRecord = tableData[0];
                    console.log(`📊 Latest record status: ${latestRecord.status} (ID: ${latestRecord.noId})`);
                    
                    if (latestRecord.status === 'Terkirim' || latestRecord.status === 'Diterima') {
                        console.log('🎉 Transfer stock status updated successfully!');
                    }
                }
            } catch (tableError) {
                console.log('ℹ️ Could not retrieve updated table data');
            }
            
        } catch (error) {
            console.error('❌ Error checking for success message:', error.message);
        }
    }

    async getTransferStockTable(page) {
        try {
            console.log('Getting transfer stock table data...');
            
            // Wait for the table to load
            await page.waitForSelector('#data-transaction', { timeout: 15000 });
            
            // Wait for DataTable to initialize and load data
            await page.waitForFunction(() => {
                return window.jQuery && window.jQuery('#data-transaction').DataTable().data().length >= 0;
            }, { timeout: 10000 });
            
            const tableData = await page.evaluate(() => {
                try {
                    const table = window.jQuery('#data-transaction').DataTable();
                    const data = table.data().toArray();
                    
                    return data.map((row, index) => ({
                        no: index + 1,
                        noId: row.POS_TTSH_ID,
                        plantTujuan: row.MP_Name,
                        tanggalDibuat: row.POS_TTSH_CreateAt,
                        status: row.POS_TTSH_Status,
                        idCrypt: row.POS_TTSH_ID_Crypt,
                        namaPengirim: row.POS_TTSH_NamaPengirim,
                        noKendaraan: row.POS_TTSH_NoKendaraan,
                        alasanTF: row.POS_TTSH_Alasan_TF
                    }));
                } catch (error) {
                    console.log('DataTable not ready or empty, returning empty array');
                    return [];
                }
            });
            
            console.log(`Retrieved ${tableData.length} transfer stock records`);
            return tableData;
        } catch (error) {
            console.error('Error getting transfer stock table:', error.message);
            // Return empty array if table is empty or error occurs
            return [];
        }
    }

    formatTransferStockData(data) {
        if (!data || data.length === 0) {
            return `📦 ${toSmallCaps('Transfer Stock List')}\n\n❌ ${toSmallCaps('Tidak ada data transfer stock yang ditemukan.')}`;
        }

        let message = `📦 ${toSmallCaps('Transfer Stock List')}\n\n`;
        
        data.forEach((item, index) => {
            const statusEmoji = this.getStatusEmoji(item.status);
            message += `${index + 1}. ${toSmallCaps(item.noId)}\n`;
            message += `   🏢 ${toSmallCaps('Plant')}: ${toSmallCaps(item.plantTujuan)}\n`;
            message += `   📅 ${toSmallCaps('Tanggal')}: ${toSmallCaps(item.tanggalDibuat)}\n`;
            message += `   ${statusEmoji} ${toSmallCaps('Status')}: ${toSmallCaps(item.status)}\n\n`;
        });
        
        return message;
    }

    getStatusEmoji(status) {
        switch (status) {
            case 'Proses': return '🔄';
            case 'Terkirim': return '📤';
            case 'Diterima': return '✅';
            case 'Ditolak': return '❌';
            default: return '📋';
        }
    }

    parseTransferStockInput(input) {
        try {
            // Expected format: "PlantPenerima|NamaPengirim|NoKendaraan|AlasanTransfer|NamaBarang1|Qty1|NamaBarang2|Qty2|..."
            const parts = input.split('|').map(part => part.trim());
            
            if (parts.length < 6) {
                throw new Error('Format tidak lengkap. Minimal: PlantPenerima|NamaPengirim|NoKendaraan|AlasanTransfer|NamaBarang|Qty');
            }

            // Validate that after the first 4 parts, we have pairs of NamaBarang|Qty
            const itemParts = parts.slice(4);
            if (itemParts.length % 2 !== 0) {
                throw new Error('Format barang tidak valid. Setiap barang harus memiliki NamaBarang dan Qty. Format: NamaBarang1|Qty1|NamaBarang2|Qty2|...');
            }

            // Validate plant name
            const validPlants = ['toko fadillah soreang', 'rajawali 1', 'test'];
            const plantLower = parts[0].toLowerCase();
            const isValidPlant = validPlants.some(plant => 
                plant.includes(plantLower) || plantLower.includes(plant)
            );
            
            if (!isValidPlant) {
                throw new Error(`Plant tidak valid. Pilih salah satu: Toko Fadillah Soreang, RAJAWALI 1, TEST`);
            }

            // Parse items
            const items = [];
            for (let i = 0; i < itemParts.length; i += 2) {
                const namaBarang = itemParts[i];
                const qty = parseFloat(itemParts[i + 1]);
                
                if (isNaN(qty) || qty <= 0) {
                    throw new Error(`Qty untuk barang "${namaBarang}" harus berupa angka yang lebih besar dari 0`);
                }
                
                items.push({
                    namaBarang: namaBarang,
                    qty: qty
                });
            }

            return {
                plantPenerima: parts[0],
                namaPengirim: parts[1],
                noKendaraan: parts[2],
                alasanTransfer: parts[3],
                items: items
            };
        } catch (error) {
            console.error('Error parsing transfer stock input:', error.message);
            throw error;
        }
    }

    formatPlantOptions(plants) {
        if (!plants || plants.length === 0) {
            return `❌ ${toSmallCaps('Tidak ada plant yang tersedia.')}`;
        }

        let message = `🏢 ${toSmallCaps('Pilihan Plant Penerima')}:\n\n`;
        plants.forEach((plant, index) => {
            message += `${index + 1}. ${toSmallCaps(plant.text)} (${toSmallCaps('ID')}: ${toSmallCaps(plant.value)})\n`;
        });
        
        return message;
    }

    formatItemOptions(items) {
        if (!items || items.length === 0) {
            return `❌ ${toSmallCaps('Tidak ada barang yang tersedia.')}`;
        }

        let message = `📦 ${toSmallCaps('Pilihan Barang')}:\n\n`;
        // Only show first 20 items to avoid message too long
        const displayItems = items.slice(0, 20);
        
        displayItems.forEach((item, index) => {
            message += `${index + 1}. ${toSmallCaps(item.text)}\n`;
        });
        
        if (items.length > 20) {
            message += `\n... ${toSmallCaps('dan')} ${items.length - 20} ${toSmallCaps('barang lainnya')}\n`;
        }
        
        return message;
    }

    getTransferStockInstructions() {
        return `📦 ${toSmallCaps('Fitur Transfer Stock')}

${toSmallCaps('Untuk membuat transfer stock baru, silakan kirimkan data dalam format berikut:')}

${toSmallCaps('Format untuk satu barang')}:
\`PlantPenerima|NamaPengirim|NoKendaraan|AlasanTransfer|NamaBarang|Qty\`

${toSmallCaps('Format untuk multiple barang')}:
\`PlantPenerima|NamaPengirim|NoKendaraan|AlasanTransfer|NamaBarang1|Qty1|NamaBarang2|Qty2|NamaBarang3|Qty3\`

${toSmallCaps('Contoh satu barang')}:
\`RAJAWALI 1|Eko|D 1234 a|Catatan|3/4|1\`

${toSmallCaps('Contoh multiple barang')}:
\`RAJAWALI 1|Eko|D 1234 a|Catatan|KARET 07 P|10|BAN 11 P|5|RING 14|2\`

${toSmallCaps('Plant Penerima yang tersedia')}:
• ${toSmallCaps('Toko Fadillah Soreang')}
• ${toSmallCaps('RAJAWALI 1')}  
• ${toSmallCaps('TEST')}

${toSmallCaps('Keterangan')}:
🏢 ${toSmallCaps('Plant Penerima: Pilih salah satu dari daftar di atas')}
👤 ${toSmallCaps('Nama Pengirim: Nama petugas pengirim')}
🚛 ${toSmallCaps('No Kendaraan: Nomor plat kendaraan')}
📝 ${toSmallCaps('Alasan Transfer: Alasan melakukan transfer')}
📦 ${toSmallCaps('Nama Barang: Nama item yang akan ditransfer (3/4, KARET 07 P, BAN 11 P, dll)')}
🔢 ${toSmallCaps('Qty: Jumlah barang yang akan ditransfer per item')}

✨ ${toSmallCaps('Proses Otomatis Lengkap')}:
1️⃣ ${toSmallCaps('Form akan diisi otomatis dengan delay yang tepat')}
2️⃣ ${toSmallCaps('Multiple barang akan ditambahkan secara otomatis')}
3️⃣ ${toSmallCaps('Tombol "Simpan" diklik otomatis setelah form terisi')}
4️⃣ ${toSmallCaps('Popup konfirmasi setelah simpan di-handle otomatis (klik OK)')}
5️⃣ ${toSmallCaps('Data tersimpan dan tabel akan diperbarui')}
6️⃣ ${toSmallCaps('Tombol "Kirim" diklik otomatis untuk record terbaru')}
7️⃣ ${toSmallCaps('Popup konfirmasi kirim muncul')}
8️⃣ ${toSmallCaps('Tombol "Proses" diklik otomatis')}
9️⃣ ${toSmallCaps('Sistem akan handle redirect halaman atau response')}
🔟 ${toSmallCaps('Status transaksi akan diperbarui menjadi "Terkirim"')}

⚠️ ${toSmallCaps('Catatan penting')}:
- ${toSmallCaps('Setelah klik "Proses", sistem mungkin redirect ke halaman lain')}
- ${toSmallCaps('Bot akan otomatis handle redirect dan kembali untuk cek status')}
- ${toSmallCaps('Pastikan semua data sudah benar sebelum mengirim!')}
- ${toSmallCaps('Proses berlangsung end-to-end tanpa intervensi manual')}
- ${toSmallCaps('Status akhir akan dicek untuk memastikan transfer berhasil')}`;
    }
}

module.exports = TransferStockChecker;
