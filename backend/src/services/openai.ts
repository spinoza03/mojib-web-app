import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const TOOLS = [
    {
        type: "function" as const,
        function: {
            name: "notify_admin_custom_lead",
            description: "Sends Lead Data (name, phone, clinic, city) to the management endpoint or registers a custom lead.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    phone: { type: "string" },
                    clinic: { type: "string" },
                    city: { type: "string" }
                },
                required: ["name", "phone"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "register_clinic",
            description: "Registers the clinic in the system.",
            parameters: {
                type: "object",
                properties: {
                    clinic_name: { type: "string" },
                    owner_name: { type: "string" },
                    contact_number: { type: "string" }
                },
                required: ["clinic_name"]
            }
        }
    }
];

export const DOCTOR_TOOLS = [
    {
        type: "function" as const,
        function: {
            name: "check_availability",
            description: "Use this tool to fetch a list of already booked (busy) appointment times for a doctor on a specific date. You MUST provide the date in YYYY-MM-DD format and the doctor_id. Use the results to identify gaps in the schedule for the patient.",
            parameters: {
                type: "object",
                properties: {
                    doctor_id: { type: "string" },
                    start_date_time: { type: "string", description: "Format: YYYY-MM-DD 00:00:00+00" }
                },
                required: ["doctor_id", "start_date_time"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "book_appointment",
            description: "Use this tool ONLY after the patient has clearly confirmed a specific time slot. It creates a new appointment in the database.",
            parameters: {
                type: "object",
                properties: {
                    doctor_id: { type: "string" },
                    start_date_time: { type: "string", description: "Format: YYYY-MM-DD HH:mm:ss+00" },
                    patient_phone: { type: "string" },
                    patient_name: { type: "string" },
                    reason: { type: "string" }
                },
                required: ["doctor_id", "start_date_time", "patient_phone", "patient_name", "reason"]
            }
        }
    }
];

export async function transcribeAudio(audioFilePath: string): Promise<string | null> {
    try {
        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioFilePath),
            model: 'whisper-1',
        });
        return response.text;
    } catch (error) {
        console.error('[OpenAI] Error transcribing audio:', error);
        return null;
    }
}

export async function generateResponse(
    systemPrompt: string,
    patientPhone: string,
    chatHistory: any[],
    newMessage: string,
    imageUrl?: string,
    toolsList: any[] = TOOLS
) {
    const dynamicPrompt = `${systemPrompt}\n\n[PATIENT INFO]\nThe patient is messaging you from the WhatsApp number: ${patientPhone}. If they ask you to use their current number to book, DO NOT ask them to type it again. You already know it is exactly ${patientPhone}.`;

    const messages: any[] = [
        { role: 'system', content: dynamicPrompt }
    ];

    // Add history
    for (const msg of chatHistory) {
        messages.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        });
    }

    // Add current message
    if (imageUrl) {
        messages.push({
            role: 'user',
            content: [
                { type: "text", text: newMessage || "Analyze this image in the context of a medical/beauty clinic inquiry." },
                {
                    type: "image_url",
                    image_url: {
                        url: imageUrl,
                    },
                },
            ],
        });
    } else {
        messages.push({ role: 'user', content: newMessage });
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Using GPT-4o-mini as requested
            messages: messages,
            tools: toolsList,
            tool_choice: "auto",
        });

        return response.choices[0].message;

    } catch (error) {
        console.error('[OpenAI] Error generating response:', error);
        return null;
    }
}

export async function generateDoctorResponse(
    systemPrompt: string,
    patientPhone: string,
    chatHistory: any[],
    newMessage: string,
    imageUrl?: string
) {
    const now = new Date();
    // Use proper zero-padded formats 
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    
    const temporalContext = `[TEMPORAL CONTEXT] Today's Date: ${yyyy}-${mm}-${dd} (YYYY-MM-DD) Today's Day: ${now.toLocaleDateString('en-US', {weekday: 'long'})} Current Time: ${now.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'})}\n`;
    
    const fullSystemPrompt = temporalContext + systemPrompt;
    
    return generateResponse(fullSystemPrompt, patientPhone, chatHistory, newMessage, imageUrl, DOCTOR_TOOLS);
}
