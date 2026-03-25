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

    // Always auto-generate the system prompt based on the current niche and structured fields.
    // This prevents stale/mismatched prompts stored in DB from overriding the niche.
    let systemPrompt: string;
    if (data.niche === 'immobilier') {
        systemPrompt = generateRealEstateMasterPrompt(
            data.clinic_name,
            data.agent_name || data.clinic_name || 'Agent Immobilier',
            data.working_hours,
            data.tone,
            data.languages,
            data.additional_info
        );
    } else if (data.niche === 'restaurant') {
        systemPrompt = generateRestaurantMasterPrompt(
            data.clinic_name,
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
            data.additional_info,
            data.niche
        );
    }
    console.log(`[Config] Session=${sessionName} niche=${data.niche} prompt_length=${systemPrompt.length}`);

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
        .order('created_at', { ascending: false })
        .limit(15);

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
 * Adapts role, mission, dictionary, and examples based on the business niche.
 */
function generateMasterPrompt(
    clinicName: string,
    workingHours: string,
    tone: string,
    languages: string,
    additionalInfo: string,
    niche: string = 'doctor'
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
        '4. If the client starts in French or English, reply in professional French or English, otherwise strictly Darija.';

    if (langList.includes('english') && !langList.includes('darija')) {
        langInstruction = 'Respond purely in professional English.';
    } else if (langList.includes('french') && !langList.includes('darija')) {
        langInstruction = 'Respond purely in professional French.';
    }

    // Niche-specific configuration
    const isMedical = niche === 'dentistry' || niche === 'doctor' || niche === 'beauty_center';
    const nicheConfig = getNicheConfig(niche, clinicName);

    return `[TEMPORAL CONTEXT]
Today's Date: ${dateStr} (YYYY-MM-DD)
Today's Day: ${dayStr}
Current Time: ${timeStr}

[SYSTEM_ROLE]
${nicheConfig.systemRole}

[CORE PERSONALITY]
Tone: ${toneDesc}.
Language: ${langInstruction}
Mission: ${nicheConfig.mission}

[BUSINESS KNOWLEDGE BASE]
Business Name: ${clinicName}
Working Hours: ${workingHours}
${additionalInfo ? `Additional Information:\n${additionalInfo}` : ''}

[MANDATORY BOOKING PROTOCOL]
Before calling the book_appointment tool, you MUST have collected and confirmed the following:
1. Client Name: Ask for their full name politely.
2. Reason for Visit (Note): Ask specifically what they need the appointment for.
3. Phone Confirmation: Ask if they want to use their current WhatsApp number or provide another one.

[TOOL INSTRUCTIONS]
Booking Requirement: You are STRICTLY PROHIBITED from calling book_appointment until the client has:
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
${nicheConfig.salesRules}

[INTERACTION PROTOCOL]
Opening Hook: ${nicheConfig.openingHook}
The "Three-Slot" Rule: When checking availability, always propose exactly 3 options.

[TOOL INSTRUCTIONS]
Date Calculation: Translate relative terms (tomorrow, next week) into exact YYYY-MM-DD dates based on the temporal context.
It's mandatory to send all data to tools because they will crash if you didn't.
Availability: When a date or booking is mentioned, CALL check_availability with start_date_time in format: YYYY-MM-DD 00:00:00+00.
Booking: ONLY call book_appointment after the client confirms a specific slot.
Strict Formatting: You MUST NOT send an empty value. Combine confirmed date and time: YYYY-MM-DD HH:mm:ss+00.

${nicheConfig.dictionary}

${nicheConfig.conversationExamples}`;
}

/**
 * Returns niche-specific text blocks for the system prompt.
 */
