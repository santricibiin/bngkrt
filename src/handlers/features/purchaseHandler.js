const PurchaseChecker = require('../../services/purchaseChecker');
const PurchaseTransactionChecker = require('../../services/purchaseTransactionChecker');
const keyboards = require('../../keyboards/inlineKeyboards');
const { toSmallCaps } = require('../../utils/textFormatter');

module.exports = (bot, globalState) => {
    // Purchase action handler
    bot.action('check_purchase', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText(`❌ ${toSmallCaps('Please login first!')}`, keyboards.preLoginMenu);
                return;
            }

            const loadingMessage = await ctx.editMessageText(`🔄 ${toSmallCaps('Fetching fresh Purchase data...')}`);
            
            // Create new PurchaseChecker instance only if not exists
            if (!globalState.purchaseChecker) {
                console.log('🛒 Creating new PurchaseChecker instance');
                globalState.purchaseChecker = new PurchaseChecker(globalState.scraper.page);
            } else {
                console.log('🛒 Using existing PurchaseChecker instance');
            }
            
            console.log('🛒 PurchaseChecker instance ready, fetching data...');
            // Force refresh data from web (always get latest data)
            const result = await globalState.purchaseChecker.fetchPurchaseData(1, true);

            if (result.success) {
                console.log(`✅ Successfully fetched ${result.data.length} purchase items`);
                console.log(`✅ Total cached items: ${result.pagination.totalItems}`);
                console.log(`✅ Total pages: ${result.pagination.totalPages}`);
                
                const message = globalState.purchaseChecker.formatPurchaseResult(result.data, result.pagination);
                await ctx.telegram.editMessageText(
                    ctx.chat.id,
                    loadingMessage.message_id,
                    null,
                    message + '\n\n💡 Send Purchase ID number to view details',
                    { 
                        ...keyboards.getPurchaseKeyboard(
                            result.pagination.currentPage,
                            result.pagination.totalPages
                        )
                    }
                );
                
                // Set state to await Purchase ID
                globalState.userStates.set(ctx.from.id, 'awaiting_purchase_id');
            } else {
                console.log('❌ Failed to fetch purchase data:', result.error);
                await ctx.editMessageText(`❌ ${toSmallCaps('No Purchase data found or error occurred.')}`, keyboards.postLoginMenu);
            }
        } catch (error) {
            console.error('Purchase check error:', error);
            await ctx.editMessageText(`⚠️ ${toSmallCaps('Error occurred while fetching Purchase data.')}`, keyboards.postLoginMenu);
        }
    });

    // Purchase pagination handler
    bot.action(/purchase_page_(\d+)/, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            const page = parseInt(ctx.match[1]);
            
            // Use existing purchaseChecker instance
            if (!globalState.purchaseChecker) {
                await ctx.editMessageText('❌ Please fetch Purchase data first!', keyboards.postLoginMenu);
                return;
            }

            // Use cached data for pagination (don't refresh on page navigation)
            const result = await globalState.purchaseChecker.fetchPurchaseData(page, false);

            if (result.success) {
                const message = globalState.purchaseChecker.formatPurchaseResult(result.data, result.pagination);
                await ctx.editMessageText(message + '\n\n💡 Send Purchase ID number to view details', {
                    ...keyboards.getPurchaseKeyboard(
                        result.pagination.currentPage,
                        result.pagination.totalPages
                    )
                });
                
                // Maintain state for Purchase ID input
                globalState.userStates.set(ctx.from.id, 'awaiting_purchase_id');
            }
        } catch (error) {
            console.error('Purchase pagination error:', error);
            await ctx.answerCbQuery(toSmallCaps('Error changing page'));
        }
    });

    // Add Purchase Transaction action handler
    bot.action('add_purchase_transaction', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            
            if (!globalState.scraper || !globalState.scraper.page) {
                await ctx.editMessageText(`❌ ${toSmallCaps('Please login first!')}`, keyboards.preLoginMenu);
                return;
            }

            // Set state to await transaction data
            globalState.userStates.set(ctx.from.id, 'awaiting_purchase_transaction_data');
            
            const instructionMessage = `➕ ${toSmallCaps('Tambah Transaksi Pembelian')}\n\n` +
                                     `📝 ${toSmallCaps('Format data yang harus dikirim')}:\n` +
                                     `Type,Supplier,Payment,Termin,Invoice,Item1,Qty1,Disc1[,Item2,Qty2,Disc2,...]\n\n` +
                                     `📋 ${toSmallCaps('Type Pembelian')}:\n` +
                                     `• PL = ${toSmallCaps('Pembelian Langsung')}\n` +
                                     `• PO = ${toSmallCaps('Purchase Order')}\n\n` +
                                     `💰 ${toSmallCaps('Payment Type')}:\n` +
                                     `• ${toSmallCaps('Transfer, Cash, Debit, Hutang, Piutang')}\n\n` +
                                     `📄 ${toSmallCaps('Contoh Single Item')}:\n` +
                                     `PL,TOKO AP CIKADU,piutang,0,1234,Bj,1,0\n\n` +
                                     `📄 ${toSmallCaps('Contoh Multiple Items')}:\n` +
                                     `PL,TOKO AP CIKADU,piutang,0,1234,Bj,1,0,Karet,2,5000\n\n` +
                                     `⚠️ ${toSmallCaps('Pastikan setiap item memiliki 3 parameter: Nama,Qty,Discount')}`;
            
            await ctx.editMessageText(instructionMessage);
            
        } catch (error) {
            console.error('Add purchase transaction error:', error);
            await ctx.editMessageText(`⚠️ ${toSmallCaps('Error occurred. Please try again.')}`, keyboards.postLoginMenu);
        }
    });

    // Handle Purchase ID input and transaction data
    bot.on('text', async (ctx, next) => {
        const userId = ctx.from.id;
        const state = globalState.userStates.get(userId);
        const text = ctx.message.text;

        if (state === 'awaiting_purchase_id' && text.match(/^25\d{7}$/)) { // Purchase ID format
            try {
                const purchaseId = text;
                const loadingMsg = await ctx.reply(`🔍 ${toSmallCaps('Fetching Purchase details...')}`);

                if (!globalState.purchaseChecker) {
                    globalState.purchaseChecker = new PurchaseChecker(globalState.scraper.page);
                }

                await globalState.purchaseChecker.ensureDataLoaded();
                const result = await globalState.purchaseChecker.getPurchaseDetail(purchaseId);
                
                if (result && result.type === 'multiple_images') {
                    // Send multiple screenshots
                    for (const screenshot of result.screenshots) {
                        await ctx.replyWithPhoto({ 
                            source: screenshot.data 
                        }, { 
                            caption: `🛒 ${toSmallCaps(`Detail Purchase #${result.purchaseId} (Part ${screenshot.part}/${screenshot.total})`)}`,
                            parse_mode: 'HTML'
                        });
                        
                        // Small delay between images
                        await new Promise(r => setTimeout(r, 500));
                    }
                } else if (result && result.type === 'image') {
                    // Single screenshot (fallback for modal)
                    await ctx.replyWithPhoto({ 
                        source: result.data 
                    }, { 
                        caption: result.caption,
                        parse_mode: 'HTML'
                    });
                } else {
                    await ctx.reply(`❌ ${toSmallCaps('Could not find Purchase with that ID')}`);
                }

                await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
            } catch (error) {
                console.error('Purchase detail error:', error);
                await ctx.reply(`⚠️ ${toSmallCaps('Error fetching Purchase details')}`);
            } finally {
                globalState.userStates.delete(userId);
                await ctx.reply(`${toSmallCaps('Select an option')}:`, keyboards.postLoginMenu);
            }
        } else if (state === 'awaiting_purchase_transaction_data') {
            try {
                // Expected format: "PL,TOKO AP CIKADU,piutang,0,1234,Bj,1,0"
                const transactionData = text;
                const loadingMsg = await ctx.reply(`🛒 ${toSmallCaps('Creating purchase transaction...')}`);

                if (!globalState.purchaseTransactionChecker) {
                    globalState.purchaseTransactionChecker = new PurchaseTransactionChecker(globalState.scraper.page);
                }

                const result = await globalState.purchaseTransactionChecker.createPurchaseTransaction(transactionData);
                
                if (result.success) {
                    let message = `✅ ${toSmallCaps('Purchase transaction processed successfully!')}\n\n` +
                                  `📋 ${toSmallCaps('Type')}: ${toSmallCaps(result.data.type)}\n` +
                                  `🏪 ${toSmallCaps('Supplier')}: ${toSmallCaps(result.data.supplier)}\n` +
                                  `💰 ${toSmallCaps('Payment')}: ${toSmallCaps(result.data.paymentType)}\n` +
                                  `📅 ${toSmallCaps('Termin')}: ${toSmallCaps(result.data.termin)}\n` +
                                  `📄 ${toSmallCaps('Invoice')}: ${toSmallCaps(result.data.invoice)}\n\n` +
                                  `📦 ${toSmallCaps('Items Processed')}: ${result.data.itemsProcessed}\n`;
                                  
                    // Add each item details
                    result.data.items.forEach((item, index) => {
                        message += `\n📦 ${toSmallCaps(`Item ${index + 1}`)}:\n` +
                                  `   • ${toSmallCaps('Name')}: ${toSmallCaps(item.name)}\n` +
                                  `   • ${toSmallCaps('Qty')}: ${item.qty}\n` +
                                  `   • ${toSmallCaps('Discount')}: ${item.discount}`;
                    });
                    
                    message += `\n\n📊 ${toSmallCaps('Status')}: ${toSmallCaps(result.data.status)}\n`;
                    
                    if (result.data.modalClosed) {
                        message += `\n🎉 ${toSmallCaps(result.data.note)}`;
                    } else {
                        message += `\n⚠️ ${toSmallCaps(result.data.note)}`;
                    }
                                  
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMsg.message_id,
                        null,
                        message
                    );
                } else {
                    await ctx.telegram.editMessageText(
                        ctx.chat.id,
                        loadingMsg.message_id,
                        null,
                        `❌ ${toSmallCaps(result.error)}`
                    );
                }

            } catch (error) {
                console.error('Purchase transaction creation error:', error);
                await ctx.reply(`⚠️ ${toSmallCaps('Error creating purchase transaction')}`);
            } finally {
                globalState.userStates.delete(userId);
                await ctx.reply(`${toSmallCaps('Select an option')}:`, keyboards.postLoginMenu);
            }
        } else {
            return next(); // Pass to next handler
        }
    });
};
