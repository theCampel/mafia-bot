import { Message } from 'whatsapp-web.js';
import { IMessageProcessor } from '@/types/processing';

export class LumaProcessor implements IMessageProcessor {
  private readonly LUMA_REGEX = /https?:\/\/lu\.ma\/\S+/g;

  async process(message: Message): Promise<void> {
    const lumaLinks = message.body.match(this.LUMA_REGEX);

    if (!lumaLinks || lumaLinks.length === 0) {
      // No Luma links found, do nothing.
      return;
    }

    console.log(`[LumaProcessor] Found ${lumaLinks.length} Luma link(s) in message ID: ${message.id._serialized}`);
    
    // In a real implementation, you would scrape each link,
    // process the event details, and store them in a separate table.
    for (const link of lumaLinks) {
      console.log(`[LumaProcessor] Scraping: ${link}`);
      // await this.scrapeAndStore(link, message.id._serialized);
    }
    
    await this.dummyDelay(); // Simulate async scraping operation
    console.log(`[LumaProcessor] Finished processing message ID: ${message.id._serialized}`);
  }

  private dummyDelay(ms: number = 200): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 