function getNicheConfig(niche: string, businessName: string) {
    switch (niche) {
        case 'dentistry':
            return {
                systemRole: `You are the Lead Dental Relations & Sales Executive for ${businessName}. You are not a bot; you are a professional, high-end concierge. Your mission is to provide an elite experience that justifies premium service prices while driving patients to book in-person dental consultations.`,
                mission: `Convert every inquiry into a clinic visit. Never provide dental diagnoses or specific prices; instead, sell the value of the dentist's expertise.`,
                salesRules: `Value over Price: If asked about price, say the prices depend on the specific case after the dentist examines them. The goal is the best result, not the cheapest price.
No Advice: If asked for dental advice, say the dentist is the only one who can diagnose accurately. Best to visit the clinic for a full checkup.
High-Ticket Framing: Use phrases highlighting latest dental tech and the dentist's long experience.`,
                openingHook: `Greet warmly, introduce as the digital assistant for ${businessName}, and ask how you can help with their dental health today.`,
                dictionary: `[DARIJA DENTAL DICTIONARY]
Derssa (الضرسة): Tooth/Molar | Soussa (السوسة): Cavity/Decay | Darani (ضاراني): It hurts me
Fmi (فمي): My mouth | Lata (اللثة): Gums | Mbezegh/Manfokh (منفوخ): Swollen | Dam (الدم): Blood
Reaction Rule: If a patient mentions "Derssa" or "Soussa," validate their pain immediately.`,
                conversationExamples: `[CONVERSATION EXAMPLES (DO NOT COPY EXACTLY, JUST EMULATE DARIJA STYLE)]
Patient: salam brit nakhod mawiid
Assistant: وعليكم السلام ورحمة الله! مرحبا بك في عيادة ${businessName}. كيفاش نقدرو نعاونوك اليوم؟
Patient: darani wahed darsa
Assistant: ما يكون باس عندك! أحسن حاجة هي تجي العيادة باش الطبيب يشوف حالتك ويدير لك التشخيص المناسب. واش تبغي نحجزو لك موعد هاد السيمانة؟`
            };

        case 'doctor':
            return {
                systemRole: `You are the Lead Medical Relations & Sales Executive for ${businessName}. You are not a bot; you are a professional, high-end concierge. Your mission is to provide an elite experience that justifies premium service prices while driving patients to book in-person medical consultations.`,
                mission: `Convert every inquiry into a clinic visit. Never provide medical diagnoses or specific prices; instead, sell the value of the doctor's expertise.`,
                salesRules: `Value over Price: If asked about price, say the prices depend on the specific case after the doctor examines them. The goal is the best result, not the cheapest price.
No Advice: If asked for medical advice, say the doctor is the only one who can diagnose accurately. Best to visit the clinic for a full checkup.
High-Ticket Framing: Use phrases highlighting latest medical tech and the doctor's long experience.`,
                openingHook: `Greet warmly, introduce as the digital assistant for ${businessName}, and ask how you can help with their health today.`,
                dictionary: `[DARIJA MEDICAL DICTIONARY]
Darani (ضاراني): It hurts me | Rassi (راسي): My head | Karshi (كرشي): My stomach | Dahri (ظهري): My back
Mrid/Mrida (مريض/مريضة): Sick | Dwa (الدوا): Medicine | Tbiib (الطبيب): Doctor
Reaction Rule: If a patient mentions pain ("Darani"), validate their concern immediately.`,
                conversationExamples: `[CONVERSATION EXAMPLES (DO NOT COPY EXACTLY, JUST EMULATE DARIJA STYLE)]
Patient: salam brit nakhod mawiid
Assistant: وعليكم السلام ورحمة الله! مرحبا بك في عيادة ${businessName}. كيفاش نقدرو نعاونوك اليوم؟
Patient: darani rasi bzzaf
Assistant: ما يكون باس عليك! أحسن حاجة هي تجي العيادة باش الطبيب يشوف حالتك ويدير لك التشخيص المناسب. واش تبغي نحجزو لك موعد هاد السيمانة؟`
            };

        case 'beauty_center':
            return {
                systemRole: `You are the Lead Beauty & Wellness Relations Executive for ${businessName}. You are not a bot; you are a professional, high-end beauty concierge. Your mission is to provide a luxurious experience that justifies premium service prices while driving clients to book in-person beauty consultations and treatments.`,
                mission: `Convert every inquiry into a center visit. Never provide specific prices over chat; instead, sell the value of the center's expertise, premium products, and personalized treatments.`,
                salesRules: `Value over Price: If asked about price, say the prices depend on the specific treatment and skin/hair type after the specialist evaluates them. The goal is the best result, not the cheapest price.
No Advice: If asked for beauty/skincare advice, say the specialists at the center can provide a personalized assessment. Best to visit for a full consultation.
High-Ticket Framing: Use phrases highlighting premium products, latest beauty tech, and the specialists' expertise.`,
                openingHook: `Greet warmly, introduce as the digital beauty assistant for ${businessName}, and ask how you can help them feel their best today.`,
                dictionary: `[DARIJA BEAUTY DICTIONARY]
Bchra (البشرة): Skin | Cha3r (الشعر): Hair | Dhfar (الضفر): Nails | Wjah (الوجه): Face
Gommage: Exfoliation/Scrub | Soin (السوان): Treatment | Hammam: Spa/Bath
Reaction Rule: If a client mentions a skin concern or special occasion, respond with enthusiasm and suggest the right treatment type.`,
                conversationExamples: `[CONVERSATION EXAMPLES (DO NOT COPY EXACTLY, JUST EMULATE DARIJA STYLE)]
Client: salam brit nakhod mawiid
Assistant: وعليكم السلام ورحمة الله! مرحبا بك في ${businessName}. كيفاش نقدرو نعاونوك باش تكوني في أحسن حال؟
Client: bghit ndير soin dial lwjah
Assistant: اختيار ممتاز! عندنا بزاف ديال السوانات المتخصصين فالبشرة. الأفضل تجي للمركز باش المتخصصة تشوف نوع بشرتك وتنصحك بأحسن سوان. واش تبغي نحجزو لك موعد؟`
            };

        case 'car_location':
            return {
                systemRole: `You are the Lead Commercial Executive for ${businessName}. You are not a bot; you are a professional vehicle rental concierge. Your mission is to provide an excellent rental experience while driving clients to book vehicles.`,
                mission: `Convert every inquiry into a vehicle reservation. Help clients find the perfect vehicle for their needs and budget.`,
                salesRules: `Value over Price: Highlight the quality, safety, and reliability of the fleet. If asked about price, provide general ranges but emphasize the value of well-maintained vehicles.
Upsell Smartly: Suggest upgrades (insurance, GPS, child seat) when relevant.
Availability Focus: Create urgency by mentioning vehicle availability.`,
                openingHook: `Greet warmly, introduce as the digital assistant for ${businessName}, and ask what type of vehicle they're looking for and for which dates.`,
                dictionary: `[DARIJA CAR RENTAL DICTIONARY]
Tomobil (طوموبيل): Car | Kra (الكرا): Rental | Permis (البيرمي): Driving license
Syara (السيارة): Vehicle | Wqid (الوقيد): Fuel | Assurance: Insurance
Reaction Rule: If a client mentions a specific destination or occasion, suggest the most suitable vehicle type.`,
                conversationExamples: `[CONVERSATION EXAMPLES (DO NOT COPY EXACTLY, JUST EMULATE DARIJA STYLE)]
Client: salam bghit nkri tomobil
Assistant: وعليكم السلام ورحمة الله! مرحبا بك في ${businessName}. من فوقاش حتى فوقاش بغيتي تكريها؟ وشنو نوع الطوموبيل لي كتفضل؟
Client: bghit chi haja kbira l weekend jay
Assistant: عندنا خيارات مزيانين! واش تقدر تعطيني التاريخ بالضبط باش نشوفو الديسبونيبيليتي؟`
            };

        case 'centre_formation':
            return {
                systemRole: `You are the Lead Enrollment & Relations Executive for ${businessName}. You are not a bot; you are a professional education concierge. Your mission is to provide an excellent experience while driving prospective students to enroll in training programs.`,
                mission: `Convert every inquiry into an enrollment or center visit. Help students find the right training program for their career goals.`,
                salesRules: `Value over Price: Highlight the quality of instructors, curriculum, and career outcomes. If asked about price, mention that investment in skills pays off long-term.
No Advice: If asked for career advice, say the center's counselors can provide a personalized assessment. Best to visit for a full consultation.
Career Focus: Use phrases highlighting job placement rates, certifications, and industry partnerships.`,
                openingHook: `Greet warmly, introduce as the digital assistant for ${businessName}, and ask what training or skills they're interested in.`,
                dictionary: `[DARIJA TRAINING DICTIONARY]
Formation (الفورماسيون): Training | Diplome (الديبلوم): Diploma | Stage (الستاج): Internship
Khedma (الخدمة): Job/Work | Professeur (البروفيسور): Instructor | Inscription: Registration
Reaction Rule: If a student mentions a specific career goal, connect it to the most relevant training program.`,
                conversationExamples: `[CONVERSATION EXAMPLES (DO NOT COPY EXACTLY, JUST EMULATE DARIJA STYLE)]
Client: salam bghit ntsajal f formation
Assistant: وعليكم السلام ورحمة الله! مرحبا بك في ${businessName}. شنو المجال لي كيعجبك؟ عندنا بزاف ديال الفورماسيونات المتخصصين.
Client: bghit ntaalem linformatique
Assistant: اختيار ممتاز! عندنا برامج مزيانين فالإنفورماتيك. الأفضل تجي للمركز باش نعطيوك كلشي بالتفصيل على البرنامج والتسجيل. واش تبغي نحجزو لك موعد للاستشارة؟`
            };

        default:
            // Generic business fallback — no medical language
            return {
                systemRole: `You are the Lead Relations & Sales Executive for ${businessName}. You are not a bot; you are a professional, high-end concierge. Your mission is to provide an excellent client experience while driving clients to book appointments.`,
                mission: `Convert every inquiry into a visit. Help clients understand the value of the services offered. Never provide specific prices over chat; encourage in-person consultations.`,
                salesRules: `Value over Price: If asked about price, say the prices depend on the specific service needed. The goal is the best result.
High-Ticket Framing: Use phrases highlighting the team's expertise and quality of service.`,
                openingHook: `Greet warmly, introduce as the digital assistant for ${businessName}, and ask how you can help them today.`,
                dictionary: '',
                conversationExamples: `[CONVERSATION EXAMPLES (DO NOT COPY EXACTLY, JUST EMULATE DARIJA STYLE)]
Client: salam brit nakhod mawiid
Assistant: وعليكم السلام ورحمة الله! مرحبا بك في ${businessName}. كيفاش نقدرو نعاونوك اليوم؟`
            };
    }
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
Étape 1 — Recherche :
- Utilise l'outil search_properties avec les critères du client (quartier, budget, surface, chambres).

Étape 2 — Présentation + Photos AUTOMATIQUES :
- Dès que search_properties retourne un ou plusieurs biens :
  1. Présente le(s) bien(s) avec enthousiasme (titre, prix, surface, quartier).
  2. IMMÉDIATEMENT après, appelle get_property_photos pour CHAQUE bien présenté (utilise son PropertyID).
  3. Le système enverra les photos automatiquement — tu n'as pas besoin de les mentionner dans le texte.
- RÈGLE ABSOLUE : Tu dois TOUJOURS appeler get_property_photos juste après avoir présenté un bien. Ne présente jamais un bien sans envoyer ses photos.

Étape 3 — Pivot si pas de match exact :
- Si aucun bien ne correspond à 90%+, propose l'alternative la plus proche.
- Exemple Darija : "Ma'ndich exactement [critère] fhad l-quartier, walakin 'ndi wahed l-hwa mchmach o chouka fih [quasi-equivalent]. Chof tsawerou..."
- Appelle quand même get_property_photos pour l'alternative proposée.

[CRITICAL RULE - NO RAW URLS]
Tu ne dois JAMAIS afficher de liens URL bruts (http://..., https://...) dans tes messages.
Pour envoyer des photos, utilise UNIQUEMENT l'outil get_property_photos avec le PropertyID.
Ne copie-colle jamais les URLs des photos ou vidéos dans la conversation.

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

// ==========================================
// RESTAURANT niche
// ==========================================

function generateRestaurantMasterPrompt(
    restaurantName: string,
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
            ? 'Amical, chaleureux et enthousiaste'
            : tone === 'formal,direct'
                ? 'Formel, direct et efficace'
                : 'Professionnel, accueillant et persuasif';

    const langList = languages ? languages.split(',').map(l => l.trim()) : ['darija', 'french'];
    let langInstruction = 'Réponds dans la langue du client. Si Darija, utilise les caractères arabes. Si Français, réponds en Français.';
    if (langList.includes('english') && !langList.includes('darija')) {
        langInstruction = 'Respond in professional English.';
    } else if (langList.includes('french') && !langList.includes('darija')) {
        langInstruction = 'Réponds en Français professionnel.';
    }

    return `[TEMPORAL CONTEXT]
Today's Date: ${dateStr} (YYYY-MM-DD)
Today's Day: ${dayStr}
Current Time: ${timeStr}

[SYSTEM_ROLE]
Tu es le Serveur IA / Garçon Virtuel du restaurant ${restaurantName}.
Ta mission est de prendre les commandes des clients via WhatsApp, de leur présenter le menu, de les conseiller et de finaliser les commandes avec tous les détails.

[CORE PERSONALITY]
Ton: ${toneDesc}.
Langue: ${langInstruction}
Mission: Convertir chaque conversation en une commande confirmée. Être serviable, rapide et précis.

[RESTAURANT INFO]
Nom: ${restaurantName}
Horaires: ${workingHours}
${additionalInfo ? `Informations supplémentaires:\n${additionalInfo}` : ''}

[MENU]
Voici le menu actuel du restaurant:
{{restaurant_menu}}

[ORDERING PROTOCOL — OBLIGATOIRE]
1. ACCUEIL: Salue le client chaleureusement et propose de montrer le menu.
2. MENU: Quand demandé, présente le menu par catégorie avec les prix. Appelle l'outil get_menu pour obtenir le menu à jour.
3. PRISE DE COMMANDE: Note chaque plat demandé avec la quantité.
4. PERSONNALISATION: Pour CHAQUE plat, demande s'il y a des modifications (sans oignons, extra sauce, bien cuit, etc.).
5. SUGGESTION OBLIGATOIRE: TOUJOURS proposer des desserts et des boissons si disponibles dans le menu. Exemple: "Vous voulez ajouter un dessert ou une boisson avec votre commande?"
6. RÉCAPITULATIF: Avant de confirmer, envoie un résumé complet:
   - Chaque article avec quantité et personnalisation
   - Le total estimé
   - L'adresse de livraison (si livraison)
7. CONFIRMATION: Demande au client de confirmer avant d'appeler place_order.

[TOOL INSTRUCTIONS]
- get_menu: Appelle cet outil quand le client demande le menu ou des informations sur les plats.
- place_order: Appelle UNIQUEMENT après que le client a confirmé:
  * Les articles et quantités
  * Les personnalisations
  * Son nom
  * Son numéro (utilise le numéro WhatsApp actuel par défaut)
  * L'adresse de livraison (si livraison)
- check_item_availability: Utilise cet outil quand le client demande si un plat spécifique est disponible.

[CRITICAL RULES]
- Ne JAMAIS placer une commande sans confirmation explicite du client.
- TOUJOURS demander les personnalisations pour chaque plat.
- TOUJOURS suggérer desserts et boissons.
- Si un article n'est pas disponible, propose des alternatives du menu.
- Sois enthousiaste sur les plats populaires.

[DARIJA FOOD VOCABULARY]
Makla (ماكلة): Nourriture | Tajine (طاجين): Tajine | Mechwi (مشوي): Grillé
Hlib (حليب): Lait | Atay (أتاي): Thé | Qahwa (قهوة): Café
Khobz (خبز): Pain | Zit (زيت): Huile | L-ma (الما): Eau
Lfakya (الفاكية): Fruits | Khodra (خضرة): Légumes
Lhem (لحم): Viande | Djaj (دجاج): Poulet | Hout (حوت): Poisson
Bghri: Envie de / Je veux | Zid: Ajoute encore | Bla: Sans | M3a: Avec`;
}

export async function getRestaurantMenuForPrompt(userId: string): Promise<string> {
    const { data: categories, error: catErr } = await supabase
        .from('restaurant_menu_categories')
        .select('*')
        .eq('user_id', userId)
        .order('display_order', { ascending: true });

    if (catErr) {
        console.error('[Restaurant] Error fetching categories:', catErr);
        return 'Menu non disponible.';
    }

    const { data: items, error: itemErr } = await supabase
        .from('restaurant_menu_items')
        .select('*')
        .eq('user_id', userId)
        .eq('is_available', true)
        .order('name', { ascending: true });

    if (itemErr) {
        console.error('[Restaurant] Error fetching menu items:', itemErr);
        return 'Menu non disponible.';
    }

    if (!items || items.length === 0) return 'Aucun plat disponible actuellement.';

    const catMap: Record<string, any[]> = {};
    const uncategorized: any[] = [];

    for (const item of items) {
        if (item.category_id) {
            if (!catMap[item.category_id]) catMap[item.category_id] = [];
            catMap[item.category_id].push(item);
        } else {
            uncategorized.push(item);
        }
    }

    const lines: string[] = [];
    for (const cat of (categories || [])) {
        const catItems = catMap[cat.id] || [];
        if (catItems.length === 0) continue;
        lines.push(`\n### ${cat.name}`);
        for (const item of catItems) {
            lines.push(`- ${item.name} — ${item.price_dh} DH${item.description ? ` (${item.description})` : ''}`);
        }
    }

    if (uncategorized.length > 0) {
        lines.push('\n### Autres');
        for (const item of uncategorized) {
            lines.push(`- ${item.name} — ${item.price_dh} DH${item.description ? ` (${item.description})` : ''}`);
        }
    }

    return lines.join('\n');
}

export async function placeRestaurantOrder(
    userId: string,
    customerPhone: string,
    customerName: string,
    deliveryAddress: string,
    orderType: string,
    items: Array<{ item_name: string; quantity: number; customizations?: string }>,
    notes: string
): Promise<{ status: string; order?: any }> {
    try {
        const cleanPhone = customerPhone ? String(customerPhone).replace(/\D/g, '') : '';

        // Upsert customer by phone
        let customerId: string | null = null;
        if (cleanPhone) {
            const { data: existing } = await supabase
                .from('restaurant_customers')
                .select('id')
                .eq('user_id', userId)
                .eq('phone', cleanPhone)
                .maybeSingle();

            customerId = existing?.id ?? null;

            if (!customerId) {
                const { data: created, error: createErr } = await supabase
                    .from('restaurant_customers')
                    .insert({
                        user_id: userId,
                        full_name: customerName,
                        phone: cleanPhone,
                    })
                    .select('id')
                    .single();
                if (createErr) throw createErr;
                customerId = created?.id ?? null;
            }
        }

        // Match item names to menu items and calculate total
        const { data: menuItems } = await supabase
            .from('restaurant_menu_items')
            .select('id, name, price_dh')
            .eq('user_id', userId)
            .eq('is_available', true);

        let totalDh = 0;
        const orderItems: any[] = [];

        for (const reqItem of items) {
            const match = (menuItems || []).find(
                (m: any) => m.name.toLowerCase().includes(reqItem.item_name.toLowerCase()) ||
                    reqItem.item_name.toLowerCase().includes(m.name.toLowerCase())
            );

            const unitPrice = match?.price_dh ?? 0;
            const qty = reqItem.quantity || 1;
            totalDh += unitPrice * qty;

            orderItems.push({
                user_id: userId,
                menu_item_id: match?.id || null,
                item_name: match?.name || reqItem.item_name,
                quantity: qty,
                unit_price_dh: unitPrice,
                customizations: reqItem.customizations || null,
            });
        }

        // Create order
        const { data: order, error: orderErr } = await supabase
            .from('restaurant_orders')
            .insert({
                user_id: userId,
                customer_id: customerId,
                customer_name: customerName,
                customer_phone: cleanPhone || customerPhone,
                delivery_address: deliveryAddress || null,
                order_type: orderType || 'delivery',
                status: 'pending',
                total_dh: totalDh,
                notes: notes || null,
            })
            .select('*')
            .single();

        if (orderErr) throw orderErr;

        // Insert order items
        if (order && orderItems.length > 0) {
            const itemsWithOrderId = orderItems.map(i => ({ ...i, order_id: order.id }));
            const { error: itemsErr } = await supabase
                .from('restaurant_order_items')
                .insert(itemsWithOrderId);
            if (itemsErr) console.error('[Restaurant] Error inserting order items:', itemsErr);
        }

        // Update customer stats
        if (customerId) {
            try {
                await supabase
                    .from('restaurant_customers')
                    .update({ last_order_at: new Date().toISOString() })
                    .eq('id', customerId);
            } catch (e) {
                // Non-critical, ignore
            }
        }

        return {
            status: 'success',
            order: {
                id: order?.id,
                total_dh: totalDh,
                items_count: orderItems.length,
                customer_name: customerName,
                instruction_for_ai: `Confirme la commande au client en Darija/Français. Total: ${totalDh} DH. Numéro de commande: ${order?.id?.slice(0, 8)}.`
            }
        };
    } catch (error: any) {
        console.error('[Restaurant] place order failed:', error);
        return { status: 'error', order: { message: error?.message || 'Failed to place order' } };
    }
}

export async function checkRestaurantItemAvailability(
    userId: string,
    itemName: string
): Promise<{ status: string; items: any[] }> {
    try {
        const { data, error } = await supabase
            .from('restaurant_menu_items')
            .select('id, name, price_dh, is_available, description')
            .eq('user_id', userId)
            .ilike('name', `%${itemName}%`);

        if (error) throw error;

        return {
            status: 'success',
            items: (data || []).map((item: any) => ({
                name: item.name,
                price_dh: item.price_dh,
                available: item.is_available,
                description: item.description
            }))
        };
    } catch (error: any) {
        console.error('[Restaurant] check availability failed:', error);
        return { status: 'error', items: [] };
    }
}

export async function getActiveRestaurantProfiles() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, clinic_name, waha_session_name, subscription_status')
        .eq('niche', 'restaurant')
        .in('subscription_status', ['pro', 'trial', 'active']);

    if (error || !data) {
        if (error) console.error('[Restaurant] Error fetching restaurant profiles:', error);
        return [];
    }
    return data;
}

export async function getPendingOrderNotifications(userId: string) {
    const { data, error } = await supabase
        .from('restaurant_orders')
        .select('id, customer_name, customer_phone, status, reminders_sent')
        .eq('user_id', userId)
        .in('status', ['out_for_delivery', 'ready_for_pickup']);

    if (error || !data) {
        if (error) console.error('[Restaurant] Error fetching order notifications:', error);
        return [];
    }

    return data.filter((order: any) => {
        const sent: string[] = order.reminders_sent || [];
        return !sent.includes(order.status);
    });
}

export async function markOrderNotificationSent(orderId: string, notificationType: string) {
    const { data: order } = await supabase
        .from('restaurant_orders')
        .select('reminders_sent')
        .eq('id', orderId)
        .maybeSingle();

    const currentSent: string[] = order?.reminders_sent || [];
    currentSent.push(notificationType);

    const { error } = await supabase
        .from('restaurant_orders')
        .update({ reminders_sent: currentSent })
        .eq('id', orderId);

    if (error) {
        console.error('[Restaurant] Error marking notification sent:', error);
    }
}

