const TransferStockChecker = require('../../services/transferStockChecker');
const keyboards = require('../../keyboards/inlineKeyboards');
const { toSmallCaps } = require('../../utils/textFormatter');

module.exports = (bot, globalState) => {
    // Transfer Stock action handler
    bot.action('check_transfer_stock', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ Please login first!', keyboards.preLoginMenu);
                return;
            }

            const loadingMessage = await ctx.editMessageText('🔄 Fetching Transfer Stock data...');
            
            // Create new TransferStockChecker instance only if not exists
            if (!globalState.transferStockChecker) {
                console.log('📋 Creating new TransferStockChecker instance');
                globalState.transferStockChecker = new TransferStockChecker();
            } else {
                console.log('📋 Using existing TransferStockChecker instance');
            }
            
            console.log('📋 TransferStockChecker instance ready, navigating to page...');
            
            // Navigate to transfer stock page
            await globalState.transferStockChecker.navigateToTransferStock(globalState.scraper.page);
            
            // Get transfer stock table data
            const tableData = await globalState.transferStockChecker.getTransferStockTable(globalState.scraper.page);
            
            const message = globalState.transferStockChecker.formatTransferStockData(tableData);
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                loadingMessage.message_id,
                null,
                message,
                { 
                    ...keyboards.getTransferStockKeyboard(1, 1)
                }
            );
            
        } catch (error) {
            console.error('Transfer Stock check error:', error);
            await ctx.editMessageText('⚠️ Error occurred while fetching Transfer Stock data.', keyboards.postLoginMenu);
        }
    });

    // Transfer Stock "Add Transfer" action handler
    bot.action('add_transfer_stock', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText('❌ Please login first!', keyboards.preLoginMenu);
                return;
            }

            // Set state to await transfer stock data
            globalState.userStates.set(ctx.from.id, 'awaiting_transfer_stock_data');
            
            if (!globalState.transferStockChecker) {
                globalState.transferStockChecker = new TransferStockChecker();
            }
            
            const instructionMessage = globalState.transferStockChecker.getTransferStockInstructions();
            await ctx.editMessageText(instructionMessage, { parse_mode: 'Markdown' });
            
        } catch (error) {
            console.error('Add transfer stock action error:', error);
            await ctx.editMessageText('⚠️ Error occurred. Please try again.', keyboards.postLoginMenu);
        }
    });

    // Transfer Stock pagination handler
    bot.action(/transfer_stock_page_(\d+)/, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const page = parseInt(ctx.match[1]);
            
            // Use existing transferStockChecker instance
            if (!globalState.transferStockChecker) {
                await ctx.editMessageText('❌ Please fetch Transfer Stock data first!', keyboards.postLoginMenu);
                return;
            }

            // Re-fetch table data for the requested page
            const tableData = await globalState.transferStockChecker.getTransferStockTable(globalState.scraper.page);
            
            const message = globalState.transferStockChecker.formatTransferStockData(tableData);
            await ctx.editMessageText(message, {
                ...keyboards.getTransferStockKeyboard(page, 1) // For now, assume 1 page
            });
            
        } catch (error) {
            console.error('Transfer Stock pagination error:', error);
            await ctx.answerCbQuery('Error changing page');
        }
    });

    // Handle Transfer Stock data input
    bot.on('text', async (ctx, next) => {
        const userId = ctx.from.id;
        const state = globalState.userStates.get(userId);
        const text = ctx.message.text;

        if (state === 'awaiting_transfer_stock_data') {
            try {
                const transferStockData = text;
                const loadingMsg = await ctx.reply('📋 Processing transfer stock data...');

                if (!globalState.transferStockChecker) {
                    globalState.transferStockChecker = new TransferStockChecker();
                }

                // Parse the input data
                const parsedData = globalState.transferStockChecker.parseTransferStockInput(transferStockData);
                
                // Navigate to transfer stock page and open modal
                await globalState.transferStockChecker.navigateToTransferStock(globalState.scraper.page);
                await globalState.transferStockChecker.openAddTransferStockModal(globalState.scraper.page);
                
                // Fill the form with provided data
                const result = await globalState.transferStockChecker.fillTransferStockForm(globalState.scraper.page, parsedData);
                
                if (result) {
                    let itemsList = '';
                    parsedData.items.forEach((item, index) => {
                        itemsList += `   ${index + 1}. ${item.namaBarang} - Qty: ${item.qty}\n`;
                    });
                    
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMsg.message_id,
                        null,
                        `✅ ${toSmallCaps('Transfer stock berhasil diproses lengkap!')}\n\n` +
                        `🏢 ${toSmallCaps('Plant Penerima')}: ${toSmallCaps(parsedData.plantPenerima)}\n` +
                        `👤 ${toSmallCaps('Nama Pengirim')}: ${toSmallCaps(parsedData.namaPengirim)}\n` +
                        `🚛 ${toSmallCaps('No Kendaraan')}: ${toSmallCaps(parsedData.noKendaraan)}\n` +
                        `📝 ${toSmallCaps('Alasan Transfer')}: ${toSmallCaps(parsedData.alasanTransfer)}\n\n` +
                        `📦 ${toSmallCaps(`Items (${parsedData.items.length} barang)`)}: \n${itemsList}\n` +
                        `✅ ${toSmallCaps('Form sudah diisi dengan delay yang cukup untuk akurasi')}\n` +
                        `💾 ${toSmallCaps('Data sudah otomatis disimpan ke sistem')}\n` +
                        `🚀 ${toSmallCaps('Otomatis klik "Kirim" dan "Sukses" di popup')}\n` +
                        `🎉 ${toSmallCaps('Proses transfer stock selesai total!')}`
                    );
                } else {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMsg.message_id,
                        null,
                        `❌ ${toSmallCaps('Error filling transfer stock form. Please check the data format.')}`
                    );
                }

            } catch (error) {
                console.error('Transfer stock data processing error:', error);
                await ctx.reply(
                    `❌ ${toSmallCaps('Error dalam format data')}\n\n${error.message}\n\n` +
                    `📝 ${toSmallCaps('Format yang benar')}:\n` +
                    `PlantPenerima|NamaPengirim|NoKendaraan|AlasanTransfer|NamaBarang1|Qty1|NamaBarang2|Qty2|...\n\n` +
                    `📋 ${toSmallCaps('Contoh')}:\n` +
                    `• ${toSmallCaps('Satu barang')}: \`RAJAWALI 1|Eko|D 1234 a|Catatan|3/4|1\`\n` +
                    `• ${toSmallCaps('Multiple barang')}: \`RAJAWALI 1|Eko|D 1234 a|Catatan|NamaBarang1|1|NamaBarang2|2|NamaBarang3|0.5\``,
                    { parse_mode: 'Markdown' }
                );
            } finally {
                globalState.userStates.delete(userId);
                await ctx.reply('Select an option:', keyboards.postLoginMenu);
            }
        } else {
            return next(); // Pass to next handler
        }
    });
};
