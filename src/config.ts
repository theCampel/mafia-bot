import dotenv from 'dotenv';
import path from 'path';
import { AppConfig, ChatInfo, Environment } from '@/types';

// Load .env file from the root directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const APP_ENV = (process.env.APP_ENV || 'development') as Environment;

// Database connection - try multiple possible environment variable names
const unpooledDbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
const pooledDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const databaseUrl = unpooledDbUrl || pooledDbUrl; // Prioritize unpooled

if (!databaseUrl) {
  throw new Error('Missing required database connection: Please set either DATABASE_URL_UNPOOLED or DATABASE_URL in your .env file');
}

let targetChats: ChatInfo[];
let messagesTableName: string;

if (APP_ENV === 'production') {
  targetChats = [
    { id: '120363359504745590@g.us', name: 'Unicorn Farm' },
    { id: '120363419170859917@g.us', name: 'Unicorn Mafia' },
    { id: '120363401735030139@g.us', name: 'Hackathons' },
  ];
  messagesTableName = process.env.PROD_MESSAGES_TABLE || 'um_messages';
} else {
  // Development environment
  targetChats = [
    { id: '120363412226772179@g.us', name: 'Appleton Shaggers' },
  ];
  messagesTableName = process.env.DEV_MESSAGES_TABLE || 'as_messages';
}

const config: AppConfig = {
  APP_ENV,
  TARGET_CHATS: targetChats,
  DATABASE_URL: databaseUrl,
  DATABASE_URL_POOLED: pooledDbUrl,
  MESSAGES_TABLE_NAME: messagesTableName,
};

export default config;

// Named exports for convenience
export const {
  APP_ENV: environment,
  TARGET_CHATS,
  DATABASE_URL,
  DATABASE_URL_POOLED,
  MESSAGES_TABLE_NAME,
} = config; 