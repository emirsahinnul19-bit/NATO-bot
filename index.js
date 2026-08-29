// UPTIMEROBOT & RENDER PORT UYUMU İÇİN EKLENEN WEB SUNUCUSU
const express = require('express');
const app = express();

const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('NATO Moderasyon Botu 7/24 Aktif!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web sunucusu ${PORT} portunda başarıyla başlatıldı.`);
});

// DISCORD BOT KODLARI
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
    PermissionFlagsBits 
} = require('discord.js');
const db = require('croxydb');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1539374890405204070';

// STATÜ VE RÜTBE ROLLERİ
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

// VARSAYILAN MARKET FİYATLARI VE RÜTBE BİLGİLERİ
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

// DİĞER RÜTBELERİ TEMİZLEMEK İÇİN Sadece SUBAY RÜTBE ID LİSTESİ
const SUBAY_ROLLERI_LISTESI = [
    ROLLER.ASTEGMEN,
    ROLLER.TEGMEN,
    ROLLER.USTEGMEN,
    ROLLER.YUZBASI,
    ROLLER.BINBASI,
    ROLLER.ALBAY,
    ROLLER.YARBAY,
    ROLLER.TUGGENERAL
];

// BRANŞ / TAKIM ROLLERİ
const BRANSLAR = {
    KKK: { id: '1434904371245748297', isim: 'Kara Kuvvetleri' },
    OKK: { id: '1434904099698249768', isim: 'Özel Kuvvetler' },
    ASINZ: { id: '1434904969290584195', isim: 'Askeri İnzibat' },
    SM: { id: '1434904514506260623', isim: 'Sınır Müfettişleri' },
    TSK: { id: '1423304509299494984', isim: 'Türk Silahlı Kuvvetleri' },
    DKK: { id: '1542947720665501696', isim: 'Deniz Kuvvetleri' }
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
    new SlashCommandBuilder()
        .setName('kayıt')
        .setDescription('NATO sunucusuna kayıt olmanızı sağlar.')
        .addStringOption(option => 
            option.setName('mcisim')
                .setDescription('Minecraft Oyuncu Adınız')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('taraf')
                .setDescription('Katılmak istediğiniz taraf')
                .setRequired(true)
                .addChoices(
                    { name: 'Sivil', value: 'sivil' },
                    { name: 'Asker', value: 'asker' }
                )),

    new SlashCommandBuilder()
        .setName('profil')
        .setDescription('Kendi veya başka bir oyuncunun profilini görüntüler.')
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('Profiline bakılacak kullanıcı')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('team')
        .setDescription('Profilinizde görünecek aktif branşınızı belirler.'),

    new SlashCommandBuilder()
        .setName('op-ver')
        .setDescription('Bir oyuncuya Onur Puanı ekler.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => 
            option.setName('kullanici')
                .setDescription('OP verilecek kullanıcı')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('miktar')
                .setDescription('Eklenen OP miktarı')
                .setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`${client.user.tag} olarak başarıyla giriş yapıldı!`);
    try {
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('Slash komutlar başarıyla yüklendi.');
    } catch (error) {
        console.error('Slash komut yükleme hatası:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options, member, guild } = interaction;

        try {
            await interaction.deferReply({ ephemeral: true });
        } catch (e) {}

        if (commandName === 'kayıt') {
            const mcIsim = options.getString('mcisim');
            const taraf = options.getString('taraf');
            
            db.set(`user_${member.id}.mcName`, mcIsim);
            db.set(`user_${member.id}.taraf`, taraf);
            
            let verilecekRol = taraf === 'sivil' ? ROLLER.CIVILIAN : ROLLER.SOLDIER;

            try {
                const targetMember = await guild.members.fetch(member.id).catch(() => null);
                if (targetMember) {
                    await targetMember.setNickname(`${mcIsim}`).catch(() => {}) 
                    await targetMember.roles.add(verilecekRol).catch(() => {});
                    
                    if (taraf === 'asker') {
                        await targetMember.roles.add(ROLLER.ER).catch(() => {});
                    }
                }

                return interaction.editReply({ 
                    content: `Kayıt başarılı! Adınız **[${taraf.toUpperCase()}] ${mcIsim}** olarak güncellendi.`
                });
            } catch (err) {
                console.error("Kayıt Hatası:", err);
                return interaction.editReply({ 
                    content: `Kayıt yapılırken hata oluştu: \`${err.message}\``
                });
            }
        }

        if (commandName === 'team') {
            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('brans_secim_menu')
                        .setPlaceholder('Aktif olarak profilde görünecek branşı seçin...')
                        .addOptions([
                            { label: 'Kara Kuvvetleri', value: 'KKK' },
                            { label: 'Özel Kuvvetler', value: 'OKK' },
                            { label: 'Askeri İnzibat', value: 'ASINZ' },
                            { label: 'Sınır Müfettişleri', value: 'SM' },
                            { label: 'Türk Silahlı Kuvvetleri', value: 'TSK' },
                            { label: 'Deniz Kuvvetleri', value: 'DKK' }
                        ])
                );

            const embed = new EmbedBuilder()
                .setTitle('NATO Askeri Branş / Takım Doğrulama')
                .setDescription('Aşağıdaki menüden profilinize işlenmesini istediğiniz branşı seçin.\n*(Sadece Discord üzerinde rolüne sahip olduğunuz branşları seçebilirsiniz!)*')
                .setColor(0x0099FF);

            return interaction.editReply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'profil') {
            const targetUser = options.getUser('kullanici') || interaction.user;
            const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
            
            const mcName = db.get(`user_${targetUser.id}.mcName`) || 'Kayıtsız';
            const taraf = db.get(`user_${targetUser.id}.taraf`) || 'Belirtilmemiş';
            const seciliBransKey = db.get(`user_${targetUser.id}.seciliBrans`);
            const op = db.get(`user_${targetUser.id}.op`) || 0;

            const bransIsmi = seciliBransKey && BRANSLAR[seciliBransKey] 
                ? BRANSLAR[seciliBransKey].isim 
                : 'Branş Seçilmedi';

            const katilimTarihi = targetMember 
                ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:D>` 
                : 'Bilinmiyor';

            const profilEmbed = new EmbedBuilder()
                .setTitle(`NATO Askeri Künye — ${targetUser.username}`)
                .setColor(0x0099FF)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'Minecraft Kullanıcı Adı', value: String(mcName), inline: true },
                    { name: 'Taraf / Statü', value: String(taraf).toUpperCase(), inline: true },
                    { name: 'Branş / Takım', value: bransIsmi, inline: true },
                    { name: 'Ulusa Katılım Tarihi', value: katilimTarihi, inline: true },
                    { name: 'Onur Puanı (OP)', value: `${op} OP`, inline: true }
                )
                .setFooter({ text: 'NATO Moderasyon Sistemi' })
                .setTimestamp();

            return interaction.editReply({ embeds: [profilEmbed] });
        }

        if (commandName === 'op-ver') {
            const targetUser = options.getUser('kullanici');
            const miktar = options.getInteger('miktar');

            db.add(`user_${targetUser.id}.op`, miktar);
            const yeniOp = db.get(`user_${targetUser.id}.op`);

            return interaction.editReply({ 
                content: `${targetUser.tag} kullanıcısına **${miktar} OP** eklendi. Toplam OP: **${yeniOp}**`
            });
        }
    }

    if (interaction.isStringSelectMenu()) {
        try {
            await interaction.deferReply({ ephemeral: true });
        } catch (e) {}

        if (interaction.customId === 'brans_secim_menu') {
            const secilenBransKey = interaction.values[0];
            const hedefBrans = BRANSLAR[secilenBransKey];
            const targetMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

            if (!hedefBrans || !targetMember) return;

            const roleSahipMi = targetMember.roles.cache.has(hedefBrans.id);

            if (!roleSahipMi) {
                return interaction.editReply({
                    content: `⛔ **Erişim Engellendi!**\n**${hedefBrans.isim}** branşına geçebilmek için Discord sunucumuzda o branşın rolüne sahip olmanız gerekmektedir.`
                });
            }

            db.set(`user_${interaction.user.id}.seciliBrans`, secilenBransKey);

            return interaction.editReply({
                content: `✅ Profil branşınız **${hedefBrans.isim}** olarak güncellendi.`
            });
        }
    }

    // BUTON İLE TERFİ ALMA İŞLEMİ VE ESKİ RÜTBELERİ TEMİZLEME
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('rutbe_btn_')) {
            try {
                await interaction.deferReply({ ephemeral: true });
            } catch (e) {}

            const secilenRutbeKey = interaction.customId.replace('rutbe_btn_', '');
            const targetMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            const hedef = VARSAYILAN_RUTBELER[secilenRutbeKey];

            if (!hedef || !targetMember) return;

            // Güncel fiyatı veritabanından çek (Ayarlanmadıysa varsayılanı kullan)
            const guncelFiyat = db.get(`marketFiyat_${secilenRutbeKey}`) || hedef.varsayilanFiyat;
            const userOp = db.get(`user_${interaction.user.id}.op`) || 0;

            if (userOp < guncelFiyat) {
                return interaction.editReply({ 
                    content: `Yetersiz OP! **${hedef.isim}** rütbesi için **${guncelFiyat} OP** gerekiyor. Mevcut OP: **${userOp}**`
                });
            }

            try {
                // 1. Kullanıcının üstündeki diğer tüm subay rütbelerini kaldır
                for (const rolId of SUBAY_ROLLERI_LISTESI) {
                    if (targetMember.roles.cache.has(rolId)) {
                        await targetMember.roles.remove(rolId).catch(() => {});
                    }
                }

                // 2. Yeni rütbeyi ver ve OP düş
                await targetMember.roles.add(hedef.rol);
                db.set(`user_${interaction.user.id}.op`, userOp - guncelFiyat);

                return interaction.editReply({ 
                    content: `Tebrikler! **${guncelFiyat} OP** karşılığında **${hedef.isim}** rütbesine terfi ettiniz! (Eski rütbeleriniz temizlendi)`
                });
            } catch (err) {
                console.error("Market Terfi Hatası Detayı:", err);
                return interaction.editReply({ 
                    content: `Rol verilirken teknik bir hata oluştu: \`${err.message}\``
                });
            }
        }
    }
});

