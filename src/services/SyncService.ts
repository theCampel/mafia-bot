import { Client, Message } from 'whatsapp-web.js';
import { DatabaseService } from '@/services/DatabaseService';
import { AppConfig, ChatInfo } from '@/types';
import { DatabaseProcessor } from '@/processing/processors/DatabaseProcessor';

const INITIAL_SYNC_LIMIT = 200; // Catch up on a reasonable number of messages if the bot was down for a while.
const CATCH_UP_SYNC_LIMIT = 100; // Fetch a smaller number for subsequent, regular syncs

/**
 * Service responsible for syncing messages that may have been missed
 * while the bot was offline.
 */
export class SyncService {
  private client: Client;
  private dbService: DatabaseService;
  private dbProcessor: DatabaseProcessor;
  private config: AppConfig;

  constructor(
    client: Client,
    dbService: DatabaseService,
    dbProcessor: DatabaseProcessor,
    config: AppConfig
  ) {
    this.client = client;
    this.dbService = dbService;
    this.dbProcessor = dbProcessor;
    this.config = config;
    console.log('[SyncService] Initialized.');
  }

  /**
   * Starts the message synchronization process.
   * It iterates through each target chat and syncs messages since the last known message.
   */
  public async syncAllChats(): Promise<void> {
    console.log('[SyncService] Starting synchronization for all target chats...');

    for (const chatInfo of this.config.TARGET_CHATS) {
      try {
        await this.syncChat(chatInfo);
      } catch (error) {
        console.error(`[SyncService] Failed to sync chat ${chatInfo.name} (${chatInfo.id}):`, error);
        // Continue to the next chat even if one fails
      }
    }

    console.log('[SyncService] Synchronization process completed.');
  }

  /**
   * Syncs messages for a single chat.
   * @param chatInfo The info of the chat to sync.
   */
  private async syncChat(chatInfo: ChatInfo): Promise<void> {
    const { id: chatId, name: chatName } = chatInfo;
    console.log(`[SyncService] Syncing chat: ${chatName} (${chatId})`);

    const lastTimestamp = await this.getLastMessageTimestamp(chatId);
    let syncLimit = CATCH_UP_SYNC_LIMIT; // Default to the smaller limit

    if (lastTimestamp) {
      console.log(`[SyncService] Last message timestamp for chat ${chatId} is ${lastTimestamp.toISOString()}`);
    } else {
      console.log(`[SyncService] No previous messages found for chat ${chatName}. Performing initial sync.`);
      
      const friendlyMessage = `Ping`;
      try {
        // await this.client.sendMessage(chatId, friendlyMessage);
        console.log(`[SyncService] Sent introductory message to ${chatName}.`);
      } catch (e) {
        console.error(`[SyncService] Could not send introductory message to ${chatName}.`, e);
      }

      syncLimit = INITIAL_SYNC_LIMIT; // Use the larger limit for the first sync
    }

    // 2. Fetch recent messages from the chat
    const chat = await this.client.getChatById(chatId);
    console.log(`[SyncService] Fetching up to ${syncLimit} messages for chat ${chatId}...`);
    const messages = await chat.fetchMessages({ limit: syncLimit });
    console.log(`[SyncService] Raw fetch returned ${messages.length} messages.`);
    
    const newMessages: Message[] = [];
    if (lastTimestamp) {
      // If we have a timestamp, filter out messages we already have
      // Messages are ordered newest to oldest, so we collect all messages newer than lastTimestamp
      for (const msg of messages) {
        const msgTimestamp = new Date(msg.timestamp * 1000);
        if (msgTimestamp > lastTimestamp) {
          newMessages.push(msg);
        }
        // Don't break here - continue checking all messages since they're not guaranteed to be in perfect order
      }
    } else {
      // If it's a new chat, take all fetched messages
      newMessages.push(...messages);
    }
    
    if (newMessages.length === 0) {
      console.log(`[SyncService] No new messages to sync for chat ${chatName}.`);
      return;
    }

    console.log(`[SyncService] Found ${newMessages.length} new message(s) to save for chat ${chatName}.`);

    // 3. Save new messages to the database
    // We process them in reverse order to save them oldest to newest
    for (const msg of newMessages.reverse()) {
      await this.dbProcessor.process(msg);
    }

    console.log(`[SyncService] Finished syncing chat: ${chatName} (${chatId})`);
  }

  /**
   * Retrieves the timestamp of the most recent message for a given chat from the database.
   * @param chatId The ID of the chat.
   * @returns A Date object representing the timestamp, or null if no messages are found.
   */
  private async getLastMessageTimestamp(chatId: string): Promise<Date | null> {
    const query = `
      SELECT MAX(timestamp) as last_timestamp
      FROM ${this.config.MESSAGES_TABLE_NAME}
      WHERE chat_id = $1;
    `;
    const result = await this.dbService.query(query, [chatId]);

    if (result.rows.length > 0 && result.rows[0].last_timestamp) {
      return new Date(result.rows[0].last_timestamp);
    }
    
    return null;
  }
} 