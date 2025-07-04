import { Client, LocalAuth, Chat } from 'whatsapp-web.js';
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

client.on('ready', async (): Promise<void> => {
  console.log('Client is ready!');
  console.log('Extracting group chat IDs...\n');

  try {
    const chats: Chat[] = await client.getChats();
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

  } catch (error) {
    console.error('Error extracting chat IDs:', error);
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