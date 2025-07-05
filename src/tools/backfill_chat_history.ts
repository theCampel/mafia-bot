import 'module-alias/register';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import path from 'path';
import config from '@/config';
import { DatabaseService } from '@/services/DatabaseService';
import { DatabaseProcessor } from '@/processing/processors/DatabaseProcessor';

// --- Configuration ---
// This script will fetch all messages from the first chat defined in your config.
const targetChat = config.TARGET_CHATS[0];
const MESSAGE_LIMIT = 999999; // Fetch all messages
const CONCURRENCY_LIMIT = 50;  // How many messages to process in parallel
// ---------------------

if (!targetChat) {
  console.error('No target chats found in your config. Please check src/config.ts');
  process.exit(1);
}

console.log(`--- Starting Full History Backfill ---`);
console.log(`Target Chat: ${targetChat.name} (${targetChat.id})`);
console.log(`Database Table: ${config.MESSAGES_TABLE_NAME}`);
console.log(`--------------------------------------`);

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.join(__dirname, '..', '..', '.wwebjs_auth_backfill')
  })
});

client.on('qr', (qr: string) => {
  console.log('QR code received - scan with your phone:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  console.log('✅ WhatsApp client is ready!');
  
  // Initialize Database
  const dbService = new DatabaseService({ connectionString: config.DATABASE_URL });
  const dbProcessor = new DatabaseProcessor(dbService);
  console.log('✅ Database service initialized.');

  console.log(`Fetching up to ${MESSAGE_LIMIT} messages...`);

  try {
    const chat = await client.getChatById(targetChat.id);
    const messages = await chat.fetchMessages({ limit: MESSAGE_LIMIT });

    console.log(`\n--- Found ${messages.length} total messages in chat history ---`);
    console.log(`--- Saving messages to the database with a concurrency of ${CONCURRENCY_LIMIT}. This may take a while... ---`);
    
    // Reverse messages to save them oldest-to-newest
    const reversedMessages = messages.reverse();
    let promises = [];
    let totalProcessed = 0;

    for (const msg of reversedMessages) {
      // Add the processing promise to our chunk
      promises.push(dbProcessor.process(msg));

      // When the chunk is full, execute all promises in it concurrently
      if (promises.length >= CONCURRENCY_LIMIT) {
        await Promise.all(promises);
        totalProcessed += promises.length;
        process.stdout.write(`Progress: ${totalProcessed} / ${messages.length}\r`);
        promises = []; // Reset for the next chunk
      }
    }

    // Process any remaining messages in the final, smaller chunk
    if (promises.length > 0) {
      await Promise.all(promises);
      totalProcessed += promises.length;
      process.stdout.write(`Progress: ${totalProcessed} / ${messages.length}\r`);
    }

    console.log(`\n\n--- ✅ Backfill complete! ---`);
    console.log(`--- Saved ${totalProcessed} messages to the '${config.MESSAGES_TABLE_NAME}' table. ---`);

  } catch (error) {
    console.error('\nAn error occurred during the backfill process:', error);
  } finally {
    console.log('\nShutting down...');
    await dbService.close();
    await client.destroy();
    process.exit(0);
  }
});

client.on('auth_failure', (msg) => {
    console.error('AUTHENTICATION FAILURE', msg);
    process.exit(1);
});

console.log('Initializing client...');
client.initialize().catch(err => {
  console.error('Failed to initialize client:', err);
  process.exit(1);
}); 