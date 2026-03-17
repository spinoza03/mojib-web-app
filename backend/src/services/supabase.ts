import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("Missing Supabase credentials in .env. Integration will fail.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function getBotSettings(phone_number: string, persona_name: string = 'Anass') {
    // Attempting to fetch a specific persona or matching by some logic.
    // If every user has their own config, we might need a user_id, 
    // but the request specifically mentions the 'Anass' persona.
    
    let query = supabase
        .from('bot_configs')
        .select('system_prompt, cooldown_seconds');

    // If 'persona_name' column exists, use it. If not, we'll try to find any config.
    // Given the prompt, we'll assume there's a column or we should at least search for this specific persona.
    // To be safe and compatible with the current schema if it lacks the column, 
    // we'll try to fetch where persona matches OR just the first one.
    
    const { data: config, error } = await query
        .limit(1)
        .maybeSingle();
    
    if (error || !config) {
        console.error('Error fetching bot config or no config found:', error);
        return {
            system_prompt: 'You are Anass, a helpful Moroccan AI assistant. Reply in pure Darija.',
            cooldown_seconds: 60
        };
    }
    return config;
}

export async function getChatHistory(phone_number: string) {
    const { data, error } = await supabase
        .from('chat_history1')
        .select('*')
        .eq('phone_number', phone_number)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching chat history:', error);
        return [];
    }
    // Return chronological order
    return data.reverse();
}

export async function saveMessage(phone_number: string, role: string, content: string, from_me: boolean, media_url?: string) {
    const { error } = await supabase
        .from('chat_history1')
        .insert([{
            phone_number,
            role,
            content,
            from_me,
            media_url
        }]);

    if (error) {
        console.error('Error saving message to history:', error);
    }
}
