const { toSmallCaps, formatTableHeader, formatDataRow, formatStatus } = require('../utils/textFormatter');

class ConfirmReturChecker {
    constructor(page) {
        this.page = page;
        this.returUrl = 'https://portal.rajawalielastis.com/bo/transaksi/p_retur';
    }

    async confirmReturTransaction(returId) {
        try {
            console.log(`✅ Confirming retur transaction for ID: ${returId}`);
            
            // Navigate to retur page first
            await this.page.goto(this.returUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });

            // Wait for table to load
            await this.page.waitForSelector('#data-transaction');
            await new Promise(r => setTimeout(r, 2000));

            // Find and click the confirm button (check/tick icon)
            console.log('🔍 Looking for confirm button...');
            const confirmClicked = await this.page.evaluate((id) => {
                const rows = document.querySelectorAll('.table tbody tr');
                for (const row of rows) {
                    const idCell = row.querySelector('td:nth-child(2)');
                    if (idCell?.textContent?.trim() === id) {
                        // Look for the confirm button (check icon)
                        const confirmBtn = row.querySelector('a.edit, a.btn-outline-primary i.bx-check');
                        if (confirmBtn) {
                            const parentBtn = confirmBtn.closest('a');
                            if (parentBtn) {
                                parentBtn.click();
                                return true;
                            }
                        }
                    }
                }
                return false;
            }, returId);

            if (!confirmClicked) {
                return {
                    success: false,
                    error: `Confirm button not found for Retur ID: ${returId}`
                };
            }

            // Wait for modal to open
            console.log('⌛ Waiting for confirmation modal to open...');
            await this.page.waitForSelector('#EditModal', { visible: true, timeout: 10000 });
            await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds for modal content

            // Click save button in modal
            console.log('💾 Clicking save button...');
            const saveClicked = await this.page.evaluate(() => {
                const saveBtn = document.querySelector('#EditModal .modal-footer button[type="submit"].btn-primary');
                if (saveBtn) {
                    saveBtn.click();
                    return true;
                }
                return false;
            });

            if (!saveClicked) {
                return {
                    success: false,
                    error: 'Save button not found in confirmation modal'
                };
            }

            // Wait for form submission
            console.log('⌛ Waiting for form submission...');
            await new Promise(r => setTimeout(r, 3000)); // Wait 3 seconds for submission

            // Check if modal is closed (indicating successful submission)
            const modalClosed = await this.page.evaluate(() => {
                const modal = document.querySelector('#EditModal');
                return !modal || !modal.classList.contains('show');
            });

            console.log('✅ Retur confirmation completed successfully');
            
            return {
                success: true,
                message: `${toSmallCaps(`Retur transaction #${returId} has been confirmed successfully`)}`,
                modalClosed: modalClosed
            };

        } catch (error) {
            console.error('❌ Error confirming retur transaction:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = ConfirmReturChecker;
