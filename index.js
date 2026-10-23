// 1. EXPRESS WEB SUNUCUSU (RENDER PORT UYUMU & OAUTH2 KÖPRÜSÜ)
const express = require('express');
const fetch = require('node-fetch'); // Eğer botunda yoksa terminale: npm install node-fetch
const app = express();

app.use(express.json());

// CORS izni (Vercel sitesi ile Render sunucumuz rahatça konuşabilsin diye)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

const PORT = process.env.PORT || 10000;

// Discord Bot Bilgileri
const CLIENT_ID = '1539374890405204070';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'BURAYA_DISCORD_CLIENT_SECRET_Gelecek'; // Render Environment Variables kısmına ekleyebilirsin
const REDIRECT_URI = 'https://natox-mauve.vercel.app';
const GUILD_ID = '1423304509299494984'; // NATO Discord Sunucu ID'n (Kontrol edip güncelleyebilirsin)

app.get('/', (req, res) => {
    res.status(200).send('NATO Moderasyon Botu & OAuth2 API 7/24 Aktif!');
});

// Siteden gelen 'code' parametresini alıp Discord'dan kullanıcı bilgilerini ve rollerini çeken API
app.get('/api/auth', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).json({ error: 'Kod bulunamadı!' });

    try {
        // 1. Adım: Discord'dan Access Token al
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) {
            return res.status(400).json({ error: 'Token alınamadı!', details: tokenData });
        }

        // 2. Adım: Kullanıcının Temel Discord Profil Bilgilerini Çek
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { authorization: `${tokenData.token_type} ${tokenData.access_token}` },
        });
        const userData = await userResponse.json();

        // 3. Adım: Kullanıcının NATO Sunucusundaki Canlı Üye Verilerini ve Rollerimi Çek
        let memberRoles = [];
        let memberJoinedAt = null;
        try {
            const guildMemberResponse = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userData.id}`, {
                headers: { Authorization: `Bot ${process.env.TOKEN}` }
            });
            if (guildMemberResponse.ok) {
                const guildMemberData = await guildMemberResponse.json();
                memberRoles = guildMemberData.roles || [];
                memberJoinedAt = guildMemberData.joined_at;
            }
        } catch (e) {
            console.error("Sunucu rolleri çekilemedi:", e);
        }

        // Avatar URL oluşturma
        const avatarUrl = userData.avatar 
            ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/0.png`;

        res.json({
            success: true,
            user: {
                id: userData.id,
                username: userData.username,
                global_name: userData.global_name || userData.username,
                avatarUrl: avatarUrl,
                roles: memberRoles,
                joinedAt: memberJoinedAt
            }
        });

    } catch (error) {
        console.error("OAuth2 Hata:", error);
        res.status(500).json({ error: 'Sunucu yetkilendirme hatası oluştu.' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web sunucusu ${PORT} portunda başarıyla başlatıldı.`);
});

// 2. DISCORD BOT KODLARI (Senin Orijinal Kodların)
const { 
    Client, 
    GatewayIntentBits, 
    SlashCommandBuilder, 
    REST, 
    Routes, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits,
    MessageFlags 
} = require('discord.js');
const db = require('croxydb');

const TOKEN = process.env.TOKEN;
const CLIENT_ID_BOT = '1539374890405204070';
const SITE_LINKI = 'https://sites.google.com/view/nato/nato/verifly?authuser=0'; 
const ONAYLI_ROL_ID = ''; 

const ROLLER = {
    CIVILIAN: '1463997729888931945',
    SOLDIER: '1437766285311217697',
    ER: '1433164213689520252',
    ASTEGMEN: '1440413134765686905',
    TEGMEN: '1440413328932339793',
    USTEGMEN: '1440413618171805800',
    YUZBASI: '1440413707367616523',
    BINBASI: '1440413888729583720',
    ALBAY: '1465002980502929697',
    YARBAY: '1465003356727804170',
    TUGGENERAL: '1422673618478956694'
};

const VARSAYILAN_RUTBELER = {
    'astegmen': { varsayilanFiyat: 100, rol: ROLLER.ASTEGMEN, isim: 'OF-1/A Asteğmen', etiket: 'Asteğmen' },
    'tegmen': { varsayilanFiyat: 200, rol: ROLLER.TEGMEN, isim: 'OF-1/B Teğmen', etiket: 'Teğmen' },
    'ustegmen': { varsayilanFiyat: 350, rol: ROLLER.USTEGMEN, isim: 'OF-1/C Üsteğmen', etiket: 'Üsteğmen' },
    'yuzbasi': { varsayilanFiyat: 500, rol: ROLLER.YUZBASI, isim: 'OF-2 Yüzbaşı', etiket: 'Yüzbaşı' },
    'binbasi': { varsayilanFiyat: 750, rol: ROLLER.BINBASI, isim: 'OF-3 Binbaşı', etiket: 'Binbaşı' },
    'albay': { varsayilanFiyat: 1000, rol: ROLLER.ALBAY, isim: 'OF-4 Albay', etiket: 'Albay' },
    'yarbay': { varsayilanFiyat: 1500, rol: ROLLER.YARBAY, isim: 'OF-5 Yarbay', etiket: 'Yarbay' },
    'tuggeneral': { varsayilanFiyat: 2500, rol: ROLLER.TUGGENERAL, isim: 'OF-6 Tuğgeneral', etiket: 'Tuğgeneral' }
};

const SUBAY_ROLLERI_LISTESI = [
    ROLLER.ASTEGMEN, ROLLER.TEGMEN, ROLLER.USTEGMEN, ROLLER.YUZBASI,
    ROLLER.BINBASI, ROLLER.ALBAY, ROLLER.YARBAY, ROLLER.TUGGENERAL
];

const BRANSLAR = {
    KKK: { id: '1434904371245748297', isim: 'Kara Kuvvetleri' },
    OKK: { id: '1434904099698249768', isim: 'Özel Kuvvetler' },
    ASINZ: { id: '1434904969290584195', isim: 'Askeri İnzibat' },
    SM: { id: '1434904514506260623', isim: 'Sınır Müfettişleri' },
    TSK: { id: '1423304509299494984', isim: 'Türk Silahlı Kuvvetleri' },
    DKK: { id: '1542947720665501696', emoji: '', isim: 'Deniz Kuvvetleri' }
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const commands = [
    new SlashCommandBuilder().setName('verify').setDescription('Hesabınızı bağlamak için web sitesi doğrulama bağlantısını gönderir.'),
    new SlashCommandBuilder().setName('kayıt').setDescription('NATO sunucusuna kayıt olmanızı sağlar.')
        .addStringOption(option => option.setName('mcisim').setDescription('Minecraft Oyuncu Adınız').setRequired(true))
        .addStringOption(option => option.setName('taraf').setDescription('Katılmak istediğiniz taraf').setRequired(true).addChoices({ name: 'Sivil', value: 'sivil' }, { name: 'Asker', value: 'asker' })),
    new SlashCommandBuilder().setName('profil').setDescription('Kendi veya başka bir oyuncunun profilini görüntüler.')
        .addUserOption(option => option.setName('kullanici').setDescription('Profiline bakılacak kullanıcı').setRequired(false)),
    new SlashCommandBuilder().setName('team').setDescription('Profilinizde görünecek aktif branşınızı belirler.'),
    new SlashCommandBuilder().setName('op-ver').setDescription('Bir oyuncuya Onur Puanı ekler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => option.setName('kullanici').setDescription('OP verilecek kullanıcı').setRequired(true))
        .addIntegerOption(option => option.setName('miktar').setDescription('Eklenen OP miktarı').setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`${client.user.tag} olarak başarıyla giriş yapıldı!`);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID_BOT), { body: commands });
        console.log('Slash komutlar başarıyla yüklendi.');
    } catch (error) {
        console.error('Slash komut yükleme hatası:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options, member, guild } = interaction;
        try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch (e) {}

        if (commandName === 'verify') {
            const verifyEmbed = new EmbedBuilder()
                .setTitle('🎖️ NATO Verifly')
                .setDescription(`Minecraft Discord hesap bağlamak için portalı ziyaret edin.\n\nSite üzerinden aldığınız kodu **\`N!doğrula <KOD> <Minecraft_Nick>\`** şeklinde bu kanala yazın.`)
                .setColor(0x2ea043)
                .setFooter({ text: 'NATO Moderasyon ve Güvenlik Sistemi' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Doğrulama Portalı').setStyle(ButtonStyle.Link).setURL(SITE_LINKI)
            );
            return interaction.editReply({ embeds: [verifyEmbed], components: [row] });
        }

        if (commandName === 'kayıt') {
            const mcIsim = options.getString('mcisim');
            const taraf = options.getString('taraf');
            db.set(`user_${member.id}.mcName`, mcIsim);
            db.set(`user_${member.id}.taraf`, taraf);
            let verilecekRol = taraf === 'sivil' ? ROLLER.CIVILIAN : ROLLER.SOLDIER;
            try {
                const targetMember = await guild.members.fetch(member.id).catch(() => null);
                if (targetMember) {
                    await targetMember.setNickname(`${mcIsim}`).catch(() => {});
                    await targetMember.roles.add(verilecekRol).catch(() => {});
                    if (taraf === 'asker') await targetMember.roles.add(ROLLER.ER).catch(() => {});
                }
                return interaction.editReply({ content: `Kayıt başarılı! Adınız **[${taraf.toUpperCase()}] ${mcIsim}** olarak güncellendi.` });
            } catch (err) {
                return interaction.editReply({ content: `Kayıt yapılırken hata oluştu: \`${err.message}\`` });
            }
        }

        if (commandName === 'team') {
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('brans_secim_menu').setPlaceholder('Aktif olarak profilde görünecek branşı seçin...')
                    .addOptions([
                        { label: 'Kara Kuvvetleri', value: 'KKK' },
                        { label: 'Özel Kuvvetler', value: 'OKK' },
                        { label: 'Askeri İnzibat', value: 'ASINZ' },
                        { label: 'Sınır Müfettişleri', value: 'SM' },
                        { label: 'Türk Silahlı Kuvvetleri', value: 'TSK' },
                        { label: 'Deniz Kuvvetleri', value: 'DKK' }
                    ])
            );
            const embed = new EmbedBuilder().setTitle('NATO Askeri Branş / Takım Doğrulama').setDescription('Aşağıdaki menüden profilinize işlenmesini istediğiniz branşı seçin.').setColor(0x0099FF);
            return interaction.editReply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'profil') {
            const targetUser = options.getUser('kullanici') || interaction.user;
            const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
            const mcName = db.get(`user_${targetUser.id}.mcName`) || 'Kayıtsız';
            const taraf = db.get(`user_${targetUser.id}.taraf`) || 'Belirtilmemiş';
            const seciliBransKey = db.get(`user_${targetUser.id}.seciliBrans`);
            const op = db.get(`user_${targetUser.id}.op`) || 0;
            const bransIsmi = seciliBransKey && BRANSLAR[seciliBransKey] ? BRANSLAR[seciliBransKey].isim : 'Branş Seçilmedi';
            const katilimTarihi = targetMember ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:D>` : 'Bilinmiyor';

            const profilEmbed = new EmbedBuilder()
                .setTitle(`NATO Askeri Künye — ${targetUser.username}`).setColor(0x0099FF).setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'Minecraft Kullanıcı Adı', value: String(mcName), inline: true },
                    { name: 'Taraf / Statü', value: String(taraf).toUpperCase(), inline: true },
                    { name: 'Branş / Takım', value: bransIsmi, inline: true },
                    { name: 'Ulusa Katılım Tarihi', value: katilimTarihi, inline: true },
                    { name: 'Onur Puanı (OP)', value: `${op} OP`, inline: true }
                ).setFooter({ text: 'NATO Moderasyon Sistemi' }).setTimestamp();
            return interaction.editReply({ embeds: [profilEmbed] });
        }

        if (commandName === 'op-ver') {
            const targetUser = options.getUser('kullanici');
            const miktar = options.getInteger('miktar');
            db.add(`user_${targetUser.id}.op`, miktar);
            const yeniOp = db.get(`user_${targetUser.id}.op`);
            return interaction.editReply({ content: `${targetUser.tag} kullanıcısına **${miktar} OP** eklendi. Toplam OP: **${yeniOp}**` });
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'brans_secim_menu') {
        try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch (e) {}
        const secilenBransKey = interaction.values[0];
        const hedefBrans = BRANSLAR[secilenBransKey];
        const targetMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!hedefBrans || !targetMember) return;
        if (!targetMember.roles.cache.has(hedefBrans.id)) {
            return interaction.editReply({ content: `⛔ **Erişim Engellendi!** **${hedefBrans.isim}** branşına geçebilmek için o role sahip olmalısınız.` });
        }
        db.set(`user_${interaction.user.id}.seciliBrans`, secilenBransKey);
        return interaction.editReply({ content: `✅ Profil branşınız **${hedefBrans.isim}** olarak güncellendi.` });
    }

    if (interaction.isButton() && interaction.customId.startsWith('rutbe_btn_')) {
        try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch (e) {}
        const secilenRutbeKey = interaction.customId.replace('rutbe_btn_', '');
        const targetMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        const hedef = VARSAYILAN_RUTBELER[secilenRutbeKey];
        if (!hedef || !targetMember) return;
        const guncelFiyat = db.get(`marketFiyat_${secilenRutbeKey}`) || hedef.varsayilanFiyat;
        const userOp = db.get(`user_${interaction.user.id}.op`) || 0;
        if (userOp < guncelFiyat) {
            return interaction.editReply({ content: `Yetersiz OP! **${hedef.isim}** için **${guncelFiyat} OP** gerekiyor. Mevcut: **${userOp} OP**` });
        }
        try {
            for (const rolId of SUBAY_ROLLERI_LISTESI) {
                if (targetMember.roles.cache.has(rolId)) await targetMember.roles.remove(rolId).catch(() => {});
            }
            await targetMember.roles.add(hedef.rol);
            db.set(`user_${interaction.user.id}.op`, userOp - guncelFiyat);
            return interaction.editReply({ content: `Tebrikler! **${guncelFiyat} OP** karşılığında **${hedef.isim}** rütbesine terfi ettiniz!` });
        } catch (err) {
            return interaction.editReply({ content: `Rol verilirken hata oluştu: \`${err.message}\`` });
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.content.startsWith('N!doğrula') || message.content.startsWith('N!dogrula')) {
        const args = message.content.split(' ').slice(1);
        const code = args[0], mcNick = args[1];
        if (!code || !mcNick) return message.reply('⚠️ **Kullanım:** `N!doğrula <KOD> <Minecraft_Nick>`');
        db.set(`user_${message.author.id}.mcName`, mcNick);
        try {
            const member = await message.guild.members.fetch(message.author.id);
            if (member) await member.setNickname(`${mcNick}`).catch(() => {});
        } catch (e) {}
        return message.reply(`✅ Hesap başarıyla **${mcNick}** ile eşleştirildi!`);
    }
});

client.login(TOKEN);
    
