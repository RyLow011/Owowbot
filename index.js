/**
 * OwO Cash Auto Farmer
 * Deneysel / Test amaçlı
 */

const { Client } = require("discord.js-selfbot-v13");
require("dotenv").config();

// ─────────────── AYARLAR ───────────────
const CONFIG = {
  token:          process.env.DISCORD_TOKEN,
  channelId:      process.env.CHANNEL_ID,
  controlChannel: process.env.CONTROL_CHANNEL_ID,
  ownerId:        process.env.OWNER_ID,          // kontrol komutlarını kullanacak hesabın ID'si

  minDelay: 15_000,
  maxDelay: 20_000,

  commands: [
    { key: "hunt",   cmd: "owo h",     cooldown: 0       },
    { key: "battle", cmd: "owo b",     cooldown: 0       },
    { key: "pray",   cmd: "owo pray",  cooldown: 300_000 },
    { key: "money",  cmd: "owo money", cooldown: 0       },
    { key: "cf",     cmd: "owo cf 1",  cooldown: 0       },
    { key: "bj",     cmd: "owo bj 1",  cooldown: 0       },
  ]
};
// ────────────────────────────────────────

if (!CONFIG.token || !CONFIG.channelId || !CONFIG.controlChannel || !CONFIG.ownerId) {
  console.error("❌ DISCORD_TOKEN, CHANNEL_ID, CONTROL_CHANNEL_ID veya OWNER_ID eksik!");
  process.exit(1);
}

const client = new Client({ checkUpdate: false });
const lastUsed = {};

// ── Durum değişkeni ──
let isPaused = false;
// ─────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function canUse(key, cooldown) {
  if (cooldown === 0) return true;
  if (!lastUsed[key]) return true;
  return Date.now() - lastUsed[key] >= cooldown;
}

function timeUntil(key, cooldown) {
  if (!lastUsed[key]) return 0;
  return Math.max(0, cooldown - (Date.now() - lastUsed[key]));
}

// Pause olduğunda çözülmesini bekleyen yardımcı
function waitUntilResumed() {
  return new Promise(resolve => {
    const check = setInterval(() => {
      if (!isPaused) {
        clearInterval(check);
        resolve();
      }
    }, 1000);
  });
}

async function farmLoop(channel) {
  console.log("\n🌀 Farm döngüsü başladı...\n");
  let loopCount = 0;

  while (true) {
    // Duraklatıldıysa bekle
    if (isPaused) {
      console.log("⏸  Bot duraklatıldı, bekleniyor...");
      await waitUntilResumed();
      console.log("▶️  Bot devam ediyor...\n");
    }

    loopCount++;
    const shuffled = shuffle(CONFIG.commands);
    console.log(`\n🔀 Döngü #${loopCount} → ${shuffled.map(c => c.key).join(" → ")}\n`);

    for (const { key, cmd, cooldown } of shuffled) {
      // Her komut öncesi pause kontrolü
      if (isPaused) {
        console.log("⏸  Döngü ortasında duraklatıldı...");
        await waitUntilResumed();
        console.log("▶️  Devam ediliyor...\n");
      }

      if (!canUse(key, cooldown)) {
        const secs = Math.ceil(timeUntil(key, cooldown) / 1000);
        console.log(`⏳ [${key}] cooldown: ${secs}s kaldı, atlanıyor`);
        continue;
      }

      try {
        await channel.send(cmd);
        lastUsed[key] = Date.now();
        console.log(`✅ [${new Date().toLocaleTimeString("tr-TR")}] "${cmd}" gönderildi`);
      } catch (err) {
        console.error(`❌ [${key}] hata:`, err.message);
      }

      await sleep(randomDelay(CONFIG.minDelay, CONFIG.maxDelay));
    }
  }
}

client.on("ready", async () => {
  console.log(`\n🤖 Giriş: ${client.user.tag}`);
  console.log(`📡 Farm kanalı:    ${CONFIG.channelId}`);
  console.log(`🎮 Kontrol kanalı: ${CONFIG.controlChannel}\n`);

  const farmChannel    = await client.channels.fetch(CONFIG.channelId).catch(() => null);
  const controlChannel = await client.channels.fetch(CONFIG.controlChannel).catch(() => null);

  if (!farmChannel || !farmChannel.isText()) {
    console.error("❌ Farm kanalı bulunamadı!");
    process.exit(1);
  }
  if (!controlChannel || !controlChannel.isText()) {
    console.error("❌ Kontrol kanalı bulunamadı!");
    process.exit(1);
  }

  await controlChannel.send("✅ **Bot başlatıldı!**\n`!durdur` → farm duraklat\n`!baslat` → farm devam ettir\n`!durum` → mevcut durumu göster");

  farmLoop(farmChannel);
});

client.on("messageCreate", async (msg) => {
  // ── Kontrol komutları (sadece kendi mesajların) ──
  if (msg.author.id === CONFIG.ownerId && msg.channel.id === CONFIG.controlChannel) {
    const content = msg.content.trim().toLowerCase();

    if (content === "!durdur") {
      if (isPaused) {
        await msg.channel.send("⚠️ Bot zaten duraklatılmış.");
      } else {
        isPaused = true;
        console.log("\n⏸  DURDURULDU (kontrol kanalından)\n");
        await msg.channel.send("⏸ **Farm durduruldu.** Devam ettirmek için `!baslat` yaz.");
      }
      return;
    }

    if (content === "!baslat") {
      if (!isPaused) {
        await msg.channel.send("⚠️ Bot zaten çalışıyor.");
      } else {
        isPaused = false;
        console.log("\n▶️  BAŞLATILDI (kontrol kanalından)\n");
        await msg.channel.send("▶️ **Farm devam ediyor!**");
      }
      return;
    }

    if (content === "!durum") {
      const status = isPaused ? "⏸ Duraklatılmış" : "▶️ Çalışıyor";
      await msg.channel.send(`📊 **Bot durumu:** ${status}`);
      return;
    }
  }

  // ── OwO captcha kontrolü ──
  if (msg.author.id === "408785106942164992" && msg.channel.id === CONFIG.channelId) {
    if (
      msg.content.toLowerCase().includes("captcha") ||
      msg.embeds?.[0]?.title?.toLowerCase().includes("captcha")
    ) {
      isPaused = true;
      console.warn("\n🚨 CAPTCHA ALGILANDI! Farm duraklatıldı.\n");
      const ctrl = await client.channels.fetch(CONFIG.controlChannel).catch(() => null);
      if (ctrl) await ctrl.send("🚨 **CAPTCHA algılandı!** Farm otomatik durduruldu. Captcha'yı çözdükten sonra `!baslat` yaz.");
    }
    if (msg.content.includes("cowoncy")) {
      console.log(`💰 ${msg.content.slice(0, 120)}`);
    }
  }
});

client.login(CONFIG.token);
