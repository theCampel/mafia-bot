import { Message, Client } from 'whatsapp-web.js';
import { IMessageProcessor } from '@/types/processing';
import { DatabaseService } from '@/services/DatabaseService';
import { GeminiService } from '@/services/GeminiService';
import config from '@/config';

export class AskProcessor implements IMessageProcessor {
  private dbService: DatabaseService;
  private geminiService: GeminiService;
  private client: Client;
  private contactCache = new Map<string, string>(); // Cache for contact names

  constructor(databaseService: DatabaseService, geminiService: GeminiService, client: Client) {
    this.dbService = databaseService;
    this.geminiService = geminiService;
    this.client = client;
    console.log('[AskProcessor] Initialized');
  }

  async process(message: Message): Promise<void> {
    let targetChatId: string;
    let targetChatName: string;
    let replyTarget: string;
    let question: string;

    // Step A: Detect Invocation Context
    const isFromDM = message.from.endsWith('@c.us');
    const isFromGroup = message.from.endsWith('@g.us');

    if (isFromDM && message.body.trim().startsWith('!ask')) {
      // DM Invocation: !ask <question>
      const command = message.body.trim();
      const questionMatch = command.match(/^!ask\s+(.+)$/);
      
      if (!questionMatch) {
        await this.client.sendMessage(message.from, 
          "Please provide a question after !ask. Example: !ask What was discussed about the project?");
        return;
      }

      question = questionMatch[1];
      
      // Use the default group for the environment
      const targetChat = config.TARGET_CHATS[0];
      if (!targetChat) {
        await this.client.sendMessage(message.from, "I am not configured to search any chats right now.");
        console.error("[AskProcessor] No target chats configured.");
        return;
      }

      targetChatId = targetChat.id;
      targetChatName = targetChat.name;
      replyTarget = message.from; // Reply back to the user's DM

      console.log(`[AskProcessor] DM question from ${message.from}: "${question}"`);

    } else if (isFromGroup) {
      // Group Invocation: @bot ask <question>
      const mentions = await message.getMentions();
      const isBotMentioned = mentions.some(contact => contact.isMe);

      if (!isBotMentioned) {
        return; // Bot was not mentioned, ignore
      }

      const command = message.body.replace(/@\d+/g, '').trim();
      const questionMatch = command.match(/^ask\s+(.+)$/);

      if (!questionMatch) {
        await message.reply("Please provide a question after 'ask'. Example: @bot ask What was discussed about the project?");
        return;
      }

      question = questionMatch[1];
      targetChatId = message.from; // The group chat itself
      replyTarget = message.from; // Reply in the group chat
      
      // Find the group name from config
      const targetChat = config.TARGET_CHATS.find(chat => chat.id === targetChatId);
      targetChatName = targetChat ? targetChat.name : 'this group';

      console.log(`[AskProcessor] Group question in ${targetChatName}: "${question}"`);

    } else {
      return; // Not a valid invocation context
    }

    // Step B: Acknowledge the Request
    const acknowledgment = `On it! Searching the history of '${targetChatName}' to answer your question. This might take a moment...`;
    
    if (isFromGroup) {
      await message.reply(acknowledgment);
    } else {
      await this.client.sendMessage(replyTarget, acknowledgment);
    }

    try {
      // Step C: Fetch All Messages from Target Chat
      console.log(`[AskProcessor] Fetching all messages from ${targetChatName} (${targetChatId})`);
      const messages = await this.dbService.getAllMessages(targetChatId, config.MESSAGES_TABLE_NAME);

      if (messages.length === 0) {
        const noMessagesResponse = `No messages found in the '${targetChatName}' chat history.`;
        if (isFromGroup) {
          await message.reply(noMessagesResponse);
        } else {
          await this.client.sendMessage(replyTarget, noMessagesResponse);
        }
        return;
      }

      // Step D: Format Messages for AI
      const formattedHistory = await this.formatMessagesForAI(messages);
      console.log(`[AskProcessor] Found ${messages.length} messages to search through`);

      // Step E: Generate Answer
      const answer = await this.geminiService.generateAnswer(formattedHistory, question);

      // Step F: Send Result
      const finalResponse = `💬 **Answer about '${targetChatName}':**\n\n${answer}`;
      
      if (isFromGroup) {
        await message.reply(finalResponse);
      } else {
        await this.client.sendMessage(replyTarget, finalResponse);
      }

      console.log(`[AskProcessor] Successfully answered question for ${replyTarget}`);

    } catch (error) {
      console.error(`[AskProcessor] Error processing ask request:`, error);
      const errorResponse = "Sorry, I encountered an error while searching for an answer. Please try again later.";
      
      if (isFromGroup) {
        await message.reply(errorResponse);
      } else {
        await this.client.sendMessage(replyTarget, errorResponse);
      }
    }
  }

  private async formatMessagesForAI(messages: { sender_id: string; message_text: string; timestamp: Date }[]): Promise<string> {
    const formattedMessages = await Promise.all(
      messages.map(async (msg) => {
        const time = msg.timestamp.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
        
        // Try to get the contact name, fallback to phone number
        let senderDisplay = msg.sender_id.split('@')[0]; // Default to phone number
        
        // Check cache first
        if (this.contactCache.has(msg.sender_id)) {
          senderDisplay = this.contactCache.get(msg.sender_id)!;
        } else {
          try {
            const contact = await this.client.getContactById(msg.sender_id);
            if (contact && contact.name) {
              senderDisplay = contact.name;
              this.contactCache.set(msg.sender_id, contact.name);
            } else if (contact && contact.pushname) {
              senderDisplay = contact.pushname;
              this.contactCache.set(msg.sender_id, contact.pushname);
            } else {
              // Cache the phone number to avoid repeated failed lookups
              this.contactCache.set(msg.sender_id, senderDisplay);
            }
          } catch (error) {
            // If we can't get contact info, cache the phone number
            console.debug(`[AskProcessor] Could not get contact info for ${msg.sender_id}`);
            this.contactCache.set(msg.sender_id, senderDisplay);
          }
        }
        
        return `[${time}] ${senderDisplay}: ${msg.message_text}`;
      })
    );
    
    return formattedMessages.join('\n');
  }
} 