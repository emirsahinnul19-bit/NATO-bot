const { 
    Client, 
    GatewayIntentBits, 
    SlashCommandBuilder, 
    REST, 
    Routes, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    PermissionFlagsBits 
} = require('discord.js');
const db = require('croxydb');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1539374890405204070';

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

        if (commandName === 'kayıt') {
            await interaction.deferReply({ ephemeral: true });
            const mcIsim = options.getString('mcisim');
            const taraf = options.getString('taraf');
            const targetMember = guild.members.cache.get(member.id);

            db.set(`user_${member.id}.mcName`, mcIsim);
            db.set(`user_${member.id}.taraf`, taraf);
            
            let verilecekRol = taraf === 'sivil' ? ROLLER.CIVILIAN : ROLLER.SOLDIER;

            try {
                await targetMember.setNickname(`[${taraf.toUpperCase()}] ${mcIsim}`);
                await targetMember.roles.add(verilecekRol);
                
                if (taraf === 'asker') {
                    await targetMember.roles.add(ROLLER.ER);
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

        if (commandName === 'profil') {
            await interaction.deferReply({ ephemeral: true });
            const targetUser = options.getUser('kullanici') || interaction.user;
            
            const mcName = db.get(`user_${targetUser.id}.mcName`) || 'Kayıtsız';
            const taraf = db.get(`user_${targetUser.id}.taraf`) || 'Belirtilmemiş';
            const op = db.get(`user_${targetUser.id}.op`) || 0;

            const profilEmbed = new EmbedBuilder()
                .setTitle(`NATO Askeri Künye — ${targetUser.username}`)
                .setColor(0x0099FF)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'Minecraft Kullanıcı Adı', value: mcName, inline: true },
                    { name: 'Taraf / Statü', value: taraf.toUpperCase(), inline: true },
                    { name: 'Onur Puanı (OP)', value: `${op} OP`, inline: false }
                )
                .setFooter({ text: 'NATO Moderasyon Sistemi' })
                .setTimestamp();

            return interaction.editReply({ embeds: [profilEmbed] });
        }

        if (commandName === 'op-ver') {
            await interaction.deferReply({ ephemeral: true });
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
        if (interaction.customId === 'market_rutbe_sec') {
            await interaction.deferReply({ ephemeral: true });
            const secilenRutbe = interaction.values[0];
            const userOp = db.get(`user_${interaction.user.id}.op`) || 0;
            const targetMember = interaction.guild.members.cache.get(interaction.user.id);

            const rutbeFiyatlari = {
                'rutbe_astegmen': { fiyat: 100, rol: ROLLER.ASTEGMEN, isim: 'OF-1/A Asteğmen' },
                'rutbe_tegmen': { fiyat: 200, rol: ROLLER.TEGMEN, isim: 'OF-1/B Teğmen' },
                'rutbe_ustegmen': { fiyat: 350, rol: ROLLER.USTEGMEN, isim: 'OF-1/C Üsteğmen' },
                'rutbe_yuzbasi': { fiyat: 500, rol: ROLLER.YUZBASI, isim: 'OF-2 Yüzbaşı' },
                'rutbe_binbasi': { fiyat: 750, rol: ROLLER.BINBASI, isim: 'OF-3 Binbaşı' },
                'rutbe_albay': { fiyat: 1000, rol: ROLLER.ALBAY, isim: 'OF-4 Albay' },
                'rutbe_yarbay': { fiyat: 1500, rol: ROLLER.YARBAY, isim: 'OF-5 Yarbay' },
                'rutbe_tuggeneral': { fiyat: 2500, rol: ROLLER.TUGGENERAL, isim: 'OF-6 Tuğgeneral' }
            };

            const hedef = rutbeFiyatlari[secilenRutbe];

            if (!hedef) return;

            if (userOp < hedef.fiyat) {
                return interaction.editReply({ 
                    content: `Yetersiz OP! **${hedef.isim}** rütbesi için **${hedef.fiyat} OP** gerekiyor. Mevcut OP: **${userOp}**`
                });
            }

            db.sub(`user_${interaction.user.id}.op`, hedef.fiyat);
            await targetMember.roles.add(hedef.rol);

            return interaction.editReply({ 
                content: `Tebrikler! **${hedef.fiyat} OP** karşılığında **${hedef.isim}** rütbesine terfi ettiniz!`
            });
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === 'N!market') {
        const marketEmbed = new EmbedBuilder()
            .setTitle('NATO Subay & Terfi Marketi')
            .setDescription('Aşağıdaki menüden biriktirdiğiniz Onur Puanları (OP) ile subay rütbelerine terfi edebilirsiniz.')
            .setColor(0x00FF00);

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('market_rutbe_sec')
                    .setPlaceholder('Terfi etmek istediğiniz rütbeyi seçin...')
                    .addOptions([
                        { label: 'OF-1/A Asteğmen', description: 'Fiyat: 100 OP', value: 'rutbe_astegmen' },
                        { label: 'OF-1/B Teğmen', description: 'Fiyat: 200 OP', value: 'rutbe_tegmen' },
                        { label: 'OF-1/C Üsteğmen', description: 'Fiyat: 350 OP', value: 'rutbe_ustegmen' },
                        { label: 'OF-2 Yüzbaşı', description: 'Fiyat: 500 OP', value: 'rutbe_yuzbasi' },
                        { label: 'OF-3 Binbaşı', description: 'Fiyat: 750 OP', value: 'rutbe_binbasi' },
                        { label: 'OF-4 Albay', description: 'Fiyat: 1000 OP', value: 'rutbe_albay' },
                        { label: 'OF-5 Yarbay', description: 'Fiyat: 1500 OP', value: 'rutbe_yarbay' },
                        { label: 'OF-6 Tuğgeneral', description: 'Fiyat: 2500 OP', value: 'rutbe_tuggeneral' }
                    ])
            );

        await message.channel.send({ embeds: [marketEmbed], components: [row] });
    }
});

client.login(TOKEN);
                        
