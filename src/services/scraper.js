const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');

// Enable stealth mode
puppeteer.use(StealthPlugin());

class WebScraper {
    constructor() {
        this.url = 'https://portal.rajawalielastis.com/login';
        this.cookies = {
            'remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d': 'eyJpdiI6ImdWakxsN0tTcnl5YXppWlYzNkVWcWc9PSIsInZhbHVlIjoibWYycThDT2ZPeDZmcjcwYm84WkZrWGNuV0F5eG1KS2l0dTRWQVNMMis3WHBPY0psRXRvbTNDLzBIRktESEU1OWVqKzF0MDlIZDA0azhlZTljSkxrYi9EdmJST2dvWUIvM3d3elFrcE5sVXlYM0kvUXZla1BTU0pCYTFsMHNZSjZyNHhGcWdxa09sb2RxR0J3ejF4QmtTRXV0K09FNjVyeXJZcHFPSmE1Sy9hdGE1ZVlkdERnWGxTemFNazRGZ0FuUDYyUUJuSHF6dnhNYUp6MTRJR0JIaEwyLzdFMlR6UGZzalkvQTJsNloxaz0iLCJtYWMiOiI3YmJjYzUzMjg4YjBjYmQxOTBmMTA1OThkOGQ1MDRiZjdlMWNmYmNlZTdiMDAwN2RjNGFlNmM2ZTYxOWE2YjMwIiwidGFnIjoiIn0%3D',
            'XSRF-TOKEN': 'eyJpdiI6InRid2RGSDg3U1E0ZmYxTWpyZTRIU2c9PSIsInZhbHVlIjoibGw3anhpdXVwcktvcEp0cVFNYWxGbGxmc1pBM083MlF5UWlOaUxrc09uK1FXSTlrV3o3bFhRaGlsY0tlbEZQTlJnTXlZWjJBblVYdTB5b2tBcWtZaWZUY0h1M0I0dE44NzVnK0FTd3lyMjZMMTFBZFNua25MUXowRDg0cHRkaTgiLCJtYWMiOiIxOTM2OTgyZGM1MTlmZjlhYTMwY2FjMzIwN2FiMTRiNDA4OGM3NjBlMWNiMzNlOTM0MzM3ZGM5ODU0N2Q2OTlhIiwidGFnIjoiIn0%3D',
            'laravel_session': 'eyJpdiI6Imh5RktiY0FSbkxXamZ0VGtBQkNSUkE9PSIsInZhbHVlIjoiT3JmcEk3aEl6L0FqRWUwdkdHN0hhV2ZMalZXYWFGQjBVSnF5QjJGTnc3dnVvTEsvdG1reStrbjE5ZCtDS1hZN2lxTEdGOExRZGJhMVM0SjVsRW5UcUdzTU9IeUw1Zzk1Q3RUZnFuSm1FbkpLSk9LNzFYNGZEQmhqUzJUZis4THIiLCJtYWMiOiIyNzIyMmQ0NTQxMjE3M2ZkMWI3NTAzMjMyNjUzMTgyYjQzYjMwZDZjMGMyNmMyYzdlYzExMmI0ZmM1ODAwZDFmIiwidGFnIjoiIn0%3D'
        };
        this.page = null; // Add page property
    }

    async initBrowser(headless = false) {
        console.log('🚀 ɪɴɪᴛɪᴀʟɪᴢɪɴɢ ʙʀᴏᴡsᴇʀ...');
        this.browser = await puppeteer.launch({
            headless: headless ? 'new' : false,
            defaultViewport: null,
            args: ['--start-maximized']
        });
        console.log('✅ ʙʀᴏᴡsᴇʀ ɪɴɪᴛɪᴀʟɪᴢᴇᴅ');
    }

    async loginWithCookie() {
        try {
            console.log('📝 sᴛᴀʀᴛɪɴɢ ʟᴏɢɪɴ ᴘʀᴏᴇss...');
            this.page = await this.browser.newPage();
            
            // Set user agent and headers
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
            await this.page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            });

            // Set cookies with correct domain
            console.log('🍪 sᴇᴛᴛɪɴɢ ᴄᴏᴏᴋɪᴇs...');
            const cookieObjects = Object.entries(this.cookies).map(([name, value]) => ({
                name,
                value,
                domain: 'portal.rajawalielastis.com',
                path: '/',
                secure: true,
                httpOnly: true
            }));
            await this.page.setCookie(...cookieObjects);
            console.log('✅ ᴄᴏᴏᴋɪᴇs sᴇᴛ sᴜᴄᴄᴇssғᴜʟʟʏ');

