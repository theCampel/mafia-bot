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

  public async generateAnswer(chatHistory: string, question: string): Promise<string> {
    const prompt = `You're an AI that is a member of a WhatsApp group chat. You will be given a question and a chat history.

    You must answer the question asked, based on the conversation around it. Be clear and concise, but also be include some very high level context. 
    
    Do not just do a text extraction.
    
Use ONLY the information from the chat history below to answer the user's question. If the answer cannot be found in the provided text, state clearly: "I could not find an answer to that in the chat history." Do not make information up.

Based on the history, please answer this question:
"${question}"

--- CHAT HISTORY ---
${chatHistory}
--------------------`;

    try {
      console.log('[GeminiService] Generating answer...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const answer = response.text();
      
      console.log('[GeminiService] Answer generated successfully');
      return answer;
    } catch (error) {
      console.error('[GeminiService] Error generating answer:', error);
      throw new Error(`Failed to generate answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 