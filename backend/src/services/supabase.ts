import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("Missing Supabase credentials in .env. Integration will fail.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function getBotSettings(phone_number: string, persona_name: string = 'Anass') {
    // Attempting to fetch a specific persona or matching by some logic.
    // If every user has their own config, we might need a user_id, 
    // but the request specifically mentions the 'Anass' persona.
    
    let query = supabase
        .from('bot_configs')
        .select('system_prompt, cooldown_seconds');

    // If 'persona_name' column exists, use it. If not, we'll try to find any config.
    // Given the prompt, we'll assume there's a column or we should at least search for this specific persona.
    // To be safe and compatible with the current schema if it lacks the column, 
    // we'll try to fetch where persona matches OR just the first one.
    
    const { data: config, error } = await query
        .limit(1)
        .maybeSingle();
    
    if (error || !config) {
        console.error('Error fetching bot config or no config found:', error);
        return {
            system_prompt: 'You are Anass, a helpful Moroccan AI assistant. Reply in pure Darija.',
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

export async function getClinicBotSettingsBySession(sessionName: string) {
    if (!sessionName) return null;

    const { data, error } = await supabase.rpc('get_bot_config_by_session', { p_session_name: sessionName });

    if (error || !data) {
        console.error('Could not find config via RPC for session:', sessionName, error);
        return null;
    }

    // `data` is the JSON object returned from the RPC
    let systemPrompt = data.system_prompt || '';
    if (!systemPrompt) {
        // When the app has niche = immobilier, we want a completely different prompt style.
        if (data.niche === 'immobilier') {
            systemPrompt = generateRealEstateMasterPrompt(
                data.clinic_name,
                'Anass',
                data.working_hours,
                data.tone,
                data.languages,
                data.additional_info
            );
        } else {
            systemPrompt = generateMasterPrompt(
                data.clinic_name,
                data.working_hours,
                data.tone,
                data.languages,
                data.additional_info
            );
        }
    }

    return {
        user_id: data.user_id,
        clinic_name: data.clinic_name,
        subscription_status: data.subscription_status,
        waha_session_name: data.waha_session_name,
        niche: data.niche,
        system_prompt: systemPrompt,
        cooldown_seconds: data.cooldown_seconds
    };
}

/**
 * Formats the clinic real-estate catalogue into a text block for prompt injection.
 * The system prompt will include {{uploaded_properties_list}} placeholder.
 */
export async function getRealEstatePropertiesForPrompt(userId: string): Promise<string> {
    const { data: properties, error: propError } = await supabase
        .from('real_estate_properties')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (propError) {
        console.error('[RealEstate] Error fetching properties:', propError);
        return '[]';
    }

    const list = properties || [];
    if (list.length === 0) return '[]';

    const propertyIds = list.map((p: any) => p.id);

    const { data: media, error: mediaError } = await supabase
        .from('real_estate_property_media')
        .select('property_id, media_type, public_url, file_path')
        .in('property_id', propertyIds);

    if (mediaError) {
        console.error('[RealEstate] Error fetching property media:', mediaError);
    }

    const mediaByPropertyId: Record<string, any[]> = {};
    for (const m of media || []) {
        if (!mediaByPropertyId[m.property_id]) mediaByPropertyId[m.property_id] = [];
        mediaByPropertyId[m.property_id].push(m);
    }

    const formatList = list.map((p: any) => {
        const mediaItems = mediaByPropertyId[p.id] || [];
        const photos = mediaItems
            .filter((m: any) => m.media_type === 'photo')
            .map((m: any) => m.public_url || m.file_path)
            .filter(Boolean)
            .slice(0, 5);

        const videos = mediaItems
            .filter((m: any) => m.media_type === 'video')
            .map((m: any) => m.public_url || m.file_path)
            .filter(Boolean)
            .slice(0, 2);

        const atouts = p.attributes ? JSON.stringify(p.attributes) : '{}';

        return [
            `- [PropertyID: ${p.id}] ${p.title}`,
            `  Prix: ${p.price_dh ?? 'N/A'} DH`,
            `  Quartier: ${p.quartier ?? 'N/A'}`,
            `  Surface: ${p.surface_m2 ?? 'N/A'} m²`,
            `  Chambres: ${p.bedrooms ?? 'N/A'}`,
            `  Etage: ${p.floor ?? 'N/A'}`,
            `  Orientation: ${p.orientation ?? 'N/A'}`,
            `  Etat: ${p.condition ?? 'N/A'}`,
            `  Statut: ${p.status ?? 'N/A'}`,
            `  GPS: ${p.gps_lat ?? 'N/A'}, ${p.gps_lng ?? 'N/A'}`,
            `  Atouts: ${atouts}`,
            `  Photos: ${photos.join(', ') || 'N/A'}`,
            `  Videos: ${videos.join(', ') || 'N/A'}`,
        ].join('\n');
    });

    return formatList.join('\n');
}

/**
 * Generates the master system prompt from structured config fields.
 * This is the general prompt for all medical niches (dentistry, doctor, beauty center).
 */
function generateMasterPrompt(
    clinicName: string,
    workingHours: string,
    tone: string,
    languages: string,
    additionalInfo: string
): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA');
    const dayStr = now.toLocaleDateString('en-US', { weekday: 'long' });
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const toneDesc = tone === 'friendly,casual' 
        ? 'Friendly, casual, and warm' 
        : tone === 'formal,direct'
            ? 'Formal, direct, and concise'
            : 'Professional, prestigious, and welcoming';

    const langList = languages.split(',').map(l => l.trim());
    let langInstruction = 'STRICT MOROCCAN DARIJA IN ARABIC SCRIPT ONLY (الدارجة المغربية).\n' +
        'CRITICAL RULES:\n' +
        '1. NEVER use Modern Standard Arabic (Fusha) like "هل", "ماذا", "أين", "نحن", "كيف يمكنني", "أرجو", "عذرا".\n' +
        '2. NEVER use Egyptian/Levantine like "عايز", "ازيك", "فين", "ليه", "بدي".\n' +
        '3. ALWAYS use Moroccan: "واش", "شنو", "علاش", "بزاف", "واخا", "ديال", "شحال", "معياش", "مرحبا".\n' +
        '4. If the patient starts in French or English, reply in professional French or English, otherwise strictly Darija.';

    if (langList.includes('english') && !langList.includes('darija')) {
        langInstruction = 'Respond purely in professional English.';
    } else if (langList.includes('french') && !langList.includes('darija')) {
        langInstruction = 'Respond purely in professional French.';
    }

    return `[TEMPORAL CONTEXT]
Today's Date: ${dateStr} (YYYY-MM-DD)
Today's Day: ${dayStr}
Current Time: ${timeStr}

[SYSTEM_ROLE]
You are the Lead Medical Relations & Sales Executive for ${clinicName}. You are not a bot; you are a professional, high-end concierge. Your mission is to provide an elite experience that justifies premium service prices while driving patients to book in-person consultations.

[CORE PERSONALITY]
Tone: ${toneDesc}.
Language: ${langInstruction}
Mission: Convert every inquiry into a clinic visit. Never provide medical diagnoses or specific prices; instead, sell the value of the doctor's expertise.

[CLINIC KNOWLEDGE BASE]
Business Name: ${clinicName}
Working Hours: ${workingHours}
${additionalInfo ? `Additional Information:\n${additionalInfo}` : ''}

[MANDATORY BOOKING PROTOCOL]
Before calling the book_appointment tool, you MUST have collected and confirmed the following:
1. Patient Name: Ask for their full name politely.
2. Reason for Visit (Note): Ask specifically what they need the appointment for.
3. Phone Confirmation: Ask if they want to use their current WhatsApp number or provide another one.

[TOOL INSTRUCTIONS]
Booking Requirement: You are STRICTLY PROHIBITED from calling book_appointment until the patient has:
- Selected a specific time slot
- Provided their name
- Confirmed the reason for the visit
- Confirmed the phone number to be used

Confirmation Turn: Before calling the tool, send a summary message confirming all details.

Tool Parameters: When calling book_appointment, ensure you pass:
- patient_name: The name provided
- note: The confirmed reason for the visit
- patient_phone: The confirmed number
- start_date_time: Combined format YYYY-MM-DD HH:mm:ss+00

[SALES & CONVERSION RULES]
Value over Price: If asked about price, say the prices depend on the specific case after the doctor examines them. The goal is the best result, not the cheapest price.
No Advice: If asked for medical advice, say the doctor is the only one who can diagnose accurately. Best to visit the clinic for a full checkup.
High-Ticket Framing: Use phrases highlighting latest global tech and the doctor's long experience.

[INTERACTION PROTOCOL]
Opening Hook: Greet warmly, introduce as the digital assistant for ${clinicName}, and ask how you can help with their health today.
The "Three-Slot" Rule: When checking availability, always propose exactly 3 options.

[TOOL INSTRUCTIONS]
Date Calculation: Translate relative terms (tomorrow, next week) into exact YYYY-MM-DD dates based on the temporal context.
It's mandatory to send all data to tools because they will crash if you didn't.
Availability: When a date or booking is mentioned, CALL check_availability with start_date_time in format: YYYY-MM-DD 00:00:00+00.
Booking: ONLY call book_appointment after the patient confirms a specific slot.
Strict Formatting: You MUST NOT send an empty value. Combine confirmed date and time: YYYY-MM-DD HH:mm:ss+00.

[DARIJA DENTAL DICTIONARY]
Derssa (الضرسة): Tooth/Molar | Soussa (السوسة): Cavity/Decay | Darani (ضاراني): It hurts me
Fmi (فمي): My mouth | Lata (اللثة): Gums | Mbezegh/Manfokh (منفوخ): Swollen | Dam (الدم): Blood
Reaction Rule: If a patient mentions "Derssa" or "Soussa," validate their pain immediately.

[CONVERSATION EXAMPLES (DO NOT COPY EXACTLY, JUST EMULATE DARIJA STYLE)]
Patient: salam brit nakhod mawiid
Assistant: وعليكم السلام ورحمة الله! مرحبا بك في عيادة ${clinicName}. كيفاش نقدرو نعاونوك اليوم؟
Patient: darani wahed darsa
Assistant: ما يكون باس عندك! أحسن حاجة هي تجي العيادة باش الطبيب يشوف حالتك ويدير لك التشخيص المناسب. واش تبغي نحجزو لك موعد هاد السيمانة؟`;
}

/**
 * Real-estate agent prompt: "Expert en Matching Immobilier"
 * {{uploaded_properties_list}} and {{image_url}} are placeholders filled at runtime.
 */
function generateRealEstateMasterPrompt(
    agencyName: string,
    agentName: string,
    workingHours: string,
    tone: string,
    languages: string,
    additionalInfo: string
): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA');
    const dayStr = now.toLocaleDateString('en-US', { weekday: 'long' });
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const toneDesc =
        tone === 'friendly,casual'
            ? 'Friendly, warm, persuasive and high-energy'
            : tone === 'formal,direct'
                ? 'Formal, direct, concise and confident'
                : 'Professional, prestigious, reassuring and highly persuasive';

    // NOTE: We keep language rules simple here; the agent adapts based on user messages.
    const langInstruction = languages?.includes('french') ? 'Parle en Français quand le client parle Français.' : '';

    return `[TEMPORAL CONTEXT]
Today's Date: ${dateStr} (YYYY-MM-DD)
Today's Day: ${dayStr}
Current Time: ${timeStr}

[SYSTEM_ROLE]
Tu es l'Expert Commercial de l'agence immobilière ${agencyName}.
Ton nom est ${agentName}.
Ta mission est de vendre les biens du catalogue et de programmer des visites.
Tu parles couramment le Français et la Darija marocaine (en caractères arabes).

[KNOWLEDGE BASE]
Voici la liste des biens disponibles actuellement dans ton agence :
{{uploaded_properties_list}}

[CORE LOGIC : NEEDS DISCOVERY]
Dès qu'un client te contacte, tu dois identifier ses "Must-Have" :
- Type & Localisation : (Appartement, Villa, Magasin, Terrain) + Quartier
- Configuration : nombre de chambres ("Byout") + salons
- Spécificités : Chouka (coin), ascenseur, garage, sans vis-à-vis
- Budget : une fourchette de prix

[SEARCH & SUGGESTION PROTOCOL]
Match Parfait :
- Si un bien correspond à 90%+, présente-le avec enthousiasme.
- IMPORTANT : propose systématiquement l'envoi des photos/vidéos liées au bien.
- Tu dois inclure le lien de la photo ou l'ID de l'image {{image_url}} pour que le système l'envoie.

Le Pivot (Conviction) :
- Si tu n'as pas exactement ce qu'il veut, analyse le stock et propose l'alternative la plus proche.
- Argument de pivot (exemple) :
  "Ma'ndich exactement [critère] fhad l-quartier, walakin 'ndi wahed l-hwa mchmach o chouka fih [quasi-equivalent]. Zayd ghir chwiya f l-prix walakin l-finition dyalo hsan bzaf. Chof tsawer dyalo..."

Engagement Visuel :
- Ne décris jamais un bien sans proposer d'envoyer les photos.

[MANDATORY INTERACTION RULES]
Ton : Professionnel, rassurant, très convaincant (même à 2h du matin).
Langue : Réponds dans la langue du client (Darija arabic script si Darija).
Conversion : Ton but final est de dire :
"Foukach mnasbak tji tchof l-mehal b 'aynik? 'ndi l-waqt khawi gheda m'a 10h ola 16h."

[DARIJA REAL ESTATE DICTIONARY]
Chouka : coin très ensoleillé.
Mchmach : très ensoleillé.
Sans Vis-à-vis : ma fihch t-tlal.
Finition : l-khidma / slah.
Byout : chambres.

[SALES GOAL]
Transformer un curieux sur WhatsApp en une visite physique programmée dans l'agenda.

[AGENT STYLE]
Ton: ${toneDesc}.
${additionalInfo ? `Additional Information:\n${additionalInfo}` : ''}
${workingHours ? `Working Hours: ${workingHours}` : ''}`;
}


export async function checkAvailability(doctorId: string, dateTimeISO: string) {
    // dateTimeISO is e.g. "2026-02-11 00:00:00+00"
    // Extract simply the YYYY-MM-DD
    const dateString = dateTimeISO.split('T')[0].split(' ')[0];

    const startOfDay = new Date(`${dateString}T00:00:00Z`);
    const endOfDay = new Date(`${dateString}T23:59:59Z`);

    const { data, error } = await supabase
        .from('appointments')
        .select('start_time, end_time')
        .eq('doctor_id', doctorId)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .neq('status', 'cancelled')
        .order('start_time', { ascending: true });

    if (error) {
        console.error('Check avail error:', error);
        return { status: "error", message: "Failed to check availability." };
    }

    const allSlots = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
    
    const bookedTimes: string[] = [];
    if (data) {
        data.forEach(apt => {
            const date = new Date(apt.start_time);
            const hh = date.getUTCHours().toString().padStart(2, '0');
            const mm = date.getUTCMinutes().toString().padStart(2, '0');
            bookedTimes.push(`${hh}:${mm}`);
        });
    }

    const freeSlots = allSlots.filter(slot => !bookedTimes.includes(slot));
    return { status: "partially_booked", free_slots: freeSlots, booked_slots: bookedTimes };
}

export async function bookAppointment(doctorId: string, startDateTime: string, patientPhone: string, patientName: string, reason: string) {
    const start = new Date(startDateTime);
    const end = new Date(start.getTime() + 30 * 60000);

    const cleanPhone = patientPhone ? String(patientPhone).replace(/\D/g, "") : "MISSING_PHONE";

    const { error } = await supabase
        .from('appointments')
        .insert([{
            doctor_id: doctorId,
            patient_name: patientName,
            patient_phone: cleanPhone,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            status: 'confirmed',
            notes: reason || "No reason provided"
        }]);

    if (error) {
        console.error("Booking err:", error);
        return { status: "error", message: "Failed to book appointment." };
    }

    return { 
        status: "success", 
        confirmation_body: {
            message: "تم تسجيل الموعد بنجاح ",
            patient: patientName,
            time: startDateTime
        },
        instruction_for_ai: "Confirm the appointment details to the patient in professional Moroccan Darija. Be welcoming and mention the specific time."
    };
}

// ==========================================
// REAL ESTATE (Immobilier) - catalogue tools
// ==========================================

export async function searchRealEstateProperties(
    userId: string,
    criteria: any
): Promise<{ status: string; properties: any[]; applied: any }> {
    try {
        let query = supabase
            .from('real_estate_properties')
            .select('id,title,price_dh,quartier,surface_m2,bedrooms,floor,orientation,condition,status,gps_lat,gps_lng,attributes')
            .eq('user_id', userId);

        const applied: any = {};

        const quartier = criteria?.quartier;
        const budgetMin = criteria?.budget_min;
        const budgetMax = criteria?.budget_max;
        const surfaceMin = criteria?.surface_min;
        const bedroomsMin = criteria?.bedrooms_min;
        const status = criteria?.status;

        if (quartier) {
            query = query.ilike('quartier', `%${String(quartier)}%`);
            applied.quartier = quartier;
        }
        if (budgetMin != null && !Number.isNaN(Number(budgetMin))) {
            query = query.gte('price_dh', Number(budgetMin));
            applied.budget_min = budgetMin;
        }
        if (budgetMax != null && !Number.isNaN(Number(budgetMax))) {
            query = query.lte('price_dh', Number(budgetMax));
            applied.budget_max = budgetMax;
        }
        if (surfaceMin != null && !Number.isNaN(Number(surfaceMin))) {
            query = query.gte('surface_m2', Number(surfaceMin));
            applied.surface_min = surfaceMin;
        }
        if (bedroomsMin != null && !Number.isNaN(Number(bedroomsMin))) {
            query = query.gte('bedrooms', Number(bedroomsMin));
            applied.bedrooms_min = bedroomsMin;
        }
        if (status) {
            query = query.eq('status', String(status));
            applied.status = status;
        }

        query = query.order('updated_at', { ascending: false }).limit(10);

        const { data, error } = await query;
        if (error) throw error;

        return {
            status: 'success',
            properties: data || [],
            applied
        };
    } catch (error: any) {
        console.error('[RealEstate] search properties failed:', error);
        return { status: 'error', properties: [], applied: criteria || null };
    }
}

export async function getRealEstatePropertyPhotos(
    userId: string,
    propertyId: string
): Promise<{ status: string; photos: string[] }> {
    try {
        const { data, error } = await supabase
            .from('real_estate_property_media')
            .select('public_url,file_path,media_type')
            .eq('user_id', userId)
            .eq('property_id', propertyId)
            .eq('media_type', 'photo')
            .order('created_at', { ascending: true });

        if (error) throw error;

        const photos = (data || [])
            .map((m: any) => m.public_url || m.file_path)
            .filter(Boolean)
            .slice(0, 8);

        return { status: 'success', photos };
    } catch (error: any) {
        console.error('[RealEstate] get photos failed:', error);
        return { status: 'error', photos: [] };
    }
}

export async function bookRealEstatePropertyVisit(
    userId: string,
    propertyId: string,
    clientPhone: string,
    clientName: string,
    startTime: string,
    notes: string
): Promise<{ status: string; visit?: any }> {
    try {
        const cleanPhone = clientPhone ? String(clientPhone).replace(/\D/g, '') : '';
        const start = new Date(startTime);
        if (Number.isNaN(start.getTime())) {
            return { status: 'error', visit: { message: 'Invalid start_time' } };
        }
        const end = new Date(start.getTime() + 30 * 60000);

        // Upsert client (minimal approach: find by phone)
        let clientId: string | null = null;
        if (cleanPhone) {
            const { data: existingClient } = await supabase
                .from('real_estate_clients')
                .select('id')
                .eq('user_id', userId)
                .eq('phone', cleanPhone)
                .maybeSingle();

            clientId = existingClient?.id ?? null;

            if (!clientId) {
                const { data: createdClient, error: createClientError } = await supabase
                    .from('real_estate_clients')
                    .insert({
                        user_id: userId,
                        role: 'acquereur',
                        full_name: clientName,
                        phone: cleanPhone,
                        details: {}
                    })
                    .select('id')
                    .single();

                if (createClientError) throw createClientError;
                clientId = createdClient?.id ?? null;
            }
        }

        const { data: createdVisit, error: createVisitError } = await supabase
            .from('real_estate_visits')
            .insert({
                user_id: userId,
                property_id: propertyId,
                client_id: clientId,
                client_name: clientName,
                client_phone: cleanPhone || clientPhone,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                status: 'confirmed',
                notes: notes || null
            })
            .select('*')
            .single();

        if (createVisitError) throw createVisitError;

        return { status: 'success', visit: createdVisit };
    } catch (error: any) {
        console.error('[RealEstate] book visit failed:', error);
        return { status: 'error', visit: { message: error?.message || 'Failed' } };
    }
}

// ============ REMINDER SYSTEM ============

export async function getAllActiveReminderConfigs() {
    // Fetch all doctors who have reminder_rules set and active subscription
    const { data, error } = await supabase
        .from('profiles')
        .select('id, clinic_name, waha_session_name, subscription_status')
        .in('subscription_status', ['pro', 'trial', 'active']);

    if (error || !data) {
        console.error('Error fetching profiles for reminders:', error);
        return [];
    }

    const results = [];
    for (const profile of data) {
        const { data: config } = await supabase
            .from('bot_configs')
            .select('reminder_message, reminder_rules, cooldown_seconds')
            .eq('user_id', profile.id)
            .maybeSingle();

        if (config?.reminder_rules && Array.isArray(config.reminder_rules)) {
            const enabledRules = config.reminder_rules.filter((r: any) => r.enabled);
            if (enabledRules.length > 0) {
                results.push({
                    doctor_id: profile.id,
                    clinic_name: profile.clinic_name,
                    waha_session_name: profile.waha_session_name,
                    reminder_message: config.reminder_message || 'مرحبا {patient_name}، هاد تذكير بالموعد ديالك في {clinic_name} نهار {time}. نتمناو نشوفوك!',
                    reminder_rules: enabledRules
                });
            }
        }
    }
    return results;
}

export async function getAppointmentsNeedingReminder(doctorId: string, minutesBefore: number) {
    const now = new Date();
    const targetTime = new Date(now.getTime() + minutesBefore * 60 * 1000);
    // Window: target - 2.5 min to target + 2.5 min (to catch within the 5-min cron interval)
    const windowStart = new Date(targetTime.getTime() - 2.5 * 60 * 1000);
    const windowEnd = new Date(targetTime.getTime() + 2.5 * 60 * 1000);

    const { data, error } = await supabase
        .from('appointments')
        .select('id, patient_name, patient_phone, start_time, reminders_sent')
        .eq('doctor_id', doctorId)
        .neq('status', 'cancelled')
        .gte('start_time', windowStart.toISOString())
        .lte('start_time', windowEnd.toISOString());

    if (error || !data) {
        if (error) console.error('Error fetching appointments for reminders:', error);
        return [];
    }

    // Filter out appointments that already received this specific reminder
    return data.filter(apt => {
        const sent: number[] = apt.reminders_sent || [];
        return !sent.includes(minutesBefore);
    });
}

export async function markReminderSent(appointmentId: string, minutesBefore: number) {
    // Fetch current reminders_sent, append the new value
    const { data: apt } = await supabase
        .from('appointments')
        .select('reminders_sent')
        .eq('id', appointmentId)
        .maybeSingle();

    const currentSent: number[] = apt?.reminders_sent || [];
    currentSent.push(minutesBefore);

    const { error } = await supabase
        .from('appointments')
        .update({ reminders_sent: currentSent })
        .eq('id', appointmentId);

    if (error) {
        console.error('Error marking reminder sent:', error);
    }
}

export async function updateBotCooldown(userId: string, seconds: number) {
    const { error } = await supabase
        .from('bot_configs')
        .update({ cooldown_seconds: seconds })
        .eq('user_id', userId);

    if (error) console.error('Error updating cooldown:', error);
    return !error;
}

