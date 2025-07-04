import { Message } from 'whatsapp-web.js';
import { IMessageProcessor } from '@/types/processing';
import { DatabaseService } from '@/services/DatabaseService';

export class DatabaseProcessor implements IMessageProcessor {
  private db: DatabaseService;

  constructor(databaseService: DatabaseService) {
    this.db = databaseService;
  }

  async process(message: Message): Promise<void> {
    console.log(`[DatabaseProcessor] Storing message ID: ${message.id._serialized}`);
    
    // In a real implementation, you would map the message to your database schema
    // and call the database service to insert it.
    // For now, this is just a placeholder.
    
    const messageData = {
      id: message.id._serialized,
      chatId: message.from,
      senderId: message.author || message.from,
      body: message.body,
      timestamp: new Date(message.timestamp * 1000),
      hasMedia: message.hasMedia,
    };
    
    // Example of calling the database service
    // await this.db.insertMessage(messageData);
    
    await this.dummyDelay(); // Simulate async database operation
    console.log(`[DatabaseProcessor] Stored message ID: ${message.id._serialized}`);
  }

  private dummyDelay(ms: number = 50): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 