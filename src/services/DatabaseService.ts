import { Pool } from 'pg';
import { DatabaseConfig } from '@/types/database';
import config from '@/config';

export class DatabaseService {
  private pool: Pool;

  constructor(dbConfig: DatabaseConfig) {
    this.pool = new Pool({
      connectionString: dbConfig.connectionString,
      ssl: config.APP_ENV === 'production' ? { rejectUnauthorized: false } : false,
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
    const start = Date.now();
    const res = await this.pool.query(text, params);
    const duration = Date.now() - start;
    console.log('executed query', { text, duration, rows: res.rowCount });
    return res;
  }

  public async close() {
    await this.pool.end();
    console.log('✅ Database pool closed');
  }
} 