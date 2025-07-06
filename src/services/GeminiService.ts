import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    console.log('✅ GeminiService initialized with Gemini 2.5 Flash model');
  }

  public async generateSummary(chatHistory: string): Promise<string> {
    const prompt = `
    You are a concise groupchat message summarizer. You will be given a collection of text
    messages from a WhatsApp group chat. 
    
    You will return the key highlights in simple, clear, concise and high-entropy language. 
    You will not include any other text or commentary.

    If nothing meaningful was discussed, return "Nothing massive was discussed in the given time period."

The conversation is:

${chatHistory}`;

    try {
      console.log('[GeminiService] Generating summary...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();
      
      console.log('[GeminiService] Summary generated successfully');
      return summary;
    } catch (error) {
      console.error('[GeminiService] Error generating summary:', error);
      throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 