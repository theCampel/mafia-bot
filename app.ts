import { Client, LocalAuth, Chat } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import config from './config';
import { ChatInfo, AppError } from './types';

const client = new Client({
  authStrategy: new LocalAuth()
});

client.on('qr', (qr: string) => {
  // Generate and scan this code with your phone
  console.log('QR code received - scan with your phone:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async (): Promise<void> => {
  console.log('Client is ready!');
  console.log(`Running in ${config.APP_ENV} mode.`);
  console.log('Targeting chats:', config.TARGET_CHATS.map(c => c.name).join(', '));

  // Validate all target chats are accessible
  await validateTargetChats();
});

client.on('message', (msg) => {
  if (msg.body === '!ping') {
    msg.reply('pong');
  }
});

async function validateTargetChats(): Promise<void> {
  const results = await Promise.allSettled(
    config.TARGET_CHATS.map(async (chatInfo: ChatInfo) => {
      try {
        const chat: Chat = await client.getChatById(chatInfo.id);
        if (chat) {
          console.log(`✅ Found chat: ${chat.name} (ID: ${chatInfo.id})`);
          return { success: true, chatInfo, chat };
        } else {
          console.log(`❌ Chat not found: ${chatInfo.name} (ID: ${chatInfo.id})`);
          return { success: false, chatInfo, error: 'Chat not found' };
        }
      } catch (error) {
        const appError: AppError = error as AppError;
        console.error(`❌ Error fetching chat ${chatInfo.name}:`, appError.message);
        return { success: false, chatInfo, error: appError.message };
      }
    })
  );

  const successful = results.filter(result => 
    result.status === 'fulfilled' && result.value.success
  ).length;

  const failed = results.length - successful;

  console.log(`\n📊 Chat validation complete:`);
  console.log(`✅ Successful: ${successful}/${results.length}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}/${results.length}`);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Shutting down gracefully...');
  await client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Received SIGTERM, shutting down gracefully...');
  await client.destroy();
  process.exit(0);
});

// Initialize the client
client.initialize().catch((error: Error) => {
  console.error('Failed to initialize WhatsApp client:', error);
  process.exit(1);
}); 