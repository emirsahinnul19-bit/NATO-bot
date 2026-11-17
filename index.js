const express = require('express');
const { Pool } = require('pg');
const { Client, GatewayIntentBits, Events, MessageFlags, EmbedBuilder } = require('discord.js');

const clean = v => String(v || '').trim().replace(/^["']|["']$/g, '');
const DISCORD_BOT_TOKEN = clean(process.env.DISCORD_BOT_TOKEN);
const DATABASE_URL = clean(process.env.DATABASE_URL);
const PORT = process.env.PORT || 3000;

if (!DISCORD_BOT_TOKEN || !DATABASE_URL) {
  console.error('Eksik ortam değişkeni: DISCORD_BOT_TOKEN ve DATABASE_URL gerekli.');
  process.exit(1);
}

// Sunucuya yeni katılan, sitede kayıtlı kişiyi otomatik günceller.
const AUTO_SYNC_ON_JOIN = true;

const db = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });

/* ===== WEB SUNUCU (Render açık kalsın diye) ===== */
const app = express();
app.get('/', (req, res) => res.send('NATO bot çalışıyor.'));
app.listen(PORT, () => console.log('[WEB] Port:', PORT));

/* ===== BOT ===== */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once(Events.ClientReady, async () => {
  console.log(`[BOT] Giriş yapıldı: ${client.user.tag}`);
  try {
    await client.application.commands.set([
      { name: 'update', description: 'Site hesabındaki grup ve rütbelere göre rollerini ve takma adını günceller.' }
    ]);
    console.log('[BOT] /update komutu tüm sunucular için kaydedildi.');
  } catch (e) {
    console.error('[BOT] Komut kaydedilemedi:', e.message);
  }
  // Eski sürümden kalan sunucuya özel komutları temizle (çift /update görünmesin)
  for (const g of client.guilds.cache.values()) {
    try { await g.commands.set([]); } catch {}
  }
});

/* ===== VERİ ===== */
async function loadConfig() {
  const servers = (await db.query('SELECT guild_id FROM servers')).rows.map(r => r.guild_id);
  const groupRoles = (await db.query('SELECT group_key, guild_id, role_id FROM group_roles')).rows;
  const rankRoles = (await db.query('SELECT rank_id, guild_id, role_id FROM rank_roles')).rows;
  return { servers, groupRoles, rankRoles };
}

async function loadUser(userId) {
  const u = (await db.query('SELECT mc_name FROM users WHERE id=$1', [userId])).rows[0];
  if (!u || !u.mc_name) return null;
  const groups = (await db.query(
    "SELECT group_key FROM group_requests WHERE user_id=$1 AND status='approved'", [userId]
  )).rows.map(r => r.group_key);
  const ranks = (await db.query('SELECT rank_id, guilds FROM user_ranks WHERE user_id=$1', [userId])).rows;
  const summary = (await db.query(
    `SELECT g.label, COALESCE(string_agg(r.name, ', ' ORDER BY r.sort), '') AS ranks
     FROM group_requests q
     JOIN org_groups g ON g.key = q.group_key
     LEFT JOIN user_ranks ur ON ur.user_id = q.user_id
     LEFT JOIN ranks r ON r.id = ur.rank_id AND r.group_key = q.group_key
     WHERE q.user_id=$1 AND q.status='approved'
     GROUP BY g.label, g.sort ORDER BY g.sort`, [userId]
  )).rows;
  return { mcName: u.mc_name, groups, ranks, summary };
}

// Bir sunucu için olması gereken roller (desired) ve botun yönettiği tüm roller (managed)
function planFor(cfg, user, guildId) {
  const managed = new Set();
  const desired = new Set();
  for (const r of cfg.groupRoles) {
    if (r.guild_id !== guildId) continue;
    managed.add(r.role_id);
    if (user.groups.includes(r.group_key)) desired.add(r.role_id);
  }
  for (const r of cfg.rankRoles) {
    if (r.guild_id !== guildId) continue;
    managed.add(r.role_id);
    const ur = user.ranks.find(x => x.rank_id === r.rank_id);
    if (ur && (!ur.guilds.length || ur.guilds.includes(guildId))) desired.add(r.role_id);
  }
  return { managed, desired };
}

