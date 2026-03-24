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

export async function sendMedia(
    chatId: string,
    mediaUrl: string,
    mediaType: 'image' | 'video' = 'image',
    sessionName?: string,
    caption?: string
) {
    try {
        await client.post('/api/sendMedia', {
            session: sessionName || WAHA_SESSION,
            chatId: chatId,
            mediaUrl: mediaUrl,
            mediaType,
            caption: caption || ''
        });
    } catch (error) {
        console.error(`[WAHA] Error sending media (${mediaType}) to ${chatId}:`, error);
    }
}

export async function sendImage(
    chatId: string,
    imageUrl: string,
    sessionName?: string,
    caption?: string
) {
    await sendMedia(chatId, imageUrl, 'image', sessionName, caption);
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

export async function sendBulkText(chatIds: string[], text: string, sessionName?: string, delayMs: number = 1500): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    for (const chatId of chatIds) {
        try {
            await client.post('/api/sendText', {
                session: sessionName || WAHA_SESSION,
                chatId,
                text
            });
            sent++;
            // Delay between messages to avoid rate limiting
            if (delayMs > 0 && chatIds.indexOf(chatId) < chatIds.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        } catch (error) {
            console.error(`[WAHA] Bulk send failed for ${chatId}:`, error);
            failed++;
        }
    }
    console.log(`[WAHA] Bulk send complete: ${sent} sent, ${failed} failed`);
    return { sent, failed };
}

export async function downloadMedia(sessionName: string, messageId: string, extension: string = 'ogg'): Promise<{ buffer: Buffer | null, filepath?: string }> {
    try {
        console.log(`[WAHA] Downloading media for message ${messageId} in session ${sessionName}...`);
        let response;
        const url1 = `/api/${sessionName}/messages/${encodeURIComponent(messageId)}/download`;
        const url2 = `/api/sessions/${sessionName}/messages/${encodeURIComponent(messageId)}/download`;
        try {
            console.log(`[WAHA] Trying URL: ${url1}`);
            response = await client.get(url1, { responseType: 'arraybuffer' });
        } catch(e1: any) {
            console.log(`[WAHA] First URL failed (${e1?.response?.status || e1.message}), trying fallback: ${url2}`);
            response = await client.get(url2, { responseType: 'arraybuffer' });
        }

        const buffer = Buffer.from(response.data);
        if (buffer.length === 0) {
            console.error('[WAHA] Downloaded media buffer is empty (0 bytes)');
            return { buffer: null };
        }
        console.log(`[WAHA] Media downloaded successfully: ${buffer.length} bytes`);
        const tfp = path.join('/tmp', `waha_media_${messageId}.${extension}`);
        fs.writeFileSync(tfp, buffer);
        console.log(`[WAHA] Media saved to ${tfp}`);
        return { buffer, filepath: tfp };
    } catch(err: any) {
        console.error(`[WAHA] Failed to download media: ${err?.response?.status || ''} ${err.message}`);
        return { buffer: null };
    }
}
