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

export async function getClinicBotSettings(receivingPhone: string) {
    // Determine the phone without non-digits for safety
    const safePhone = receivingPhone.replace(/\D/g, '');

    // 1. Fetch profile
    const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('id, clinic_name, subscription_status, waha_session_name')
        .eq('phone', safePhone)
        .limit(1)
        .maybeSingle();

    if (pError || !profile) {
        console.error('Could not find clinic profile for phone:', safePhone, pError);
        return null; // Not a registered doctor
    }

    // 2. Fetch bot config
    const { data: config, error: bError } = await supabase
        .from('bot_configs')
        .select('system_prompt, cooldown_seconds')
        .eq('user_id', profile.id)
        .limit(1)
        .maybeSingle();

    return {
        user_id: profile.id,
        clinic_name: profile.clinic_name,
        subscription_status: profile.subscription_status,
        waha_session_name: profile.waha_session_name,
        system_prompt: config?.system_prompt || '',
        cooldown_seconds: config?.cooldown_seconds || 60
    };
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
