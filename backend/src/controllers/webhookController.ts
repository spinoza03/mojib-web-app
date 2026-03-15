import { Request, Response } from 'express';
import { getBotSettings, getChatHistory, saveMessage } from '../services/supabase';
import { generateResponse, transcribeAudio } from '../services/openai';
import { sendText, startTyping } from '../services/waha';

// Interface based on WAHA webhook `message.upsert` structure
interface WAMessage {
    id: string;
    timestamp: number;
    from: string; // phone number e.g. 212xxxxxxxxx@c.us
    to: string;
    body: string;
    hasMedia: boolean;
    fromMe: boolean;
    type: string;
    // other fields omitted for brevity
}

export const wahaWebhookHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const payload = req.body;
        // console.log("Incoming Webhook Payload:", JSON.stringify(payload, null, 2));

        // WAHA sends events in `payload.event` and data in `payload.payload`
        if (payload.event !== 'message.upsert') {
            res.status(200).send('Not a message.upsert event');
            return;
        }

        const message: WAMessage = payload.payload;

        // Ignore status updates or unsupported formats explicitly if needed
        if (message.from === 'status@broadcast') {
            res.status(200).send('Ignored: status update');
            return;
        }

        const phone_number = message.from;
        
        // 1. Fetch DB settings
        const config = await getBotSettings(phone_number);
        const cooldown_seconds = config.cooldown_seconds || 60;
        const system_prompt = config.system_prompt;

        // 2. Cooldown & Manual Takeover Check
        const chatHistory = await getChatHistory(phone_number);
        if (chatHistory.length > 0) {
            const lastMessage = chatHistory[chatHistory.length - 1];
            
            if (lastMessage.from_me) {
                const now = new Date();
                const lastMsgTime = new Date(lastMessage.created_at);
                const diffSeconds = (now.getTime() - lastMsgTime.getTime()) / 1000;
                
                // If last message was sent by human (from_me) and it's within cooldown, abort AI response
                if (diffSeconds < cooldown_seconds) {
                    console.log(`[Cooldown] Aborting AI response. Time elapsed: ${diffSeconds}s < ${cooldown_seconds}s.`);
                    res.status(200).send('Aborted: Human in cooldown window');
                    return;
                }
            }
        }

        // If it was just an outgoing message that the webhook picked up, we just log it and do NOT trigger AI
        if (message.fromMe) {
            await saveMessage(phone_number, 'assistant', message.body || '[Media/Outgoing]', true);
            res.status(200).send('Logged outgoing message');
            return;
        }

        // 3. Multimodal & Media Handling
        let textContent = message.body;
        let imageUrl: string | undefined = undefined;

        if (message.hasMedia) {
            // NOTE: Here you would download the media file using WAHA endpoints or parse the base64 from the payload.
            // For example, if it's an audio note:
            if (message.type === 'ptt' || message.type === 'audio') {
                // Pseudo-code to save the audio file locally and run whisper
                console.log('Received audio message, needs processing');
                // const audioFilePath = await waha.downloadMedia(message.id);
                // textContent = await transcribeAudio(audioFilePath);
            } 
            else if (message.type === 'image') {
                console.log('Received image message, needs processing');
                // const savedImageUrl = await waha.getOrDownloadImage(message.id);
                // imageUrl = savedImageUrl;
                
                // For demonstration, simulating Vision input:
                // textContent = textContent ? textContent : ""; // keep caption if any
            }
        }

        // Ensure we have some text or image to send to the AI
        if (!textContent && !imageUrl) {
            res.status(200).send('No text or media content recognized');
            return;
        }

        // Save incoming user message
        await saveMessage(phone_number, 'user', textContent, false, imageUrl);

        // 4. Trigger typing effect
        await startTyping(phone_number);

        // 5. Generate AI Response
        const aiMessage = await generateResponse(
            system_prompt,
            chatHistory,
            textContent,
            imageUrl
        );

        if (!aiMessage) {
            res.status(500).send('Failed to generate AI response');
            return;
        }

        // 6. Handle Function Calling or Standard Reply
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
            for (const toolCall of aiMessage.tool_calls) {
                if (toolCall.function.name === 'notify_admin_custom_lead') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`[TOOL] Notifying Admin Custom Lead:`, args);
                    // Implement logic to notify admin (e.g. email, DB insert, or broadcast to admin WA number)
                } 
                else if (toolCall.function.name === 'register_clinic') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`[TOOL] Registering Clinic:`, args);
                    // Implement logic to register clinic in Supabase
                }
            }
            // Sending a fallback text if tool was called and model didn't return content
            if (!aiMessage.content) {
                // Sometimes models return only tool calls. You could follow up the tool output,
                // but for a 1-step logic we can manually send a predefined response:
                await sendText(phone_number, "Safi, rani qiyyadt dakchi! (Done, I noted that!)");
                await saveMessage(phone_number, 'assistant', "Safi, rani qiyyadt dakchi! (Done, I noted that!)", true);
            }
        }
        
        if (aiMessage.content) {
            // Send standard text
            await sendText(phone_number, aiMessage.content);
            // Save outgoing message
            await saveMessage(phone_number, 'assistant', aiMessage.content, true);
        }

        res.status(200).send('Success');
        
    } catch (error) {
        console.error('[Webhook Error]', error);
        res.status(500).send('Internal Server Error');
    }
};
