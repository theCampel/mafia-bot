export * from './processing';
export * from './database';

// Core application types
export interface AppConfig {
  APP_ENV: string;
  TARGET_CHATS: ChatInfo[];
  DATABASE_URL: string;
  DATABASE_URL_POOLED?: string;
  MESSAGES_TABLE_NAME: string;
  GEMINI_API_KEY: string;
}

export interface ChatInfo {
  id: string;
  name: string;
}

// WhatsApp message types
export interface WhatsAppMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  message_text: string;
  message_type: MessageType;
  timestamp: string;
  quoted_message_id: string | null;
  has_media: boolean;
}

export type MessageType = 
  | 'chat' 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'document' 
  | 'sticker' 
  | 'location' 
  | 'contact' 
  | 'revoked'
  | 'unknown';

// Raw WhatsApp Web.js message interface (subset of what we use)
export interface RawWhatsAppMessage {
  id: {
    _serialized: string;
  };
  from: string;
  author?: string;
  body?: string;
  caption?: string;
  type: string;
  timestamp: number;
  hasMedia: boolean;
  _data?: {
    contextInfo?: {
      quotedMessageStanzaId?: string;
    };
  };
}

// Notification system types
export interface RelevanceAnalysis {
  is_relevant: boolean;
  topic?: string;
  summary?: string;
}

export interface NotificationCooldown {
  topic: string;
  lastNotified: number;
}

export interface MessageBuffer {
  chatId: string;
  messages: { sender_id: string; message_text: string; timestamp: Date }[];
  lastActivity: number;
}

// Luma event types (for future implementation)
export interface LumaEvent {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  location: string;
  url: string;
  host: string;
  extracted_from_message_id: string;
  created_at: string;
}

// Database schema types
export interface DatabaseMessage extends WhatsAppMessage {
  created_at: string;
  updated_at: string;
  processed_for_luma: boolean;
  processed_for_summary: boolean;
}

// CSV export types
export interface CSVMessageRecord {
  id: string;
  chat_id: string;
  sender_id: string;
  message_text: string;
  message_type: string;
  timestamp: string;
  quoted_message_id: string | null;
  has_media: boolean;
}

// Environment types
export type Environment = 'development' | 'ef-dev' | 'production';

// Error types
export interface AppError extends Error {
  code?: string;
  context?: Record<string, unknown>;
} 