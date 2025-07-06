import { Message, Client } from 'whatsapp-web.js';
import { IMessageProcessor } from '@/types/processing';
import { DatabaseService } from '@/services/DatabaseService';
import { GeminiService } from '@/services/GeminiService';
import config from '@/config';

export class SummaryProcessor implements IMessageProcessor {
  private dbService: DatabaseService;
  private geminiService: GeminiService;
  private client: Client;
  private requestTimestamps = new Map<string, number[]>();
  private contactCache = new Map<string, string>(); // Cache for contact names

  // Rate limiting: max 3 requests per 24 hours
  private readonly MAX_REQUESTS_PER_DAY = 3;
  private readonly RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(databaseService: DatabaseService, geminiService: GeminiService, client: Client) {
    this.dbService = databaseService;
    this.geminiService = geminiService;
    this.client = client;
    console.log('[SummaryProcessor] Initialized with rate limiting (3 requests/24h)');
  }

  async process(message: Message): Promise<void> {
    // Step 1: Command Check
    const command = message.body.trim();
    if (!command.startsWith('!summary')) {
      return;
    }

    const userId = message.from; // This is the user's DM chat ID
    console.log(`[SummaryProcessor] Processing summary request from ${userId}`);

    // Step 2: Identify Target Chat
    const targetChat = config.TARGET_CHATS[0];
    if (!targetChat) {
      await this.client.sendMessage(userId, "I am not configured to summarize any chats right now.");
      console.error("[SummaryProcessor] No target chats configured.");
      return;
    }

    const targetChatId = targetChat.id;
    const targetChatName = targetChat.name;

    // Step 3: Privacy & Security Check
    const isMember = await this.isUserInGroup(userId, targetChatId);
    if (!isMember) {
      await this.client.sendMessage(userId, `Sorry, you don't seem to be a member of the '${targetChatName}' group I'm configured to summarize.`);
      console.warn(`[SummaryProcessor] Denied summary request from non-member ${userId} for group ${targetChatId}`);
      return;
    }

    // Step 4: Rate Limiting
    if (this.isRateLimited(userId)) {
      await this.client.sendMessage(userId, 
        "You have reached your summary limit for today (3 requests per 24 hours). Please try again tomorrow.");
      return;
    }

    // Step 5: Command Parsing
    const hoursMatch = command.match(/!summary\s+-(\d+)/);
    if (!hoursMatch) {
      await this.client.sendMessage(userId, 
        "Invalid format. Please use !summary -24 for the last 24 hours.");
      return;
    }

    const hours = parseInt(hoursMatch[1], 10);
    if (hours <= 0 || hours > 168) { // Max 1 week
      await this.client.sendMessage(userId, 
        "Please specify a number between 1 and 168 hours (1 week maximum).");
      return;
    }

    // Step 6: User Feedback (Acknowledge Request)
    await this.client.sendMessage(userId, 
      `Got it! Generating a summary for the '${targetChatName}' group for the last ${hours} hours. This might take a moment...`);

    // Record the request for rate limiting
    this.recordRequest(userId);

    try {
      // Step 7: Fetch Data from Target Group
      const sinceDate = new Date(Date.now() - (hours * 60 * 60 * 1000));
      const messages = await this.dbService.getMessagesInRange(
        targetChatId, // Use the configured target chat ID
        sinceDate,
        config.MESSAGES_TABLE_NAME
      );



      // Step 8: Format for AI
      if (messages.length === 0) {
        await this.client.sendMessage(userId, 
          `No messages found in the '${targetChatName}' group in the last ${hours} hours.`);
        return;
      }

      const formattedHistory = await this.formatMessagesForAI(messages);
      console.log(formattedHistory);
      console.log(`[SummaryProcessor] Found ${messages.length} messages to summarize from ${targetChatName}`);

      // Step 9: Generate Summary
      const summary = await this.geminiService.generateSummary(formattedHistory);

      // Step 10: Send Result
      const finalMessage = `📋 *Summary for '${targetChatName}' - last ${hours} hours**\n\n${summary}`;
      await this.client.sendMessage(userId, finalMessage);

      console.log(`[SummaryProcessor] Successfully sent summary to ${userId}`);

    } catch (error) {
      console.error(`[SummaryProcessor] Error processing summary request:`, error);
      await this.client.sendMessage(userId, 
        "Sorry, I encountered an error while generating your summary. Please try again later.");
    }
  }

  private isRateLimited(userId: string): boolean {
    const now = Date.now();
    const userRequests = this.requestTimestamps.get(userId) || [];
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(timestamp => 
      now - timestamp < this.RATE_LIMIT_WINDOW_MS
    );
    
    this.requestTimestamps.set(userId, validRequests);
    
    return validRequests.length >= this.MAX_REQUESTS_PER_DAY;
  }

  private recordRequest(userId: string): void {
    const now = Date.now();
    const userRequests = this.requestTimestamps.get(userId) || [];
    userRequests.push(now);
    this.requestTimestamps.set(userId, userRequests);
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
            console.debug(`[SummaryProcessor] Could not get contact info for ${msg.sender_id}`);
            this.contactCache.set(msg.sender_id, senderDisplay);
          }
        }
        
        return `[${time}] ${senderDisplay}: ${msg.message_text}`;
      })
    );
    
    return formattedMessages.join('\n');
  }

  private async isUserInGroup(userId: string, groupId: string): Promise<boolean> {
    try {
      const groupChat = await this.client.getChatById(groupId);
      
      // Verify it's actually a group chat
      if (!groupChat.isGroup) {
        console.warn(`[SummaryProcessor] ${groupId} is not a group chat`);
        return false;
      }

      // Access the participants property from the GroupChat
      const participants = (groupChat as any).participants;
      if (!participants || !Array.isArray(participants)) {
        console.warn(`[SummaryProcessor] Could not access participants for group ${groupId}`);
        return false;
      }

      // Check if the user is in the participants list
      // userId format: "1234567890@c.us"
      // participant.id._serialized format: "1234567890@c.us"
      const isMember = participants.some((participant: any) => 
        participant.id._serialized === userId
      );

      console.log(`[SummaryProcessor] User ${userId} membership check for group ${groupId}: ${isMember}`);
      return isMember;

    } catch (error) {
      console.error(`[SummaryProcessor] Error checking group membership:`, error);
      return false;
    }
  }


} 