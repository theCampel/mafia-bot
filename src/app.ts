import 'module-alias/register';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { MessageRouter } from '@/processing/MessageRouter';
import { DatabaseProcessor } from '@/processing/processors/DatabaseProcessor';
import { LumaProcessor } from '@/processing/processors/LumaProcessor';
import { MentionProcessor } from '@/processing/processors/MentionProcessor';
import { DatabaseService } from '@/services/DatabaseService';
import config from '@/config';
import { SyncService } from './services/SyncService';

// Create a Set for efficient lookup of target chat IDs
const targetChatIdSet = new Set(config.TARGET_CHATS.map(c => c.id));

// 1. Initialize Services
const databaseService = new DatabaseService({
  connectionString: config.DATABASE_URL,
});

// 2. Initialize Processors
const databaseProcessor = new DatabaseProcessor(databaseService);
const lumaProcessor = new LumaProcessor();
const mentionProcessor = new MentionProcessor();

// 3. Initialize Message Router with all processors
const messageRouter = new MessageRouter([
  databaseProcessor,
  lumaProcessor,
  mentionProcessor,
]);

// 4. Initialize WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth(),
});

// +++ Initialize SyncService
const syncService = new SyncService(client, databaseService, databaseProcessor, config);

client.on('qr', (qr: string) => {
  // Generate and scan this code with your phone
  console.log('QR code received - scan with your phone:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ WhatsApp client is ready!');
  console.log(`Running in ${config.APP_ENV} mode.`);
  
  // Start the sync process
  syncService.syncAllChats().catch(error => {
    console.error('An error occurred during the initial message sync:', error);
  });
});

// 5. Route incoming messages
client.on('message', (message) => {
  // Only process messages from target chats
  if (!targetChatIdSet.has(message.from)) {
    return;
  }

  messageRouter.handle(message).catch((error: Error) => {
    console.error('Error handling message:', error);
  });
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🔄 Shutting down gracefully...');
  await client.destroy();
  await databaseService.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the client
client.initialize().catch((error) => {
  console.error('Failed to initialize WhatsApp client:', error);
  process.exit(1);
}); 