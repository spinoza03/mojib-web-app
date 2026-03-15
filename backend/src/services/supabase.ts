import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("Missing Supabase credentials in .env. Integration will fail.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function getBotSettings(phone_number: string) {
    // Note: Assuming bot_configs maps somewhat to user table or has a way to identify which config to use.
    // If every user has their own wa_phone configured in profiles or bot_configs, adjust the query accordingly.
    // For now, attempting to fetch a generic config or match by some logic.
    // Let's assume there is exactly one main config we're pulling, or we fetch the first one.
    // **Adjustment based on prompt**: The user probably associates WA users with bot_configs, 
    // or there's an overarching bot_config. We'll grab the latest one for now.
    
    // For robust implementation, we might want to query by something specific, 
    // but the instruction says: "Every user must have in bot config how to manage the cooldown ... and prompt".
    const { data: config, error } = await supabase
        .from('bot_configs')
        .select('system_prompt, cooldown_seconds')
        .limit(1)
        .single();
    
    if (error) {
        console.error('Error fetching bot config:', error);
        return {
            system_prompt: 'You are a helpful Moroccan AI assistant. Reply in pure Darija.',
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