async function syncMember(guild, member, user, cfg) {
  const { managed, desired } = planFor(cfg, user, guild.id);
  const out = { added: [], removed: [], notes: [], nick: null };

  const missing = [...desired].filter(id => !guild.roles.cache.has(id));
  if (missing.length) out.notes.push(`Sunucuda bulunamayan rol ID: ${missing.join(', ')}`);

  const toAdd = [...desired].filter(id => guild.roles.cache.has(id) && !member.roles.cache.has(id));
  const toRemove = [...managed].filter(id => !desired.has(id) && guild.roles.cache.has(id) && member.roles.cache.has(id));

  if (toAdd.length) {
    try { await member.roles.add(toAdd, 'NATO /update'); out.added = toAdd; }
    catch { out.notes.push('Roller verilemedi (botun rolü verilecek rollerin üstünde olmalı).'); }
  }
  if (toRemove.length) {
    try { await member.roles.remove(toRemove, 'NATO /update'); out.removed = toRemove; }
    catch { out.notes.push('Roller alınamadı (botun rolü bu rollerin üstünde olmalı).'); }
  }

  if (member.id === guild.ownerId) {
    out.notes.push('Sunucu sahibinin takma adı değiştirilemez.');
  } else if (member.nickname !== user.mcName) {
    try { await member.setNickname(user.mcName, 'NATO /update'); out.nick = user.mcName; }
    catch { out.notes.push('Takma ad değişmedi (botun rolü yeterince yüksek mi?).'); }
  }
  return out;
}

/* ===== /update ===== */
const lastUse = new Map();

client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand() || i.commandName !== 'update') return;

  const now = Date.now();
  if (now - (lastUse.get(i.user.id) || 0) < 30000) {
    return i.reply({ content: 'Biraz bekle, bu komutu 30 saniyede bir kullanabilirsin.', flags: MessageFlags.Ephemeral });
  }
  lastUse.set(i.user.id, now);

  await i.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const user = await loadUser(i.user.id);
    if (!user) {
      return i.editReply('Sitede hesabın ya da Minecraft adın kayıtlı değil. Önce siteye Discord ile giriş yapıp Minecraft adını kaydet.');
    }
    const cfg = await loadConfig();

    const embed = new EmbedBuilder()
      .setColor(0xffb800)
      .setTitle('NATO · Güncelleme')
      .setDescription(`**${user.mcName}** hesabın güncellendi.`)
      .setThumbnail(i.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'NATO' });

    embed.addFields({
      name: 'Gruplar ve rütbeler',
      value: (user.summary.length
        ? user.summary.map(s => `• **${s.label}**${s.ranks ? ' — ' + s.ranks : ''}`).join('\n')
        : 'Henüz onaylı bir grubun yok. Sitedeki Gruplar bölümünden istek atabilirsin.').slice(0, 1000)
    });

    let touched = 0;
    for (const guildId of cfg.servers) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;
      let member;
      try { member = await guild.members.fetch(i.user.id); } catch { continue; }
      touched++;
      const r = await syncMember(guild, member, user, cfg);
      const lines = [];
      if (r.added.length) lines.push('✅ Verildi: ' + r.added.map(id => `<@&${id}>`).join(' '));
      if (r.removed.length) lines.push('➖ Alındı: ' + r.removed.map(id => `<@&${id}>`).join(' '));
      if (r.nick) lines.push(`✏️ Takma ad: ${r.nick}`);
      r.notes.forEach(n => lines.push('⚠️ ' + n));
      embed.addFields({ name: guild.name, value: (lines.join('\n') || 'Değişiklik yok, zaten güncel.').slice(0, 1000) });
    }

    if (!touched) return i.editReply('Bot ile ortak olduğun, NATO sistemine kayıtlı bir sunucu bulunamadı.');
    await i.editReply({ embeds: [embed] });
  } catch (e) {
    console.error('[UPDATE] Hata:', e);
    await i.editReply('Bir hata oluştu. Birkaç dakika sonra tekrar dene.');
  }
});

/* ===== YENİ KATILAN ===== */
client.on(Events.GuildMemberAdd, async (member) => {
  if (!AUTO_SYNC_ON_JOIN) return;
  try {
    const cfg = await loadConfig();
    if (!cfg.servers.includes(member.guild.id)) return;
    const user = await loadUser(member.id);
    if (user) await syncMember(member.guild, member, user, cfg);
  } catch (e) {
    console.error('[JOIN] Hata:', e.message);
  }
});

process.on('unhandledRejection', e => console.error('[HATA]', e));
client.on(Events.Error, e => console.error('[CLIENT HATA]', e));

client.login(DISCORD_BOT_TOKEN);
