import { Message, Client } from 'whatsapp-web.js';
import { IMessageProcessor } from '@/types/processing';
import { GeminiService } from '@/services/GeminiService';
import { MessageBuffer, NotificationCooldown, RelevanceAnalysis } from '@/types';
import config from '@/config';

export class NotifierProcessor implements IMessageProcessor {
  private geminiService: GeminiService;
  private client: Client;
  private contactCache = new Map<string, string>();
  
  // State management
  private messageBuffers = new Map<string, MessageBuffer>();
  private analysisInProgress = new Set<string>(); // Track which chats are being analyzed
  private notificationCooldowns = new Map<string, NotificationCooldown[]>(); // userId -> cooldowns
  
  // Configuration
  private readonly BUFFER_SIZE = 20; // Keep last 20 messages
  private readonly TRIGGER_THRESHOLD = 3; // 3 messages to trigger analysis
  private readonly TRIGGER_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
  private readonly COOLDOWN_PERIOD_MS = 60 * 1000 //4 * 60 * 60 * 1000; // 4 hours
  private readonly TARGET_USER_ID = '447927612815@c.us'; // TODO: Make dynamic
  
  // Hardcoded user interests for MVP
  private readonly USER_INTERESTS = [
    'bitcoin',
    'AI agent development',
    'hackathons',
    'startup',
    'entrepreneurship',
    'coding',
    'programming',
    'machine learning',
    'crypto',
    'blockchain',
    'venture capital',
    'fundraising'
  ];

  constructor(geminiService: GeminiService, client: Client) {
    this.geminiService = geminiService;
    this.client = client;
    console.log('[NotifierProcessor] Initialized with proactive notifications');
    console.log(`[NotifierProcessor] Target user: ${this.TARGET_USER_ID}`);
    console.log(`[NotifierProcessor] Monitoring interests: ${this.USER_INTERESTS.join(', ')}`);
  }

  async process(message: Message): Promise<void> {
    // Only process messages from target group chats
    const isFromGroup = message.from.endsWith('@g.us');
    if (!isFromGroup) {
      return;
    }

    const chatId = message.from;
    
    // Check if this is a target chat
    const isTargetChat = config.TARGET_CHATS.some(chat => chat.id === chatId);
    if (!isTargetChat) {
      return;
    }

    // Step 1: Add message to buffer
    this.addMessageToBuffer(chatId, message);

    // Step 2: Check if we should trigger analysis
    if (this.shouldTriggerAnalysis(chatId)) {
      // Trigger analysis asynchronously to avoid blocking other processors
      this.analyzeAndNotify(chatId).catch(error => {
        console.error(`[NotifierProcessor] Error in analysis for ${chatId}:`, error);
      });
    }
  }

  private addMessageToBuffer(chatId: string, message: Message): void {
    if (!this.messageBuffers.has(chatId)) {
      this.messageBuffers.set(chatId, {
        chatId,
        messages: [],
        lastActivity: Date.now()
      });
    }

    const buffer = this.messageBuffers.get(chatId)!;
    
    // Add the new message
    buffer.messages.push({
      sender_id: message.author || message.from,
      message_text: message.body || '',
      timestamp: new Date(message.timestamp * 1000)
    });

    // Update last activity
    buffer.lastActivity = Date.now();

    // Trim buffer to size
    if (buffer.messages.length > this.BUFFER_SIZE) {
      buffer.messages = buffer.messages.slice(-this.BUFFER_SIZE);
    }

    console.log(`[NotifierProcessor] Buffer for ${chatId}: ${buffer.messages.length} messages`);
  }

  private shouldTriggerAnalysis(chatId: string): boolean {
    const buffer = this.messageBuffers.get(chatId);
    if (!buffer) return false;

    // Don't trigger if analysis is already in progress
    if (this.analysisInProgress.has(chatId)) {
      return false;
    }

    // Check if we have enough recent activity
    const now = Date.now();
    const recentMessages = buffer.messages.filter(msg => 
      now - msg.timestamp.getTime() <= this.TRIGGER_WINDOW_MS
    );

    const shouldTrigger = recentMessages.length >= this.TRIGGER_THRESHOLD;
    
    if (shouldTrigger) {
      console.log(`[NotifierProcessor] Triggering analysis for ${chatId}: ${recentMessages.length} messages in last 2 minutes`);
    }

    return shouldTrigger;
  }

