// config.js
const dotenv = require('dotenv');
const path = require('path');

// Load .env file from the root directory
dotenv.config({ path: path.resolve(__dirname, '.env') });

const APP_ENV = process.env.APP_ENV || 'development'; // Default to development

// Common Supabase connection details (assuming one DB)
const supabaseUrl = process.env.SUPABASE_DB_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let targetChats;
let messagesTableName;

if (APP_ENV === 'production') {
    targetChats = [
        { id: '120363359504745590@g.us', name: 'Unicorn Farm' },
        { id: '120363419170859917@g.us', name: 'Unicorn Mafia' },
        { id: '120363401735030139@g.us', name: 'Hackathons' }
    ];
    messagesTableName = process.env.PROD_MESSAGES_TABLE || 'wa_um_messages'; // e.g., messages_prod
} else { // Development or any other environment
    targetChats = [
        { id: '120363412226772179@g.us', name: 'Appleton Shaggers' }
    ];
    messagesTableName = process.env.DEV_MESSAGES_TABLE || 'wa_as_messages'; // e.g., messages_dev
}

module.exports = {
    APP_ENV,
    TARGET_CHATS: targetChats,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_KEY: supabaseKey,
    MESSAGES_TABLE_NAME: messagesTableName,
}; 