const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const GoalBlock = goals.GoalBlock;

// وضعیت‌های داخلی بات
let portalsEntered = 0;
let isInMainMap = false;
let waitingForTpaConfirm = false;
let targetPlayer = null;
let lastPos = null;

function createBot() {
    console.log('=== در حال اتصال بات pvp_HSbot به سرور 6b6t ===');
    
    const bot = mineflayer.createBot({
        host: '6b6t.org',
        username: 'pvp_HSbot',
        version: '1.21.1', // تنظیم روی آخرین نسخه پایدار سرور
        skipValidation: true
    });

    // بارگذاری پلاگین مسیریابی هوشمند برای رفتن داخل پورتال‌ها و سمت چست‌ها
    bot.loadPlugin(pathfinder);

    bot.on('spawn', () => {
        console.log('بات وارد سرور شد!');
        
        // ۱. عملیات لاگین خودکار با پسورد شما
        setTimeout(() => {
            bot.chat('/login AZHAN8585@#@#ABOL1234');
            console.log('دستور لاگین ارسال شد.');
        }, 2000);

        // ریست کردن وضعیت لابی‌ها در صورت دیسکانکت و اتصال مجدد
        portalsEntered = 0;
        isInMainMap = false;
        waitingForTpaConfirm = false;
        targetPlayer = null;

        // شروع پایش پورتال‌های لابی بعد از لاگین
        setTimeout(() => {
            findAndEnterPortal(bot);
        }, 5000);
    });

    // ۲. سیستم هوشمند رد کردن ۲ مرحله‌ای پورتال‌های لابی
    async function findAndEnterPortal(bot) {
        if (isInMainMap || portalsEntered >= 2) return;

        console.log(`در حال جستجوی پورتال ندر... (مرحله ${portalsEntered + 1})`);
        
        const portalBlock = bot.findBlock({
            matching: bot.registry.blocksByName['nether_portal'].id,
            maxDistance: 32
        });

        if (portalBlock) {
            console.log(`پورتال در مختصات ${portalBlock.position} پیدا شد. حرکت به سمت آن...`);
            const mcData = require('minecraft-data')(bot.version);
            const movements = new Movements(bot, mcData);
            movements.canDig = false; // بلاک‌ها رو خراب نکنه
            bot.pathfinder.setMovements(movements);
            
            bot.pathfinder.setGoal(new GoalBlock(portalBlock.position.x, portalBlock.position.y, portalBlock.position.z));
        } else {
            // اگر پیدا نشد، ۳ ثانیه دیگر دوباره بگرد
            setTimeout(() => findAndEnterPortal(bot), 3000);
        }
    }

    // تشخیص عبور از پورتال بر اساس پرش ناگهانی مختصات (تلپورت لابی)
    bot.on('move', () => {
        if (isInMainMap) return;
        if (!lastPos) { lastPos = bot.entity.position.clone(); return; }

        if (bot.entity.position.distanceTo(lastPos) > 60) {
            portalsEntered++;
            console.log(`بات تلپورت شد! تعداد پورتال‌های رد شده: ${portalsEntered}`);
            
            if (portalsEntered >= 2) {
                isInMainMap = true;
                console.log('=== بات با موفقیت وارد مپ اصلی 6b6t شد! سیستم خودکار پورتال خاموش شد ===');
            } else {
                // ورود به لابی دوم، ۵ ثانیه صبر و سپس ورود به پورتال دوم
                setTimeout(() => findAndEnterPortal(bot), 5000);
            }
        }
        lastPos = bot.entity.position.clone();
    });

    // ۳. مدیریت دستورات چت و ریکوئست‌های TPA
    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;

        // دستور درخواست تی‌پی از بات
        if (message === 'pvp_HS tpa') {
            console.log(`درخواست TPA از طرف ${username}`);
            bot.chat(`/tpa ${username}`);
        }

        // دستور برداشتن توتم یا کیت از چست و انتحاری
        if (message === 'pvp_HS totem' || message === 'pvp_HSkit') {
            console.log(`دستور کیت/توتم توسط ${username} دریافت شد. جستجوی چست...`);
            
            // پیدا کردن نزدیک‌ترین چست یا چست ترپ شده در بیس شما
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
                // جستجو برای پیدا کردن هر نوع شالکر باکس موجود در چست
                const shulkerItem = chest.containerItems().find(item => item.name.includes('shulker_box'));

                if (!shulkerItem) {
                    chest.close();
                    bot.chat(`/w ${username} داداش شالکری داخل این چست نبود!`);
                    return;
                }

                // برداشتن ۱ عدد شالکر باکس
                await chest.withdraw(shulkerItem.type, null, 1);
                chest.close();
                bot.chat(`/w ${username} شالکر برداشته شد. دارم بهت TPA میدم...`);

                // آماده‌سازی برای تلپورت و مرگ
                targetPlayer = username;
                waitingForTpaConfirm = true;
                bot.chat(`/tpa ${username}`);

            } catch (err) {
                console.error(err);
                bot.chat(`/w ${username} باگ در باز کردن چست رخ داد!`);
            }
        }
    });

    // قبول کردن خودکار TPA وقتی تو بهش ریکوئست میدی
    bot.on('message', (jsonMsg) => {
        const msg = jsonMsg.toString();
        if (msg.includes('has requested to teleport to you') || msg.includes('tpa')) {
            console.log('ریکوئست TPA ورودی دریافت شد. در حال قبول کردن...');
            bot.chat('/tpaccept');
        }
    });

    // ۴. تشخیص رسیدن به موقعیت تو و زدن دستور خودکشی
    bot.on('forcedMove', () => {
        if (waitingForTpaConfirm && targetPlayer) {
            waitingForTpaConfirm = false;
            console.log(`بات به موقعیت ${targetPlayer} رسید. اجرای دستور خودکشی...`);
            
            setTimeout(() => {
                bot.chat('/kill');
                console.log(`بات کشته شد و شالکر کیت دراپ شد. بازگشت به تخت بیس...`);
                targetPlayer = null;
            }, 1500); // ۱.۵ ثانیه صبر میکنه تا مپ لود شه و شالکر دقیقاً پیش تو بیفته
        }
    });

    // دریافت متن کامل کیک شدن از سرور (برای وریفای شما)
    bot.on('kick', (reason) => {
        console.log('=============================================');
        console.log('⚠️ بات از سرور کیک شد! متن کامل دلیل کیک در زیر آمده است:');
        console.log('متن خام یا آبجکت کیک:', typeof reason === 'object' ? JSON.stringify(reason, null, 2) : reason);
        if (reason && reason.toString) {
            console.log('متن نهایی کیک (Readable):', reason.toString());
        }
        console.log('=============================================');
    });

    // ۵. سیستم آنتی دیسکانکت با تاخیر ۴ دقیقه‌ای (۲۴۰۰۰۰ میلی‌ثانیه)
    bot.on('end', (reason) => {
        console.log(`بات دیسکانکت شد. دلیل پایان کانکشن: ${reason}`);
        console.log('⏱️ طبق دستور شما، ۴ دقیقه (۲۴۰۰۰۰ میلی ثانیه) صبر می‌کنیم تا بتونی وریفای کنی...');
        setTimeout(() => createBot(), 240000);
    });

    bot.on('error', (err) => {
        console.error('خطای تحت شبکه یا کلاینت:', err);
    });
}

createBot();
