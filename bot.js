const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const GoalBlock = goals.GoalBlock;
const https = require('https'); // ماژول داخلی برای ارسال پیام به تلگرام

// ==========================================================================
// ⚙️ تنظیمات تلگرام (داداش توکن بات و چت آیدی خودت رو اینجا وارد کن)
// ==========================================================================
const TELEGRAM_BOT_TOKEN = '8940324884:AAGZLh7pJ1go9JmWdlMnaoD6j2wWRAnpADY'; // توکن بات تلگرامت
const TELEGRAM_CHAT_ID = '8517754313';     // چت آیدی خودت (عددی)

// تابع اختصاصی برای فرستادن آنی کد وریفای به تلگرام تو
function sendToTelegram(messageText) {
    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN') {
        console.log('⚠ داداش توکن تلگرام رو تنظیم نکردی، پیام فقط توی لاگ چاپ میشه.');
        return;
    }
    
    const data = JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: messageText,
        parse_mode: 'HTML'
    });

    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = https.request(options, (res) => {
        res.on('data', () => {});
    });

    req.on('error', (err) => {
        console.error('❌ خطا در ارسال پیام به تلگرام:', err.message);
    });

    req.write(data);
    req.end();
}

// وضعیت‌های داخلی بات
let portalsEntered = 0;
let isInMainMap = false;
let waitingForTpaConfirm = false;
let targetPlayer = null;
let lastPos = null;

