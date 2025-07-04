import { Message } from 'whatsapp-web.js';
import { IMessageProcessor } from '@/types/processing';

export class MessageRouter {
  private processors: IMessageProcessor[];

  constructor(processors: IMessageProcessor[]) {
    this.processors = processors;
    console.log(`MessageRouter initialized with ${processors.length} processors:`, 
      processors.map(p => p.constructor.name).join(', '));
  }

  public async handle(message: Message): Promise<void> {
    console.log(`\n--- Handling message from ${message.from}: "${message.body.substring(0, 50)}..."`);
    
    // Execute all processors in parallel
    const processingPromises = this.processors.map(processor =>
      processor.process(message).catch(error => {
        console.error(`Error in processor '${processor.constructor.name}':`, error);
        // A failure in one processor should not stop others
        return null; 
      })
    );

    await Promise.allSettled(processingPromises);
    console.log(`--- Finished handling message from ${message.from}`);
  }
} 