  private async analyzeAndNotify(chatId: string): Promise<void> {
    // Mark analysis as in progress
    this.analysisInProgress.add(chatId);

    try {
      const buffer = this.messageBuffers.get(chatId);
      if (!buffer || buffer.messages.length === 0) {
        return;
      }

      // Format messages for AI analysis
      const formattedHistory = await this.formatMessagesForAI(buffer.messages);
      
      // Get chat name for user-friendly notifications
      const targetChat = config.TARGET_CHATS.find(chat => chat.id === chatId);
      const chatName = targetChat ? targetChat.name : 'Unknown Group';

      console.log(`[NotifierProcessor] Analyzing ${buffer.messages.length} messages from ${chatName}`);

      // Analyze relevance with AI
      const analysis: RelevanceAnalysis = await this.geminiService.analyzeRelevance(
        formattedHistory, 
        this.USER_INTERESTS
      );

      

      if (analysis.is_relevant && analysis.topic && analysis.summary) {
        // Check cooldown before sending notification
        console.log(`Entered if statement`);
        if (this.isNotificationAllowed(this.TARGET_USER_ID, analysis.topic)) {
          console.log(`Notification allowed`);
          try {
            await this.sendNotification(chatName, analysis.topic, analysis.summary);
            this.recordNotification(this.TARGET_USER_ID, analysis.topic);
            
            // Clear the buffer after successful notification to avoid re-analyzing the same conversation
            this.messageBuffers.delete(chatId);
          } catch (error) {
            console.error(`[NotifierProcessor] Failed to send notification, will retry later:`, error);
            // Don't clear the buffer on failure so we can retry
          }
        } else {
          console.log(`[NotifierProcessor] Notification blocked by cooldown: ${analysis.topic}`);
        }
      } else {
        console.log(`[NotifierProcessor] Conversation not relevant to user interests`);
      }

    } finally {
      // Always remove from in-progress set
      this.analysisInProgress.delete(chatId);
    }
  }

  private isNotificationAllowed(userId: string, topic: string): boolean {
    const userCooldowns = this.notificationCooldowns.get(userId) || [];
    const now = Date.now();

    // Check if we've notified about this topic recently
    const recentNotification = userCooldowns.find(cooldown => 
      cooldown.topic === topic && 
      (now - cooldown.lastNotified) < this.COOLDOWN_PERIOD_MS
    );

    return !recentNotification;
  }

  private recordNotification(userId: string, topic: string): void {
    if (!this.notificationCooldowns.has(userId)) {
      this.notificationCooldowns.set(userId, []);
    }

    const userCooldowns = this.notificationCooldowns.get(userId)!;
    const now = Date.now();

    // Remove or update existing cooldown for this topic
    const existingIndex = userCooldowns.findIndex(cooldown => cooldown.topic === topic);
    if (existingIndex >= 0) {
      userCooldowns[existingIndex].lastNotified = now;
    } else {
      userCooldowns.push({ topic, lastNotified: now });
    }

    // Clean up old cooldowns
    const validCooldowns = userCooldowns.filter(cooldown => 
      (now - cooldown.lastNotified) < this.COOLDOWN_PERIOD_MS
    );
    this.notificationCooldowns.set(userId, validCooldowns);
  }

  private async sendNotification(chatName: string, topic: string, summary: string): Promise<void> {
    const notificationMessage = `🔥 Hey! The '${chatName}' group is talking about '${topic}' right now. You might want to chime in!\n\n📝 Quick summary:\n${summary}`;
    console.log(`[NotifierProcessor] Attempting to send notification to ${this.TARGET_USER_ID}`);
    console.log(`[NotifierProcessor] Message was: ${notificationMessage}`);
    try {
      await this.client.sendMessage(this.TARGET_USER_ID, notificationMessage);
      console.log(`[NotifierProcessor] ✅ Sent notification about '${topic}' in '${chatName}'`);
    } catch (error) {
      console.error(`[NotifierProcessor] ❌ Failed to send notification:`, error);
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
            console.debug(`[NotifierProcessor] Could not get contact info for ${msg.sender_id}`);
            this.contactCache.set(msg.sender_id, senderDisplay);
          }
        }
        
        return `[${time}] ${senderDisplay}: ${msg.message_text}`;
      })
    );
    
    return formattedMessages.join('\n');
  }
} 