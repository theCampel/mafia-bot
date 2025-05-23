const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('./config'); // Import the configuration

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
    // console.log('QR RECEIVED', qr);
    qrcode.generate(qr, {small: true});
});

client.on('ready', async () => {
    console.log('Client is ready!');
    console.log(`Running in ${config.APP_ENV} mode.`);
    console.log('Targeting chats:', config.TARGET_CHATS.map(c => c.name).join(', '));

    // Simple isAlive check
    for (const chatInfo of config.TARGET_CHATS) {
        try {
            const chat = await client.getChatById(chatInfo.id);
            if (chat) {
                console.log(`Found chat: ${chat.name} (ID: ${chatInfo.id})`);
                // const messages = await chat.fetchMessages({ limit: 10 }); // Fetch a few messages
                // console.log(`Fetched ${messages.length} messages from ${chat.name}`);
            } else {
                console.log(`Chat not found: ${chatInfo.name} (ID: ${chatInfo.id})`);
            }
        } catch (error) {
            console.error(`Error fetching chat ${chatInfo.name}:`, error);
        }
    }

});

client.on('message', msg => {
    if (msg.body == '!ping') {
        msg.reply('pong');
    }
});

client.initialize();