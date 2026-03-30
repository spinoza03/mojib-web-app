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

export async function sendImage(
    chatId: string,
    imageUrl: string,
    sessionName?: string,
    caption?: string
) {
    try {
        await client.post('/api/sendImage', {
            session: sessionName || WAHA_SESSION,
            chatId: chatId,
            file: {
                mimetype: "image/jpeg",
                url: imageUrl,
                filename: "property.jpg"
            },
            caption: caption || ''
        });
    } catch (error) {
        console.error(`[WAHA] Error sending image to ${chatId}:`, error);
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

export async function downloadMedia(sessionName: string, mediaUrl: string, extension: string = 'ogg'): Promise<{ buffer: Buffer | null, filepath?: string }> {
    try {
        let downloadUrl = mediaUrl;

        // WAHA (Docker) returns media URLs as http://localhost:3000/api/files/...
        // Replace localhost with the real external WAHA URL (same approach as the n8n workflow)
        if (downloadUrl.includes('localhost') || downloadUrl.includes('127.0.0.1')) {
            const pathStart = downloadUrl.indexOf('/api/');
            if (pathStart !== -1) {
                downloadUrl = `${WAHA_API_URL}${downloadUrl.substring(pathStart)}`;
            }
        }

        // Force HTTPS
        if (downloadUrl.startsWith('http://')) {
            downloadUrl = downloadUrl.replace('http://', 'https://');
        }

        // If it's a relative path, prepend the WAHA base URL
        if (downloadUrl.startsWith('/')) {
            downloadUrl = `${WAHA_API_URL}${downloadUrl}`;
        }
        
        console.log(`[WAHA] Downloading media from ${downloadUrl} in session ${sessionName}...`);
        
        // Use raw axios (NOT client) for absolute URLs to avoid double-prefixing from baseURL
        const isAbsoluteUrl = downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://');
        let response;
        if (isAbsoluteUrl) {
            response = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                headers: { 'X-Api-Key': WAHA_API_KEY }
            });
        } else {
            response = await client.get(downloadUrl, { responseType: 'arraybuffer' });
        }

        const buffer = Buffer.from(response.data);
        if (buffer.length === 0) {
            console.error('[WAHA] Downloaded media buffer is empty (0 bytes)');
            return { buffer: null };
        }
        console.log(`[WAHA] Media downloaded successfully: ${buffer.length} bytes`);
        const tfp = path.join('/tmp', `waha_media_${Date.now()}.${extension}`);
        fs.writeFileSync(tfp, buffer);
        console.log(`[WAHA] Media saved to ${tfp}`);
        return { buffer, filepath: tfp };
    } catch(err: any) {
        console.error(`[WAHA] Failed to download media: ${err?.response?.status || ''} ${err.message}`);
        return { buffer: null };
    }
}
