import { Request, Response } from 'express';
import {
    getBotSettings,
    getChatHistory,
    saveMessage,
    getClinicBotSettingsBySession,
    checkAvailability,
    bookAppointment,
    getRealEstatePropertiesForPrompt,
    searchRealEstateProperties,
    getRealEstatePropertyPhotos,
    bookRealEstatePropertyVisit
} from '../services/supabase';
import { generateResponse, generateDoctorResponse, transcribeAudio, DOCTOR_TOOLS, REAL_ESTATE_TOOLS } from '../services/openai';
import { sendText, startTyping, downloadMedia, sendImage } from '../services/waha';
import OpenAI from 'openai';

// Interface based on WAHA webhook payload structure
interface WAMessage {
    id: string;
    timestamp: number;
    from: string; // phone number e.g. 212xxxxxxxxx@c.us
    to: string;
    body: string;
    hasMedia: boolean;
    fromMe: boolean;
    type: string;
    _data?: {
        type?: string;
        [key: string]: any;
    };
    media?: {
        url?: string;
        mimetype?: string;
    };
}

export const wahaWebhookHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const payload = req.body;
        console.log("-------------------");
        console.log("Incoming Webhook Payload Event:", payload.event);
        console.log("Payload:", JSON.stringify(payload, null, 2));
        console.log("-------------------");

        // WAHA sends events as 'message' (not 'message.upsert')
        if (payload.event !== 'message') {
            res.status(200).send('Not a message event');
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
        let isDoctorBot = false;
        let config: any = null;
        let sessionName: string | undefined = undefined;

        // payload.session has the exact unique session name for this clinic
        if (payload.session) {
            config = await getClinicBotSettingsBySession(payload.session);
        }

        // If clinic config is activated for this number, we check their subscription
        if (config) {
            const isTrial = config.subscription_status === 'trial';
            const isActive = config.subscription_status === 'active' || config.subscription_status === 'pro';
            // Note: to accurately check trial expiration, we assume the frontend/backend sync handles it, 
            // but if it's explicitly 'expired', we block it entirely.
            if (!isTrial && !isActive) {
                console.log(`[Subscription Expired] Ignoring message for session: ${config.waha_session_name}`);
                res.status(200).send('Ignored: Subscription Expired');
                return;
            }
            isDoctorBot = true;
            sessionName = config.waha_session_name;
        } else {
            console.log(`[Unknown Session] No config found for session: ${payload.session}`);
            res.status(200).send('Ignored: Unknown session');
            return;
        }

        const cooldown_seconds = config.cooldown_seconds || 60;
        let system_prompt = config.system_prompt;

        // Immobilier: inject the real-estate catalogue into the prompt
        if (config.niche === 'immobilier') {
            const propertiesBlock = await getRealEstatePropertiesForPrompt(config.user_id);
            system_prompt = String(system_prompt || '').replace('{{uploaded_properties_list}}', propertiesBlock);
        }

        // 2. Cooldown & Manual Takeover Check
        const chatHistory = await getChatHistory(phone_number);
        if (chatHistory.length > 0) {
            const lastMessage = chatHistory[chatHistory.length - 1];
            
            if (lastMessage.from_me) {
                // If it was a human manual message (not 'assistant' role), trigger cooldown
                // If it was the AI ('assistant' role), do NOT trigger cooldown for the user's next message
                if (lastMessage.role !== 'assistant') {
                    const now = new Date();
                    const lastMsgTime = new Date(lastMessage.created_at);
                    const diffSeconds = (now.getTime() - lastMsgTime.getTime()) / 1000;
                    
                    if (diffSeconds < cooldown_seconds) {
                        console.log(`[Cooldown] Aborting AI response. Manual intervention detected within ${diffSeconds}s.`);
                        res.status(200).send('Aborted: Human in cooldown window');
                        return;
                    }
                }
            }
        }

        // 3. Handle Outgoing Messages (fromMe)
        // If it was an outgoing message, we need to check if it's the AI or a Human (Manual takeover).
        if (message.fromMe) {
            // Check if this message was JUST saved by the AI thread
            if (chatHistory.length > 0) {
                const lastMessage = chatHistory[chatHistory.length - 1];
                const now = new Date();
                const lastMsgTime = new Date(lastMessage.created_at);
                const diffSeconds = (now.getTime() - lastMsgTime.getTime()) / 1000;

                // If content matches and it was recent, it's the AI echoing back. Ignore to avoid duplicates.
                if (lastMessage.role === 'assistant' && lastMessage.content === message.body && diffSeconds < 5) {
                    res.status(200).send('Ignored: AI echo');
                    return;
                }
            }

            // Otherwise, it represents a manual message from a human agent on the phone.
            // We log it as 'manual' so we can detect it for the cooldown check in future runs.
            await saveMessage(phone_number, 'manual', message.body || '[Media/Outgoing]', true);
            res.status(200).send('Logged manual outgoing message');
            return;
        }

        // 3. Multimodal & Media Handling
        let textContent = message.body || '';
        let imageUrl: string | undefined = undefined;

        // Extract patient phone to pass to AI
        const patientPhone = phone_number.split('@')[0];

        if (message.hasMedia) {
            const mediaType = message._data?.type;
            if (mediaType === 'ptt' || mediaType === 'audio') {
                console.log('Received audio message, downloading...');
                let msgId = message.id;
                // Sometimes WAHA message.id is an object, but we mapped it to string in WAMessage. Let's ensure it's a string identifier.
                if (typeof msgId === 'object') {
                    msgId = (msgId as any)._serialized || (msgId as any).id;
                }
                const mediaRes = await downloadMedia(sessionName || '', msgId, 'ogg');
                if (mediaRes.filepath) {
                    const transcription = await transcribeAudio(mediaRes.filepath);
                    if (transcription) {
                        textContent = transcription;
                        console.log('Transcribed Audio:', textContent);
                        try { require('fs').unlinkSync(mediaRes.filepath); } catch(e) {}
                    }
                }
            } 
            else if (mediaType === 'image') {
                console.log('Received image message, downloading...');
                let msgId = message.id;
                if (typeof msgId === 'object') {
                    msgId = (msgId as any)._serialized || (msgId as any).id;
                }
                const mediaRes = await downloadMedia(sessionName || '', msgId, 'jpeg');
                if (mediaRes.buffer) {
                    const b64 = mediaRes.buffer.toString('base64');
                    imageUrl = `data:image/jpeg;base64,${b64}`;
                    console.log('Image converted to base64 successfully');
                }
            }
            else if (mediaType === 'video') {
                console.log('Received video message (Not supported by vision yet)');
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
        await startTyping(phone_number, sessionName);

        // 5. Generate AI Response
        const isRealEstateBot = config.niche === 'immobilier';
        let aiMessage = await (isDoctorBot
            ? generateDoctorResponse(system_prompt, patientPhone, chatHistory, textContent, imageUrl)
            : isRealEstateBot
                ? generateResponse(system_prompt, patientPhone, chatHistory, textContent, imageUrl, REAL_ESTATE_TOOLS)
                : generateResponse(system_prompt, patientPhone, chatHistory, textContent, imageUrl));

        if (!aiMessage) {
            res.status(500).send('Failed to generate AI response');
            return;
        }

        let finalResponseContent = aiMessage.content;
        // Immobilier: if the AI requests property photos, we send them first.
        let propertyPhotosToSend: string[] = [];

        // 6. Handle Function Calling
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
            const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            
            // Prepare a temporary conversation array just to inject the tool results
            const tempMessages: any[] = [
                { role: 'system', content: system_prompt },
                ...chatHistory.map(msg => ({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content })),
                { role: 'user', content: textContent },
                aiMessage // push the assistant's tool_call message
            ];

            for (const toolCall of aiMessage.tool_calls) {
                if (toolCall.function.name === 'notify_admin_custom_lead') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`[TOOL] Notifying Admin Custom Lead:`, args);
                    tempMessages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ status: "success" }) });
                } 
                else if (toolCall.function.name === 'register_clinic') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`[TOOL] Registering Clinic:`, args);
                    tempMessages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ status: "success" }) });
                }
                else if (toolCall.function.name === 'check_availability') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`[TOOL] Check Availability (${config.user_id}):`, args);
                    const availability = await checkAvailability(config.user_id, args.start_date_time);
                    tempMessages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(availability) });
                }
                else if (toolCall.function.name === 'book_appointment') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`[TOOL] Book Appointment (${config.user_id}):`, args);
                    const booking = await bookAppointment(config.user_id, args.start_date_time, args.patient_phone, args.patient_name, args.reason);
                    tempMessages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(booking) });
                }
                else if (toolCall.function.name === 'search_properties') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`[TOOL] Search Properties (${config.user_id}):`, args);
                    const result = await searchRealEstateProperties(config.user_id, args.criteria || {});
                    tempMessages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
                }
                else if (toolCall.function.name === 'get_property_photos') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`[TOOL] Get Property Photos (${config.user_id}):`, args);
                    const result = await getRealEstatePropertyPhotos(config.user_id, args.property_id);
                    if (result?.photos?.length) {
                        propertyPhotosToSend = result.photos;
                    }
                    tempMessages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
                }
                else if (toolCall.function.name === 'book_property_visit') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`[TOOL] Book Property Visit (${config.user_id}):`, args);
                    const result = await bookRealEstatePropertyVisit(
                        config.user_id,
                        args.property_id,
                        args.client_phone,
                        args.client_name,
                        args.start_time,
                        args.notes
                    );
                    tempMessages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
                }
            }

            // Request a new completion with the tool results appended
            try {
                const followUpResponse = await openaiClient.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: tempMessages,
                    tools: isDoctorBot ? DOCTOR_TOOLS : (isRealEstateBot ? REAL_ESTATE_TOOLS : undefined)
                });
                finalResponseContent = followUpResponse.choices[0].message.content;
            } catch (err) {
                console.error("[OpenAI] Follow-up Tool Error:", err);
            }

            // Fallback if the model fails the second call
            if (!finalResponseContent) {
                finalResponseContent = "Safi, rani qiyyadt dakchi! (Done!)";
            }
        }
        
        if (finalResponseContent) {
            if (propertyPhotosToSend?.length) {
                for (const photoUrl of propertyPhotosToSend.slice(0, 3)) {
                    await sendImage(phone_number, photoUrl, sessionName);
                }
            }
            // Send standard text using the dynamic sessionName
            await sendText(phone_number, finalResponseContent, sessionName);
            // Save outgoing message
            await saveMessage(phone_number, 'assistant', finalResponseContent, true);
        }

        res.status(200).send('Success');
        
    } catch (error) {
        console.error('[Webhook Error]', error);
        res.status(500).send('Internal Server Error');
    }
};
