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
                    start_date_time: { type: "string", description: "Format: YYYY-MM-DD (just the date, no time needed)" }
                },
                required: ["doctor_id", "start_date_time"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "book_appointment",
            description: "Use this tool ONLY after the patient has clearly confirmed a specific time slot. It creates a new appointment in the database. Times are in the clinic's local timezone.",
            parameters: {
                type: "object",
                properties: {
                    doctor_id: { type: "string" },
                    start_date_time: { type: "string", description: "Format: YYYY-MM-DD HH:mm:ss (in the clinic's local timezone, no +00 offset)" },
                    patient_phone: { type: "string" },
                    patient_name: { type: "string" },
                    reason: { type: "string" }
                },
                required: ["doctor_id", "start_date_time", "patient_phone", "patient_name", "reason"]
            }
        }
    }
];

export const REAL_ESTATE_TOOLS = [
    {
        type: "function" as const,
        function: {
            name: "search_properties",
            description: "Search the agency real-estate catalogue and return the best matching properties. Use when the user provides criteria (quartier, budget, surface, bedrooms, status).",
            parameters: {
                type: "object",
                properties: {
                    criteria: {
                        type: "object",
                        description: "User criteria extracted from the conversation.",
                        properties: {
                            quartier: { type: "string" },
                            budget_min: { type: "number" },
                            budget_max: { type: "number" },
                            surface_min: { type: "number" },
                            bedrooms_min: { type: "number" },
                            status: { type: "string", description: "Disponible, Réservé, Vendu, Loué" }
                        },
                        required: []
                    }
                },
                required: ["criteria"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_property_photos",
            description: "Fetch photo URLs for a specific property so you can send them to the client.",
            parameters: {
                type: "object",
                properties: {
                    property_id: { type: "string" }
                },
                required: ["property_id"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "book_property_visit",
            description: "Book a real-estate property visit (creates a record in real_estate_visits). Use only after user confirms a time and provides name + phone.",
            parameters: {
                type: "object",
                properties: {
                    property_id: { type: "string" },
                    client_phone: { type: "string" },
                    client_name: { type: "string" },
                    start_time: { type: "string", description: "ISO string or YYYY-MM-DD HH:mm:ss+00" },
                    notes: { type: "string" }
                },
                required: ["property_id", "client_phone", "client_name", "start_time", "notes"]
            }
        }
    }
];

export const RESTAURANT_TOOLS = [
    {
        type: "function" as const,
        function: {
            name: "get_menu",
            description: "Retrieve the full restaurant menu grouped by category. Use when the client asks to see the menu, what's available, or asks about specific dishes.",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "place_order",
            description: "Place a new order for the client. Only call this AFTER confirming all items, customizations, quantities, and delivery details with the client.",
            parameters: {
                type: "object",
                properties: {
                    customer_phone: { type: "string", description: "Client phone number" },
                    customer_name: { type: "string", description: "Client full name" },
                    delivery_address: { type: "string", description: "Delivery address (empty for pickup/dine-in)" },
                    order_type: { type: "string", description: "delivery, pickup, or dine_in", enum: ["delivery", "pickup", "dine_in"] },
                    items: {
                        type: "array",
                        description: "Array of items to order",
                        items: {
                            type: "object",
                            properties: {
                                item_name: { type: "string", description: "Name of the menu item" },
                                quantity: { type: "number", description: "Quantity ordered" },
                                customizations: { type: "string", description: "Special requests e.g. 'sans oignons, extra fromage'" }
                            },
                            required: ["item_name", "quantity"]
                        }
                    },
                    notes: { type: "string", description: "General order notes" }
                },
                required: ["customer_phone", "customer_name", "items"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "check_item_availability",
            description: "Check if a specific menu item is currently available. Use when the client asks if something is in stock.",
            parameters: {
                type: "object",
                properties: {
                    item_name: { type: "string", description: "Name of the item to check (fuzzy match)" }
                },
                required: ["item_name"]
            }
        }
    }
];

export async function transcribeAudio(audioFilePath: string): Promise<string | null> {
    try {
        const response = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioFilePath),
            model: 'whisper-1',
            prompt: 'Darija Moroccan Arabic: chouka, mchmach, byout, salon, chqqa, dar, villa, magasin, terrain, quartier, etage, garage, ascenseur, vis-à-vis, finition, khidma, salonat, hammam, bit, kouzina, marjan, acima, carrefour, derb, zanqa, hay, bloc, résidence, syndic, tabiya, moulkiya, notaire, compromis, taman, loyer, kafalat, contrat, simsar',
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
    const dynamicPrompt = `${systemPrompt}\n\n[CONTACT INFO]\nThe user is messaging you from the WhatsApp number: ${patientPhone}. If they ask you to use their current number to book, DO NOT ask them to type it again. You already know it is exactly ${patientPhone}.`;

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
                { type: "text", text: newMessage || "Analyze this image and respond based on the conversation context." },
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
            model: "gpt-5.4-mini", // Using gpt-5.4-mini as requested
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
    imageUrl?: string,
    timezone: string = 'Africa/Casablanca'
) {
    const now = new Date();
    // Format date/time in the clinic's timezone
    const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' });
    const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false });

    const dateStr = dateFormatter.format(now);
    const dayStr = dayFormatter.format(now);
    const timeStr = timeFormatter.format(now);

    const temporalContext = `[TEMPORAL CONTEXT] Today's Date: ${dateStr} (YYYY-MM-DD) Today's Day: ${dayStr} Current Time: ${timeStr} Timezone: ${timezone}\n[IMPORTANT] All appointment times MUST be in the clinic's timezone (${timezone}). When calling check_availability or book_appointment, use the format YYYY-MM-DD HH:mm:ss without any timezone offset — the system will interpret them in ${timezone}.\n`;

    const fullSystemPrompt = temporalContext + systemPrompt;

    return generateResponse(fullSystemPrompt, patientPhone, chatHistory, newMessage, imageUrl, DOCTOR_TOOLS);
}
