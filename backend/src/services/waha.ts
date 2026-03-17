import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const WAHA_API_URL = process.env.WAHA_API_URL || 'https://waha.mojib.online';
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';
const WAHA_API_KEY = process.env.WAHA_API_KEY || 'my-secret-key';

const client = axios.create({
    baseURL: WAHA_API_URL,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY,
    }
});

export async function sendText(chatId: string, text: string, sessionName?: string) {
    try {
        await client.post('/api/sendText', {
            session: sessionName || WAHA_SESSION,
            chatId: chatId,
            text: text
        });
    } catch (error) {
        console.error(`[WAHA] Error sending text to ${chatId}:`, error);
    }
}

export async function startTyping(chatId: string, sessionName?: string) {
    try {
        await client.post('/api/startTyping', {
            session: sessionName || WAHA_SESSION,
            chatId: chatId
        });
    } catch (error) {
        console.error(`[WAHA] Error starting typing for ${chatId}:`, error);
    }
}

export async function getMediaUrl(mediaKey: string): Promise<string | null> {
    // WAHA usually sends the media attached directly or provides a way to download.
    // This depends on the exact WAHA payload format `message.upsert`.
    // It's often sent as a base64 string or an endpoint to fetch.
    return null; 
}