function createBot() {
    console.log('\n=====================================================');
    console.log('=== 🚀 در حال اتصال بات pvp_HSbot به سرور 6b6t ===');
    console.log('=====================================================\n');
    
    const bot = mineflayer.createBot({
        host: '6b6t.org',
        username: 'pvp_HSbot',
        version: '1.21.1',
        skipValidation: true
    });

    bot.loadPlugin(pathfinder);

    bot.on('spawn', () => {
        console.log('✅ بات با موفقیت وارد سرور شد!');
        
        setTimeout(() => {
            bot.chat('/login AZHAN8585@#@#ABOL1234');
            console.log('➡ دستور لاگین ارسال شد.');
        }, 2000);

        portalsEntered = 0;
        isInMainMap = false;
        waitingForTpaConfirm = false;
        targetPlayer = null;

        setTimeout(() => {
            findAndEnterPortal(bot);
        }, 5000);
    });

    async function findAndEnterPortal(bot) {
        if (isInMainMap || portalsEntered >= 2) return;

        console.log(`🔍 در حال جستجوی پورتال ندر... (مرحله ${portalsEntered + 1})`);
        
        const portalBlock = bot.findBlock({
            matching: bot.registry.blocksByName['nether_portal'].id,
            maxDistance: 32
        });

        if (portalBlock) {
            console.log(`📍 پورتال در مختصات ${portalBlock.position} پیدا شد. حرکت به سمت آن...`);
            const mcData = require('minecraft-data')(bot.version);
            const movements = new Movements(bot, mcData);
            movements.canDig = false;
            bot.pathfinder.setMovements(movements);
            
            bot.pathfinder.setGoal(new GoalBlock(portalBlock.position.x, portalBlock.position.y, portalBlock.position.z));
        } else {
            setTimeout(() => findAndEnterPortal(bot), 3000);
        }
    }

    bot.on('move', () => {
        if (isInMainMap) return;
        if (!lastPos) { lastPos = bot.entity.position.clone(); return; }

        if (bot.entity.position.distanceTo(lastPos) > 60) {
            portalsEntered++;
            console.log(`🌌 بات تلپورت شد! تعداد پورتال‌های رد شده: ${portalsEntered}`);
            
            if (portalsEntered >= 2) {
                isInMainMap = true;
                console.log('=== 🎉 بات با موفقیت وارد مپ اصلی 6b6t شد! ===');
            } else {
                setTimeout(() => findAndEnterPortal(bot), 5000);
            }
        }
        lastPos = bot.entity.position.clone();
    });

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;

        if (message === 'pvp_HS tpa') {
            console.log(`💬 درخواست TPA از طرف ${username}`);
            bot.chat(`/tpa ${username}`);
        }

        if (message === 'pvp_HS totem' || message === 'pvp_HSkit') {
            console.log(`📦 دستور کیت/توتم توسط ${username} دریافت شد. جستجوی چست...`);
            
            const chestBlock = bot.findBlock({
                matching: [bot.registry.blocksByName['chest'].id, bot.registry.blocksByName['trapped_chest'].id],
                maxDistance: 20
            });

            if (!chestBlock) {
                bot.chat(`/w ${username} داداش چستی در اطراف من پیدا نشد!`);
                return;
            }

            try {
                const chest = await bot.openChest(chestBlock);
                const shulkerItem = chest.containerItems().find(item => item.name.includes('shulker_box'));

                if (!shulkerItem) {
                    chest.close();
                    bot.chat(`/w ${username} داداش شالکری داخل این چست نبود!`);
                    return;
                }

                await chest.withdraw(shulkerItem.type, null, 1);
                chest.close();
                bot.chat(`/w ${username} شالکر برداشته شد. دارم بهت TPA میدم...`);

                targetPlayer = username;
                waitingForTpaConfirm = true;
                bot.chat(`/tpa ${username}`);

            } catch (err) {
                console.error(err);
                bot.chat(`/w ${username} باگ در باز کردن چست رخ داد!`);
            }
        }
    });

    bot.on('message', (jsonMsg) => {
        const msg = jsonMsg.toString();
        if (msg.includes('has requested to teleport to you') || msg.includes('tpa')) {
            console.log('🤝 ریکوئست TPA ورودی دریافت شد. در حال قبول کردن...');
            bot.chat('/tpaccept');
        }
    });

    bot.on('forcedMove', () => {
        if (waitingForTpaConfirm && targetPlayer) {
            waitingForTpaConfirm = false;
            console.log(`💀 بات به موقعیت ${targetPlayer} رسید. اجرای دستور خودکشی...`);
            
            setTimeout(() => {
                bot.chat('/kill');
                console.log(`☠️ بات کشته شد و شالکر کیت دراپ شد. بازگشت به تخت بیس...`);
                targetPlayer = null;
            }, 1500);
        }
    });

    // 🔥 شکارچی اصلی پیام کیک سرور و ارسال آن به تلگرام شما
    bot.on('kick', (reason) => {
        let kickMessage = 'نامشخص';
        
        // استخراج و تمیز کردن متن ارور سرور (حتی اگر ساختار پیچیده ماینکرفتی داشته باشه)
        if (reason) {
            if (typeof reason === 'object') {
                kickMessage = reason.text || '';
                if (reason.extra && Array.isArray(reason.extra)) {
                    kickMessage += ' ' + reason.extra.map(e => e.text || JSON.stringify(e)).join('');
                }
                if (!kickMessage) kickMessage = JSON.stringify(reason, null, 2);
            } else {
                kickMessage = reason.toString();
            }
        }

        console.log('\n======================================================================');
        console.log('⚠️ ALERT: KICKED FROM SERVER - متن کامل در زیر چاپ و به تلگرام ارسال شد:');
        console.log(kickMessage);
        console.log('======================================================================\n');

        // ساخت قالب پیام تلگرام
        const telegramAlert = `🚨 <b>بات pvp_HSbot از سرور 6b6t کیک شد!</b>\n\n` +
                              `🔑 <b>پیام کیک / کد وریفای VPN:</b>\n` +
                              `<code>${kickMessage}</code>\n\n` +
                              `⏱ <b>داداش ۴ دقیقه (۲۴۰ ثانیه) فرصت داری این رو توی سایت ثبت کنی. بعد از اون بات دوباره تلاش می‌کنه وارد بشه.</b>`;
        
        // ارسال مستقیم به تلگرام شما
        sendToTelegram(telegramAlert);
    });

    bot.on('end', (reason) => {
        console.log(`🛑 ارتباط قطع شد (end). دلیل: ${reason}`);
        console.log('⏱️ طبق دستور شما، ۴ دقیقه (۲۴۰۰۰۰ میلی ثانیه) قفل می‌کنیم تا بتونی کارات رو بکنی...');
        setTimeout(() => createBot(), 240000);
    });

    bot.on('error', (err) => {
        console.error('❌ خطای شبکه:', err ? err.message : 'نامشخص');
    });
}

// جلوگیری از کرش کل پروسه گیت‌هاب برای اطمینان از ارسال پیام
process.on('uncaughtException', (err) => {
    console.error('🔥 خطای ناگهانی پروسه:', err);
});

createBot();
