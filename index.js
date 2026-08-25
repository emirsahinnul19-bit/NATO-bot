const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

// Render'ın uyumamasını ve UptimeRobot'un ping atmasını sağlayan web sunucusu
app.get('/', (req, res) => {
    res.send('NATO Bot 7/24 Aktif!');
});

app.listen(port, () => {
    console.log(`Web sunucusu ${port} portunda başlatıldı.`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`[NATO BOT] ${client.user.tag} olarak başarıyla giriş yapıldı!`);
});

// Profil Komutu ve Mesaj Mantığı
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.toLowerCase() === '!profil' || message.content.toLowerCase() === '/profil') {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`🎖️ ${message.author.username} - Askeri Profil`)
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
                { name: '👤 Kullanıcı', value: `${message.author}`, inline: true },
                { name: '🛡️ Ulus / Birlik', value: 'NATO / Yıldırım Orduları', inline: true },
                { name: '📜 Durum', value: 'Aktif Görevde', inline: false }
            )
            .setFooter({ text: 'NATO Askeri Yönetim Sistemi' })
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }
});

client.login(process.env.TOKEN);
