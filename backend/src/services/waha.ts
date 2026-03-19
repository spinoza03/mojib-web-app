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
    return null; 
}

export async function downloadMedia(sessionName: string, messageId: string, extension: string = 'ogg'): Promise<{ buffer: Buffer | null, filepath?: string }> {
    try {
        console.log(`[WAHA] Downloading media for message ${messageId} in session ${sessionName}...`);
        let response;
        try {
            response = await client.get(`/api/${sessionName}/messages/${encodeURIComponent(messageId)}/download`, {
                responseType: 'arraybuffer'
            });
        } catch(e1) {
            response = await client.get(`/api/sessions/${sessionName}/messages/${encodeURIComponent(messageId)}/download`, {
                responseType: 'arraybuffer'
            });
        }
        
        const buffer = Buffer.from(response.data);
        const tfp = path.join('/tmp', `waha_media_${messageId}.${extension}`);
        fs.writeFileSync(tfp, buffer);
        console.log(`[WAHA] Media saved to ${tfp}`);
        return { buffer, filepath: tfp };
    } catch(err) {
        console.error('[WAHA] Failed to download media completely:', err);
        return { buffer: null };
    }
}
