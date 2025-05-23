const {Client, LocalAuth} = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs')
const path = require('path');
const { TARGET_CHATS, APP_ENV } = require('../config'); // Import from config

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: path.join(__dirname, '..', '.wwebjs_auth')
    })
});

// Dynamically set CSV filename
const csvFilename = `wa_messages_export_${APP_ENV}.csv`;
const csv_writer = createCsvWriter({
    path: path.join(__dirname, csvFilename),
    header: [
        { id: 'id', title: 'id' },
        { id: 'chat_id', title: 'chat_id' },
        { id: 'sender_id', title: 'sender_id' },
        { id: 'message_text', title: 'message_text' },
        { id: 'message_type', title: 'message_type' },
        { id: 'timestamp', title: 'timestamp' },
        { id: 'quoted_message_id', title: 'quoted_message_id' },
        { id: 'has_media', title: 'has_media' }
    ]
});

client.on('ready', async () => {
    console.log('Client started')
    
    let allMessages = [];

    for(const chatInfo of TARGET_CHATS){
        try{
            const chat = await client.getChatById(chatInfo.id);
            const messages = await chat.fetchMessages({limit: 999999});

            console.log(`Fetched ${messages.length} messages from ${chat.name}`);

            const parsed = messages.map(message => ({
                id: message.id._serialized,
                chat_id: message.from,
                sender_id: message.author || message.from,
                message_text: message.body || message.caption || '',
                message_type: message.type,
                timestamp: new Date(message.timestamp * 1000).toISOString(),
                quoted_message_id: message._data?.contextInfo?.quotedMessageStanzaId || null,
                has_media: message.hasMedia || message.type !== 'chat'
            }));

            allMessages.push(...parsed);
    } catch (error) {
            console.error(`Error fetching messages for ${chatInfo.name}`)
            console.error(error);
        }
    }

    //console.log(allMessages); // There's a lot lol.
    try{
        await csv_writer.writeRecords(allMessages);
        console.log('CSV file written successfully');
    } catch (error) {
        console.error('Error writing CSV file:', error);
    }
});

client.initialize();