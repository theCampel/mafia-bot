import { Message } from 'whatsapp-web.js';

/**
 * Defines the interface for all message processors.
 * Each processor must implement a `process` method.
 */
export interface IMessageProcessor {
  /**
   * Processes an incoming WhatsApp message.
   * This method should contain the core logic of the processor.
   * @param message The raw message object from whatsapp-web.js.
   */
  process(message: Message): Promise<void>;
} 