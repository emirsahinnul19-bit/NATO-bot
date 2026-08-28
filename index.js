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

// BRANŞ / TAKIM ROLLERİ (ID'ler eklendi)
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
    console.log(`${client.user.tag} olarak giriş yapıldı!`);
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
            const targetMember = guild.members.cache.get(member.id);

            db.set(`user_${member.id}.mcName`, mcIsim);
            db.set(`user_${member.id}.taraf`, taraf);
            
            let verilecekRol = taraf === 'sivil' ? ROLLER.CIVILIAN : ROLLER.SOLDIER;

            try {
                if (targetMember) {
                    await targetMember.setNickname(`[${taraf.toUpperCase()}] ${mcIsim}`).catch(() => {});
                    await targetMember.roles.add(verilecekRol).catch(() => {});
                    
                    if (taraf === 'asker') {
                        await targetMember.roles.add(ROLLER.ER).catch(() => {});
                    }
                }

                return interaction.editReply({ 
                    content: `Kayıt başarılı! Adınız **[${taraf.toUpperCase()}] ${mcIsim}** olarak güncellendi.`
                });
            } catch (err) {
                return interaction.editReply({ 
                    content: 'Kayıt yapılırken bir yetki hatası oluştu. Botun rolünün en üstte olduğundan emin olun.'
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
            const targetMember = guild.members.cache.get(targetUser.id);
            
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
            const targetMember = interaction.guild.members.cache.get(interaction.user.id);

            if (!hedefBrans) return;

            const roleSahipMi = targetMember.roles.cache.has(hedefBrans.id);

            if (!roleSahipMi) {
                return interaction.editReply({
                    content: `⛔ **Erişim Engellendi!**\n**${hedefBrans.isim}** branşına geçebilmek için Discord sunucumuzda o branşın rolüne sahip olmanız gerekmektedir.`
                });
            }

            db.set(`user_${interaction.user.id}.seciliBrans`, secilenBransKey);

            return interaction.editReply({
                content: `✅ Rolünüz doğrulandı! Profil branşınız **${hedefBrans.isim}** olarak güncellendi.`
            });
        }
    }

    // BUTON İLE TERFİ ALMA İŞLEMİ
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('rutbe_btn_')) {
            try {
                await interaction.deferReply({ ephemeral: true });
            } catch (e) {}

            const secilenRutbeKey = interaction.customId.replace('rutbe_btn_', '');
            const userOp = db.get(`user_${interaction.user.id}.op`) || 0;
            const targetMember = interaction.guild.members.cache.get(interaction.user.id);

            const rutbeFiyatlari = {
                'astegmen': { fiyat: 100, rol: ROLLER.ASTEGMEN, isim: 'OF-1/A Asteğmen' },
                'tegmen': { fiyat: 200, rol: ROLLER.TEGMEN, isim: 'OF-1/B Teğmen' },
                'ustegmen': { fiyat: 350, rol: ROLLER.USTEGMEN, isim: 'OF-1/C Üsteğmen' },
                'yuzbasi': { fiyat: 500, rol: ROLLER.YUZBASI, isim: 'OF-2 Yüzbaşı' },
                'binbasi': { fiyat: 750, rol: ROLLER.BINBASI, isim: 'OF-3 Binbaşı' },
                'albay': { fiyat: 1000, rol: ROLLER.ALBAY, isim: 'OF-4 Albay' },
                'yarbay': { fiyat: 1500, rol: ROLLER.YARBAY, isim: 'OF-5 Yarbay' },
                'tuggeneral': { fiyat: 2500, rol: ROLLER.TUGGENERAL, isim: 'OF-6 Tuğgeneral' }
            };

            const hedef = rutbeFiyatlari[secilenRutbeKey];

            if (!hedef) return;

            if (userOp < hedef.fiyat) {
                return interaction.editReply({ 
                    content: `Yetersiz OP! **${hedef.isim}** rütbesi için **${hedef.fiyat} OP** gerekiyor. Mevcut OP: **${userOp}**`
                });
            }

            try {
                db.sub(`user_${interaction.user.id}.op`, hedef.fiyat);
                if (targetMember) {
                    await targetMember.roles.add(hedef.rol);
                }

                return interaction.editReply({ 
                    content: `Tebrikler! **${hedef.fiyat} OP** karşılığında **${hedef.isim}** rütbesine terfi ettiniz!`
                });
            } catch (err) {
                return interaction.editReply({ 
                    content: 'Rol verilirken yetki hatası oluştu. Botun rolünün sıralamada en üstte olduğundan emin olun.'
                });
            }
        }
    }
});

// N!MARKET BUTONLU PANELİ
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === 'N!market') {
        const marketEmbed = new EmbedBuilder()
            .setTitle('NATO Subay & Terfi Marketi')
            .setDescription('Biriktirdiğiniz Onur Puanları (OP) ile subay rütbelerine terfi etmek için aşağıdaki butonlara tıklayabilirsiniz.')
            .setColor(0x00FF00);

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rutbe_btn_astegmen').setLabel('Asteğmen (100 OP)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rutbe_btn_tegmen').setLabel('Teğmen (200 OP)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rutbe_btn_ustegmen').setLabel('Üsteğmen (350 OP)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rutbe_btn_yuzbasi').setLabel('Yüzbaşı (500 OP)').setStyle(ButtonStyle.Primary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rutbe_btn_binbasi').setLabel('Binbaşı (750 OP)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rutbe_btn_albay').setLabel('Albay (1000 OP)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('rutbe_btn_yarbay').setLabel('Yarbay (1500 OP)').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('rutbe_btn_tuggeneral').setLabel('Tuğgeneral (2500 OP)').setStyle(ButtonStyle.Success)
        );

        await message.channel.send({ embeds: [marketEmbed], components: [row1, row2] });
    }
});

client.login(TOKEN);
            
