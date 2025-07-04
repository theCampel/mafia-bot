import { Client, LocalAuth, Chat, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import * as createCsvWriter from 'csv-writer';
import fs from 'fs';
import path from 'path';
import config from '../config';
import { CSVMessageRecord, RawWhatsAppMessage, MessageType } from '../types';

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.join(__dirname, '..', '.wwebjs_auth')
  })
});

// Dynamically set CSV filename
const csvFilename = `wa_messages_export_${config.APP_ENV}.csv`;
const csvPath = path.join(__dirname, csvFilename);

const csvWriter = createCsvWriter.createObjectCsvWriter({
  path: csvPath,
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

function parseMessage(message: Message): CSVMessageRecord {
  const rawMessage = message as unknown as RawWhatsAppMessage;
  
  return {
    id: rawMessage.id._serialized,
    chat_id: rawMessage.from,
    sender_id: rawMessage.author || rawMessage.from,
    message_text: rawMessage.body || rawMessage.caption || '',
    message_type: rawMessage.type as MessageType,
    timestamp: new Date(rawMessage.timestamp * 1000).toISOString(),
    quoted_message_id: rawMessage._data?.contextInfo?.quotedMessageStanzaId || null,
    has_media: rawMessage.hasMedia || rawMessage.type !== 'chat'
  };
}

client.on('qr', (qr: string) => {
  console.log('QR code received - scan with your phone:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async (): Promise<void> => {
  console.log('Client started');
  console.log(`Exporting messages from ${config.TARGET_CHATS.length} chats in ${config.APP_ENV} mode`);
  console.log(`Output file: ${csvPath}\n`);

  let allMessages: CSVMessageRecord[] = [];
  let totalMessages = 0;

  for (const [index, chatInfo] of config.TARGET_CHATS.entries()) {
    try {
      console.log(`[${index + 1}/${config.TARGET_CHATS.length}] Processing: ${chatInfo.name}`);
      
      const chat: Chat = await client.getChatById(chatInfo.id);
      console.log(`   Fetching messages...`);
      
      const messages: Message[] = await chat.fetchMessages({ limit: 999999 });
      console.log(`   ✅ Fetched ${messages.length} messages`);

      const parsedMessages = messages.map(parseMessage);
      allMessages.push(...parsedMessages);
      totalMessages += messages.length;

      console.log(`   📊 Total messages so far: ${totalMessages}\n`);

    } catch (error) {
      console.error(`   ❌ Error fetching messages for ${chatInfo.name}:`);
      console.error(`   ${error}\n`);
    }
  }

  console.log(`📝 Writing ${allMessages.length} messages to CSV...`);
  
  try {
    await csvWriter.writeRecords(allMessages);
    console.log(`✅ CSV file written successfully: ${csvPath}`);
    
    // File size info
    const stats = fs.statSync(csvPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 File size: ${fileSizeInMB} MB`);
    
  } catch (error) {
    console.error('❌ Error writing CSV file:', error);
  } finally {
    await client.destroy();
    process.exit(0);
  }
});

client.on('auth_failure', (message: string) => {
  console.error('Authentication failed:', message);
  process.exit(1);
});

client.initialize().catch((error: Error) => {
  console.error('Failed to initialize WhatsApp client:', error);
  process.exit(1);
}); 