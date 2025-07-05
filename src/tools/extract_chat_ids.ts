import { Client, LocalAuth, Chat } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import path from 'path';

interface GroupChatInfo {
  name: string;
  id: string;
  participantCount: number;
}

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.join(__dirname, '..', '.wwebjs_auth')
  })
});

// Add timeout to prevent hanging
const TIMEOUT_MS = 120000; // 2 minutes
const timeout = setTimeout(() => {
  console.error('Script timed out after 2 minutes. Please check your WhatsApp connection.');
  process.exit(1);
}, TIMEOUT_MS);

client.on('qr', (qr: string) => {
  console.log('QR code received - scan with your phone:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async (): Promise<void> => {
  console.log('Client is ready!');
  console.log('Extracting group chat IDs...\n');

  
  const chats: Chat[] = await client.getChats();
  console.log('chats = ', chats);
  const groupChats = chats.filter((chat: Chat) => chat.isGroup);
  
  console.log(`Found ${groupChats.length} group chats:\n`);
  
  const groupChatInfo: GroupChatInfo[] = groupChats.map((chat: Chat) => ({
    name: chat.name,
    id: chat.id._serialized,
    participantCount: (chat as any).participants?.length || 0
  }));

  // Sort by participant count (most active first)
  groupChatInfo.sort((a, b) => b.participantCount - a.participantCount);

  groupChatInfo.forEach((group: GroupChatInfo, index: number) => {
    console.log(`${index + 1}. ${group.name}`);
    console.log(`   ID: ${group.id}`);
    console.log(`   Participants: ${group.participantCount}`);
    console.log('');
  });

  // Also output in a format easy to copy-paste into config
  console.log('\n📋 Copy-paste format for config.ts:');
  console.log('targetChats = [');
  groupChatInfo.forEach((group: GroupChatInfo) => {
    console.log(`  { id: '${group.id}', name: '${group.name}' },`);
  });
  console.log('];');


  await client.destroy();
  process.exit(0);
  }
);

client.on('auth_failure', (message: string) => {
  console.error('Authentication failed:', message);
  clearTimeout(timeout);
  process.exit(1);
});

client.on('disconnected', (reason: string) => {
  console.error('Client was disconnected:', reason);
  clearTimeout(timeout);
  process.exit(1);
});

console.log('Initializing WhatsApp client...');
client.initialize().catch((error: Error) => {
  console.error('Failed to initialize WhatsApp client:', error);
  clearTimeout(timeout);
  process.exit(1);
}); 