const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: path.join(__dirname, '..', '.wwebjs_auth')
    })
});

client.on('ready', async () => {
    console.log('Client is ready!');

    const chats = await client.getChats();
    const groupChats = chats.filter(chat => chat.isGroup);
    const groupNames = groupChats.map(chat => chat.name);
    const groupChatIDs = groupChats.map(chat => chat.id._serialized);
    for (let i = 0; i < groupNames.length; i++) {
        console.log(`Group ${groupNames[i]} with ID ${groupChatIDs[i]}`);
    }
});

client.initialize();