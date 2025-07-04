import dotenv from 'dotenv';
import path from 'path';
import { AppConfig, ChatInfo, Environment } from '@/types';

// Load .env file from the root directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const APP_ENV = (process.env.APP_ENV || 'development') as Environment;

// Database connection - try multiple possible environment variable names
const databaseUrl = 
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Missing required database connection: Please set DATABASE_URL_UNPOOLED, POSTGRES_URL, or DATABASE_URL in your .env file');
}

let targetChats: ChatInfo[];
let messagesTableName: string;

if (APP_ENV === 'production') {
  targetChats = [
    { id: '120363359504745590@g.us', name: 'Unicorn Farm' },
    { id: '120363419170859917@g.us', name: 'Unicorn Mafia' },
    { id: '120363401735030139@g.us', name: 'Hackathons' }
  ];
  messagesTableName = process.env.PROD_MESSAGES_TABLE || 'wa_um_messages';
} else {
  // Development environment
  targetChats = [
    { id: '120363412226772179@g.us', name: 'Appleton Shaggers' }
  ];
  messagesTableName = process.env.DEV_MESSAGES_TABLE || 'wa_as_messages';
}

const config: AppConfig = {
  APP_ENV,
  TARGET_CHATS: targetChats,
  DATABASE_URL: databaseUrl,
  MESSAGES_TABLE_NAME: messagesTableName,
};

export default config;

// Named exports for convenience
export const {
  APP_ENV: environment,
  TARGET_CHATS,
  DATABASE_URL,
  MESSAGES_TABLE_NAME
} = config; 