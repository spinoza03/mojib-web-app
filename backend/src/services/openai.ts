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
    chatHistory: any[],
    newMessage: string,
    imageUrl?: string
) {
    const messages: any[] = [
        { role: 'system', content: systemPrompt }
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
            tools: TOOLS,
            tool_choice: "auto",
        });

        return response.choices[0].message;

    } catch (error) {
        console.error('[OpenAI] Error generating response:', error);
        return null;
    }
}