// MESSAGECREATE (N!market VE N!marketayar KOMUTLARI)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // FİYAT AYARLAMA KOMUTU: N!marketayar <rütbe> <yeni_fiyat>
    if (message.content.startsWith('N!marketayar')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Bu komutu sadece Yöneticiler kullanabilir!');
        }

        const args = message.content.split(' ').slice(1);
        if (args.length < 2) {
            return message.reply('⚠️ **Kullanım:** `N!marketayar <rütbe_adı> <fiyat>`\n**Örnek:** `N!marketayar asteğmen 150`\n\n**Geçerli Rütbeler:** `asteğmen`, `teğmen`, `üsteğmen`, `yüzbaşı`, `binbaşı`, `albay`, `yarbay`, `tuğgeneral`');
        }

        const inputRutbe = args[0].toLowerCase()
            .replace('ğ', 'g')
            .replace('ş', 's')
            .replace('ı', 'i')
            .replace('ü', 'u');
            
        const yeniFiyat = parseInt(args[1]);

        if (isNaN(yeniFiyat) || yeniFiyat < 0) {
            return message.reply('❌ Lütfen geçerli bir sayısal fiyat girin!');
        }

        if (!VARSAYILAN_RUTBELER[inputRutbe]) {
            return message.reply('❌ Geçersiz rütbe adı! Geçerli rütbeler: `asteğmen`, `teğmen`, `üsteğmen`, `yüzbaşı`, `binbaşı`, `albay`, `yarbay`, `tuğgeneral`');
        }

        // Veritabanına kaydet
        db.set(`marketFiyat_${inputRutbe}`, yeniFiyat);

        return message.reply(`✅ **${VARSAYILAN_RUTBELER[inputRutbe].isim}** rütbesinin yeni fiyatı **${yeniFiyat} OP** olarak güncellendi!`);
    }

    // N!MARKET BUTONLU PANELİ
    if (message.content.trim() === 'N!market') {
        const getFiyat = (key) => db.get(`marketFiyat_${key}`) || VARSAYILAN_RUTBELER[key].varsayilanFiyat;

        const marketEmbed = new EmbedBuilder()
            .setTitle('NATO Subay & Terfi Marketi')
            .setDescription('Biriktirdiğiniz Onur Puanları (OP) ile subay rütbelerine terfi etmek için aşağıdaki butonlara tıklayabilirsiniz.')
            .setColor(0x00FF00);

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rutbe_btn_astegmen').setLabel(`Asteğmen (${getFiyat('astegmen')} OP)`).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rutbe_btn_tegmen').setLabel(`Teğmen (${getFiyat('tegmen')} OP)`).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rutbe_btn_ustegmen').setLabel(`Üsteğmen (${getFiyat('ustegmen')} OP)`).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rutbe_btn_yuzbasi').setLabel(`Yüzbaşı (${getFiyat('yuzbasi')} OP)`).setStyle(ButtonStyle.Primary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rutbe_btn_binbasi').setLabel(`Binbaşı (${getFiyat('binbasi')} OP)`).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rutbe_btn_albay').setLabel(`Albay (${getFiyat('albay')} OP)`).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rutbe_btn_yarbay').setLabel(`Yarbay (${getFiyat('yarbay')} OP)`).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('rutbe_btn_tuggeneral').setLabel(`Tuğgeneral (${getFiyat('tuggeneral')} OP)`).setStyle(ButtonStyle.Success)
        );

        await message.channel.send({ embeds: [marketEmbed], components: [row1, row2] });
    }
});

client.login(TOKEN);
            
