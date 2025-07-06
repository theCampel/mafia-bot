import { Message } from 'whatsapp-web.js';
import { IMessageProcessor } from '@/types/processing';
import { DatabaseService } from '@/services/DatabaseService';
import config from '@/config';

export class DatabaseProcessor implements IMessageProcessor {
  private db: DatabaseService;

  constructor(databaseService: DatabaseService) {
    this.db = databaseService;
  }

  async process(message: Message): Promise<void> {
    
    // Do not store if from not a target chat
    // TODO: Eventually, this will be a smarter 'add to the db that 
    // the person is in' type shi. 
    if (!config.TARGET_CHATS.some(chat => chat.id === message.id.remote)) {
      return;
    }

    const query = `
      INSERT INTO ${config.MESSAGES_TABLE_NAME} (id, chat_id, sender_id, message_text, message_type, timestamp, has_media, quoted_message_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING;
    `;

    const messageData = {
      id: message.id._serialized,
      chatId: message.id.remote,
      senderId: message.author || message.from,
      body: message.body || '',
      type: message.type,
      timestamp: new Date(message.timestamp * 1000),
      hasMedia: message.hasMedia,
      quotedMessageId: message.hasQuotedMsg ? (await message.getQuotedMessage()).id._serialized : null,
    };

    try {
      await this.db.query(query, [
        messageData.id,
        messageData.chatId,
        messageData.senderId,
        messageData.body,
        messageData.type,
        messageData.timestamp,
        messageData.hasMedia,
        messageData.quotedMessageId,
      ]);
      console.log(`[DatabaseProcessor] Stored message ID: ${message.id._serialized}`);
    } catch (error) {
      console.error(`[DatabaseProcessor] Error storing message ID ${message.id._serialized}:`, error);
    }
  }
} 