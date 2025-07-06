import { Pool } from 'pg';
import { DatabaseConfig } from '@/types/database';

export class DatabaseService {
  private pool: Pool;

  constructor(dbConfig: DatabaseConfig) {
    this.pool = new Pool({
      connectionString: dbConfig.connectionString,
    });

    this.pool.on('connect', () => {
      console.log('✅ Database pool connected');
    });

    this.pool.on('error', (err) => {
      console.error('❌ Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  public async query(text: string, params?: any[]) {
    const res = await this.pool.query(text, params);
    return res;
  }

  public async getMessagesInRange(
    chatId: string, 
    sinceDate: Date, 
    tableName: string
  ): Promise<{ sender_id: string; message_text: string; timestamp: Date }[]> {
    const query = `
      SELECT sender_id, message_text, timestamp
      FROM ${tableName}
      WHERE chat_id = $1 AND timestamp >= $2
      ORDER BY timestamp ASC
    `;
    
    const result = await this.pool.query(query, [chatId, sinceDate]);
    return result.rows;
  }

  public async close() {
    await this.pool.end();
    console.log('✅ Database pool closed');
  }
} 