            // Navigate with custom options
            console.log('🌐 ɴᴀᴠɪɢᴀᴛɪɴɢ ᴛᴏ ᴡᴇʙsɪᴛᴇ...');
            await this.page.goto(this.url, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            console.log('✅ ᴘᴀɢᴇ ʟᴏᴀᴅᴇᴅ sᴜᴄᴄᴇssғᴜʟʟʏ');

            // Small delay to allow possible auto-redirects AFTER initial load.
            // Previously used page.evaluate(...setTimeout...) which failed if a redirect happened
            // (Execution context destroyed). Using a Node-side sleep avoids that.
            await new Promise(r => setTimeout(r, 2000));

            // If a redirect is still in progress, wait a bit more but don't throw if none.
            // This catches late client-side navigations without risking an error.
            try {
                const navPromise = this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 4000 });
                // Race with a timeout so we don't always wait full duration
                await Promise.race([
                    navPromise,
                    new Promise(r => setTimeout(r, 1500))
                ]);
            } catch (_) {
                // Ignore navigation timeout; it just means no further redirect occurred.
            }

            // Check if login successful with better selectors
            const content = await this.page.content();
            const $ = cheerio.load(content);
            
            // Debug current URL
            const currentUrl = this.page.url();
            console.log('📍 ᴄᴜʀʀᴇɴᴛ ᴜʀʟ:', currentUrl);

            // Check multiple possible dashboard elements
            const dashboardElement = $('.content-wrapper, .main-content, body.skin-blue');
            const welcomeText = $('*:contains("Welcome")').length > 0;
            const isLoginPage = currentUrl.includes('/login');

            if (!isLoginPage || dashboardElement.length > 0 || welcomeText) {
                console.log('✅ ʟᴏɡɪɴ sᴜᴄᴄᴇssғᴜʟ! ʙʀᴏᴡsᴇʀ ᴡɪʟʟ sᴛᴀʏ ᴏᴘᴇɴ.');
                console.log('🔍 ғᴏᴜɴᴅ ᴅᴀsʜʙᴏᴀʀᴅ ᴇʟᴇᴍᴇɴᴛs:', dashboardElement.length);
                this.setupSignalHandlers();
                return true;
            } else {
                console.log('❌ ʟᴏɢɪɴ ғᴀɪʟᴇᴅ - sᴛɪʟʟ ᴏɴ ʟᴏɢɪɴ ᴘᴀɢᴇ');
                console.log('🔍 ᴅᴀsʜʙᴏᴀʀᴅ ᴇʟᴇᴍᴇɴᴛs ғᴏᴜɴᴅ:', dashboardElement.length);
                // Extra debug hints
                const title = await this.page.title();
                console.log('🧪 ᴘᴀɢᴇ ᴛɪᴛʟᴇ:', title);
                console.log('🧪 ғɪʀsᴛ 200 ᴄʜᴀʀs ᴏғ ʙᴏᴅʏ:', content.substring(0, 200));
                return false;
            }

        } catch (error) {
            console.error('❌ ᴇʀʀᴏʀ ᴅᴜʀɪɴɢ ʟᴏɡɪɴ:', error);
            throw error;
        }
    }

    setupSignalHandlers() {
        process.on('SIGINT', () => {
            console.log('\n👋 ʙᴏᴛ sᴛᴏᴘᴘᴇᴅ. ʙʀᴏᴡsᴇʀ ɪs sᴛɪʟʟ ʀᴜɴɴɪɴɢ...');
        });

        process.on('SIGTERM', () => {
            console.log('\n👋 ʙᴏᴛ sᴛᴏᴘᴘᴇᴅ. ʙʀᴏᴡsᴇʀ ɪs sᴛɪʟʟ ʀᴜɴɴɪɴɢ...');
        });

        console.log('✅ ʙʀᴏᴡsᴇʀ ᴡɪʟʟ sᴛᴀʏ ᴏᴘᴇɴ ᴇᴠᴇɴ ᴀғᴛᴇʀ ʙᴏᴛ sᴛᴏᴘs');
    }
}

module.exports = WebScraper;



