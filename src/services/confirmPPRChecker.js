const { toSmallCaps, formatTableHeader, formatDataRow, formatStatus } = require('../utils/textFormatter');

class ConfirmPPRChecker {
    constructor(page) {
        this.page = page;
        this.pprUrl = 'https://portal.rajawalielastis.com/bo/transaksi/p_permintaan';
        this.itemsPerPage = 5;
        this.cachedData = null;
        this.waitingForPPRId = false;
        this.waitingForDeliveryData = false;
        this.selectedPPRId = null;
        this.itemCount = 0;
    }

    async fetchPendingPPRData(pageNum = 1, forceRefresh = false) {
        try {
            // Use cached data if available and not forcing refresh
            if (this.cachedData && !forceRefresh) {
                console.log('📋 Using cached Pending PPR data...');
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

            // Fetch fresh data from web - SAMA seperti PPRChecker
            console.log('📊 Fetching pending PPR data from web...');
            await this.page.goto(this.pprUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            
            // Set to 100 entries and get all data - SAMA seperti PPRChecker
            await this.page.waitForSelector('div.dataTables_length select');
            await this.page.select('div.dataTables_length select', '100');
            
            // Wait for table to update
            await new Promise(r => setTimeout(r, 2000));
            
            // Store ONLY "Menunggu Konfirmasi" data in cache - INI BEDA, filter berdasarkan status
            this.cachedData = await this.page.evaluate(() => {
                return Array.from(document.querySelectorAll('.table tbody tr'))
                    .map(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 5) {
                            const status = cells[4]?.textContent?.trim() || '';
                            // FILTER: hanya ambil yang status "Menunggu Konfirmasi"
                            if (status === 'Menunggu Konfirmasi') {
                                return {
                                    number: cells[1]?.textContent?.trim() || '',
                                    location: cells[2]?.textContent?.trim() || '',
                                    date: cells[3]?.textContent?.trim() || '',
                                    status: status
                                };
                            }
                        }
                        return null;
                    })
                    .filter(item => item && item.number);
            });

            // Use cached data for pagination - SAMA seperti PPRChecker
            const totalItems = this.cachedData.length;
            const totalPages = Math.ceil(totalItems / this.itemsPerPage);
            const startIdx = (pageNum - 1) * this.itemsPerPage;
            const endIdx = Math.min(startIdx + this.itemsPerPage, totalItems);

            console.log(`✅ Found ${totalItems} pending PPR entries`);
            
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
            console.error('❌ Error fetching pending PPR data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    formatPendingPPRResult(data, pagination) {
        if (!data || data.length === 0) return '❌ ɴᴏ ᴘᴇɴᴅɪɴɢ ᴘᴘʀ ᴄᴏɴғɪʀᴍᴀᴛɪᴏɴs ғᴏᴜɴᴅ';

        const header = `� ᴘᴇɴᴅɪɴɢ ᴘᴘʀ ᴄᴏɴғɪʀᴍᴀᴛɪᴏɴs (ᴘᴀɢᴇ ${pagination.currentPage}/${pagination.totalPages})\n` +
                      `sʜᴏᴡɪɴɢ ɪᴛᴇᴍs ${pagination.startItem}-${pagination.endItem} ᴏғ ${pagination.totalItems}\n\n`;
        
        const items = data.map(item => 
            `📅 ${toSmallCaps(item.number)}\n` +
            `📝 ${toSmallCaps(item.location)}\n` +
            `🏪 ${toSmallCaps(item.date)}\n` +
            `📊 sᴛᴀᴛᴜs: ${formatStatus(item.status)}`
        ).join('\n\n');

        return header + items + '\n\n💬 sᴇɴᴅ ᴘᴘʀ ɪᴅ ᴛᴏ ᴄᴏɴғɪʀᴍ (ᴇ.ɢ., 250800025)';
    }

    async processPPRConfirmation(pprId) {
        try {
            console.log(`🔍 Processing PPR confirmation for ID: ${pprId}`);
            
            // Navigate to PPR page
            await this.page.goto(this.pprUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Wait for table to load
            await new Promise(r => setTimeout(r, 2000));

            // Click confirm button (check icon) to open modal
            const confirmClicked = await this.page.evaluate((id) => {
                const rows = document.querySelectorAll('.table tbody tr');
                for (const row of rows) {
                    const idCell = row.querySelector('td:nth-child(2)');
                    const statusCell = row.querySelector('td:nth-child(5)');
                    
                    if (idCell?.textContent?.trim() === id && 
                        statusCell?.textContent?.trim() === 'Menunggu Konfirmasi') {
                        const confirmBtn = row.querySelector('.konfirmasi');
                        if (confirmBtn) {
                            confirmBtn.click();
                            return true;
                        }
                    }
                }
                return false;
            }, pprId);

            if (!confirmClicked) {
                return {
                    success: false,
                    error: `PPR ID ${pprId} not found or not pending confirmation`
                };
            }

            // Wait for modal to open
            console.log('⌛ Waiting for confirmation modal to open...');
            await this.page.waitForSelector('#KonfirmasiModal', { visible: true, timeout: 10000 });
            await new Promise(r => setTimeout(r, 2000));

            // Get item count from modal detail table
            this.itemCount = await this.page.evaluate(() => {
                const qtyInputs = document.querySelectorAll('#detail_konfirmasi input[name="POS_TPBRD_QTY_DO[]"]');
                return qtyInputs.length;
            });

            this.selectedPPRId = pprId;
            console.log(`✅ PPR ${pprId} opened for confirmation. Found ${this.itemCount} items.`);
            
            return {
                success: true,
                pprId: pprId,
                itemCount: this.itemCount,
                message: `ᴘᴘʀ ${toSmallCaps(pprId)} ɪs ʀᴇᴀᴅʏ ғᴏʀ ᴄᴏɴғɪʀᴍᴀᴛɪᴏɴ.\nғᴏᴜɴᴅ ${this.itemCount} ɪᴛᴇᴍs.\n\n📝 ᴘʟᴇᴀsᴇ sᴇɴᴅ ᴅᴇʟɪᴠᴇʀʏ ᴅᴀᴛᴀ ɪɴ ғᴏʀᴍᴀᴛ:\nɴᴀᴍᴀ ᴘᴇɴɢɪʀɪᴍ, ɴᴏ ᴋᴇɴᴅᴀʀᴀᴀɴ, ǫᴛʏ ᴅᴏ${this.itemCount > 1 ? ' (sᴇᴘᴀʀᴀᴛᴇᴅ ʙʏ ᴄᴏᴍᴍᴀ ғᴏʀ ᴍᴜʟᴛɪᴘʟᴇ ɪᴛᴇᴍs)' : ''}\n\nᴇxᴀᴍᴘʟᴇ: ${this.itemCount > 1 ? toSmallCaps('Eko, D1234, 10, 20, 30') : toSmallCaps('Eko, D1234, 10')}`
            };

        } catch (error) {
            console.error('❌ Error processing PPR confirmation:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async fillDeliveryData(deliveryData) {
        try {
            console.log('📝 Filling delivery data...');
            
            const parts = deliveryData.split(',').map(part => part.trim());
            
            if (parts.length < 3) {
                return {
                    success: false,
                    error: toSmallCaps('Invalid format. Please use: Nama Pengirim, No Kendaraan, Qty DO')
                };
            }

            const namaPengirim = parts[0];
            const noKendaraan = parts[1];
            const qtyValues = parts.slice(2);

            if (qtyValues.length !== this.itemCount) {
                return {
                    success: false,
                    error: `Expected ${this.itemCount} qty values, but got ${qtyValues.length}. Please provide qty for each item.`
                };
            }

            // Fill the form
            const fillResult = await this.page.evaluate((nama, kendaraan, qtys) => {
                try {
                    // Fill nama pengirim
                    const namaInput = document.querySelector('#POS_TPBRH_NamaPengirim_Konfirmasi');
                    if (namaInput) {
                        namaInput.value = nama;
                        namaInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }

                    // Fill no kendaraan
                    const kendaraanInput = document.querySelector('#POS_TPBRH_NoKendaraan_Konfirmasi');
                    if (kendaraanInput) {
                        kendaraanInput.value = kendaraan;
                        kendaraanInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }

                    // Fill qty_do for each item
                    const qtyInputs = document.querySelectorAll('#detail_konfirmasi input[name="POS_TPBRD_QTY_DO[]"]');
                    qtys.forEach((qty, index) => {
                        if (qtyInputs[index]) {
                            qtyInputs[index].value = qty;
                            qtyInputs[index].dispatchEvent(new Event('input', { bubbles: true }));
                            qtyInputs[index].dispatchEvent(new Event('keyup', { bubbles: true }));
                        }
                    });

                    return {
                        success: true,
                        namaFilled: !!namaInput,
                        kendaraanFilled: !!kendaraanInput,
                        qtyFilled: qtyInputs.length
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            }, namaPengirim, noKendaraan, qtyValues);

            if (fillResult.success) {
                console.log('✅ Form filled successfully');
                
                // Now click the submit/confirm button
                console.log('🔄 Submitting form by clicking Konfirmasi button...');
                const submitResult = await this.submitForm();
                
                if (submitResult.success) {
                    // After successful submission, click the Send button
                    console.log('📤 Now clicking Send button...');
                    const sendResult = await this.clickSendButton(this.selectedPPRId);
                    
                    let message = `✅ ᴘᴘʀ ${toSmallCaps(this.selectedPPRId)} ғᴏʀᴍ ғɪʟʟᴇᴅ ᴀɴᴅ sᴜʙᴍɪᴛᴛᴇᴅ sᴜᴄᴄᴇssғᴜʟʟʏ!\n\n📝 ᴅᴀᴛᴀ ᴇɴᴛᴇʀᴇᴅ:\n- ɴᴀᴍᴀ ᴘᴇɴɢɪʀɪᴍ: ${toSmallCaps(namaPengirim)}\n- ɴᴏ ᴋᴇɴᴅᴀʀᴀᴀɴ: ${toSmallCaps(noKendaraan)}\n- ǫᴛʏ ᴅᴏ: ${qtyValues.join(', ')}\n\n${toSmallCaps(submitResult.message)}`;
                    
                    // Add send button result to message
                    if (sendResult.success) {
                        message += `\n\n📤 ᴅᴇʟɪᴠᴇʀʏ ᴏʀᴅᴇʀ ʜᴀs ʙᴇᴇɴ sᴇɴᴛ sᴜᴄᴄᴇssғᴜʟʟʏ!`;
                    } else {
                        message += `\n\n⚠️ ɴᴏᴛᴇ: ᴄᴏᴜʟᴅ ɴᴏᴛ ᴄʟɪᴄᴋ sᴇɴᴅ ʙᴜᴛᴛᴏɴ. ${toSmallCaps(sendResult.error)}`;
                    }
                    
                    return {
                        success: true,
                        message: message
                    };
                } else {
                    return {
                        success: false,
                        error: submitResult.error
                    };
                }
            } else {
                return {
                    success: false,
                    error: toSmallCaps('Failed to fill form: ') + toSmallCaps(fillResult.error)
                };
            }

        } catch (error) {
            console.error('❌ Error filling delivery data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async submitForm() {
        try {
            console.log('🔄 Submitting PPR confirmation form...');
            
            // Click the submit/confirm button in the modal
            const submitResult = await this.page.evaluate(() => {
                try {
                    // Find the submit button in the modal footer
                    const submitBtn = document.querySelector('#KonfirmasiModal .modal-footer button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.click();
                        return { success: true };
                    }
                    return { 
                        success: false, 
                        error: toSmallCaps('Submit button not found in modal') 
                    };
                } catch (error) {
                    return { 
                        success: false, 
                        error: error.message 
                    };
                }
            });
            
            if (!submitResult.success) {
                console.error('❌ Error submitting form:', submitResult.error);
                return submitResult;
            }
            
            // Wait for form submission and processing
            console.log('⌛ Waiting for form submission to complete...');
            await new Promise(r => setTimeout(r, 3000));
            
            // Check if submission was successful
            const submissionResult = await this.page.evaluate(() => {
                // Check if modal has been closed (success indicator)
                const modalVisible = document.querySelector('#KonfirmasiModal.show') !== null;
                
                // Check for success message if any
                const successAlert = document.querySelector('.alert-success, .toast-success');
                const errorAlert = document.querySelector('.alert-danger, .toast-error');
                
                if (errorAlert) {
                    return {
                        success: false,
                        error: errorAlert.textContent?.trim() || toSmallCaps('An error occurred during submission'),
                        modalClosed: !modalVisible
                    };
                }
                
                return {
                    success: !modalVisible || !!successAlert,
                    modalClosed: !modalVisible,
                    message: successAlert ? successAlert.textContent?.trim() : ''
                };
            });
            
            if (submissionResult.success) {
                console.log('✅ Form submitted successfully!');
                return {
                    success: true,
                    message: submissionResult.message || toSmallCaps('Form submitted successfully.'),
                    modalClosed: submissionResult.modalClosed
                };
            } else {
                return {
                    success: false,
                    error: submissionResult.error || toSmallCaps('Form submission failed or was not accepted')
                };
            }
        } catch (error) {
            console.error('❌ Error during form submission:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async clickSendButton(pprId) {
        try {
            console.log(`📤 Attempting to click Send button for PPR ID: ${pprId}`);
            
            // Navigate back to main PPR page
            await this.page.goto(this.pprUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Wait for table to load
            await new Promise(r => setTimeout(r, 2000));

            // Find and click the send button for this PPR ID
            const sendClicked = await this.page.evaluate((id) => {
                const rows = document.querySelectorAll('.table tbody tr');
                for (const row of rows) {
                    const idCell = row.querySelector('td:nth-child(2)');
                    const statusCell = row.querySelector('td:nth-child(5)');
                    
                    if (idCell?.textContent?.trim() === id && 
                        statusCell?.textContent?.trim() === 'Waiting DO') {
                        // Find the send button (usually has send icon or class)
                        const sendBtn = row.querySelector('a.send, a[data-id] i.bx-send, a[title="Kirim"]');
                        if (sendBtn) {
                            const parentBtn = sendBtn.closest('a');
                            if (parentBtn) {
                                parentBtn.click();
                                return true;
                            }
                        }
                    }
                }
                return false;
            }, pprId);

            if (!sendClicked) {
                return {
                    success: false,
                    error: toSmallCaps('Send button not found or PPR status is not "Waiting DO"')
                };
            }

            // Wait for send confirmation modal
            console.log('⌛ Waiting for send confirmation modal...');
            await this.page.waitForSelector('#SendModal', { visible: true, timeout: 10000 })
                .catch(() => console.log('Send modal not found, continuing anyway...'));
            
            await new Promise(r => setTimeout(r, 1000));

            // Click confirm in the send modal
            const confirmSendClicked = await this.page.evaluate(() => {
                const confirmBtn = document.querySelector('#SendModal .modal-footer button[type="submit"]');
                if (confirmBtn) {
                    confirmBtn.click();
                    return true;
                }
                return false;
            });

            if (!confirmSendClicked) {
                return {
                    success: false,
                    error: toSmallCaps('Could not confirm sending in modal')
                };
            }

            // Wait for processing
            await new Promise(r => setTimeout(r, 3000));

            // Check result
            const sendSuccess = await this.page.evaluate(() => {
                // Check for success indicators
                const successAlert = document.querySelector('.alert-success, .toast-success');
                const modalClosed = !document.querySelector('#SendModal.show');
                
                return {
                    success: modalClosed || !!successAlert,
                    message: successAlert?.textContent?.trim() || toSmallCaps('Delivery order sent successfully')
                };
            });

            console.log('📤 Send operation completed');
            return {
                success: sendSuccess.success,
                message: sendSuccess.message
            };

        } catch (error) {
            console.error('❌ Error clicking send button:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    resetState() {
        this.waitingForPPRId = false;
        this.waitingForDeliveryData = false;
        this.selectedPPRId = null;
        this.itemCount = 0;
    }

    async ensureDataLoaded() {
        if (!this.cachedData) {
            await this.fetchPendingPPRData(1);
        }
    }
}

module.exports = ConfirmPPRChecker;

