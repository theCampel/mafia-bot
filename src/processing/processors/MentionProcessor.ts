import { Message } from 'whatsapp-web.js';
import { IMessageProcessor } from '@/types/processing';

export class MentionProcessor implements IMessageProcessor {
  async process(message: Message): Promise<void> {
    const mentions = await message.getMentions();
    const isBotMentioned = mentions.some(contact => contact.isMe);

    if (!isBotMentioned) {
      // Bot was not mentioned, do nothing.
      return;
    }
    
    console.log(`[MentionProcessor] Bot was mentioned in message ID: ${message.id._serialized}`);

    // In a real implementation, you would parse the command,
    // perform the requested action (e.g., call an AI, search the DB),
    // and reply to the message.
    const command = message.body.replace(/@\d+/g, '').trim();
    console.log(`[MentionProcessor] Parsed command: "${command}"`);

    // Example: await this.handleCommand(command, message);
    
    await this.dummyDelay(); // Simulate async action
    // await message.reply('I am a bot, and I have processed your command.');
    console.log(`[MentionProcessor] Finished processing mention for message ID: ${message.id._serialized}`);
  }

  private dummyDelay(ms: number = 100): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 