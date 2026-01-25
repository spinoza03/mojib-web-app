// Neora Agency API Service
// Uses Supabase for real data persistence

import { supabase } from '@/integrations/supabase/client';

export interface Appointment {
  id: string;
  user_id: string;
  patient_name: string;
  phone: string;
  service_type: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  date_time: string;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface BotConfig {
  id: string;
  user_id: string;
  clinic_name: string;
  bot_tone: 'friendly' | 'formal' | 'direct';
  services_list: string | null;
  pricing_rules: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  clinic_name: string;
  phone: string | null;
  avatar_url: string | null;
  whatsapp_status: 'connected' | 'disconnected';
  created_at: string;
  updated_at: string;
}

// ==========================================
// APPOINTMENTS API
// ==========================================
export async function fetchAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .order('date_time', { ascending: true });

  if (error) {
    console.error('[API] Error fetching appointments:', error);
    throw error;
  }

  return (data || []) as Appointment[];
}

export async function createAppointment(appointment: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .insert(appointment)
    .select()
    .single();

  if (error) {
    console.error('[API] Error creating appointment:', error);
    throw error;
  }

  return data as Appointment;
}

export async function updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[API] Error updating appointment:', error);
    throw error;
  }

  return data as Appointment;
}

export async function cancelAppointment(id: string): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) {
    console.error('[API] Error cancelling appointment:', error);
    throw error;
  }

  return { success: true };
}

export async function deleteAppointment(id: string): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[API] Error deleting appointment:', error);
    throw error;
  }

  return { success: true };
}

// ==========================================
// WHATSAPP QR CODE API
// Replace with: fetch('YOUR_N8N_WEBHOOK_URL/generate-qr')
// ==========================================
const mockDelay = (ms: number = 1000) => new Promise(resolve => setTimeout(resolve, ms));

export async function generateQRCode(): Promise<{ qr_url: string; session_id: string }> {
  await mockDelay(2000);
  // In production: Call n8n webhook to generate WhatsApp QR session
  return {
    qr_url: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=whatsapp-session-mock',
    session_id: 'session_' + Date.now()
  };
}

export async function checkWhatsAppStatus(): Promise<{ connected: boolean; phone?: string }> {
  await mockDelay(500);
  // In production: Poll n8n webhook for connection status
  return {
    connected: false,
    phone: undefined
  };
}

export async function updateWhatsAppStatus(userId: string, status: 'connected' | 'disconnected', phone?: string): Promise<void> {
  const updates: { whatsapp_status: string; phone?: string } = { whatsapp_status: status };
  if (phone) {
    updates.phone = phone;
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId);

  if (error) {
    console.error('[API] Error updating WhatsApp status:', error);
    throw error;
  }
}

// ==========================================
// BOT CONFIG API
// ==========================================
export async function saveBotConfig(config: Partial<BotConfig>): Promise<{ success: boolean }> {
  const { user_id, ...updates } = config;
  
  if (!user_id) {
    throw new Error('user_id is required');
  }

  const { error } = await supabase
    .from('bot_config')
    .update(updates)
    .eq('user_id', user_id);

  if (error) {
    console.error('[API] Error saving bot config:', error);
    throw error;
  }

  return { success: true };
}

export async function fetchBotConfig(userId: string): Promise<BotConfig | null> {
  const { data, error } = await supabase
    .from('bot_config')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[API] Error fetching bot config:', error);
    throw error;
  }

  return data as BotConfig | null;
}

// ==========================================
// PROFILE API
// ==========================================
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[API] Error fetching profile:', error);
    throw error;
  }

  return data as Profile | null;
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('[API] Error updating profile:', error);
    throw error;
  }

  return data as Profile;
}

// ==========================================
// DASHBOARD STATS API
// ==========================================
export interface DashboardStats {
  totalAppointments: number;
  confirmedToday: number;
  pendingReview: number;
  conversionRate: number;
  aiInteractions: number;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('*');

  if (error) {
    console.error('[API] Error fetching dashboard stats:', error);
    throw error;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const allAppointments = appointments || [];
  const confirmedToday = allAppointments.filter(a => {
    const appointmentDate = new Date(a.date_time);
    return a.status === 'confirmed' && 
           appointmentDate >= today && 
           appointmentDate < tomorrow;
  }).length;

  const pendingReview = allAppointments.filter(a => a.status === 'pending').length;
  const confirmed = allAppointments.filter(a => a.status === 'confirmed').length;
  const conversionRate = allAppointments.length > 0 
    ? Math.round((confirmed / allAppointments.length) * 100) 
    : 0;

  return {
    totalAppointments: allAppointments.length,
    confirmedToday,
    pendingReview,
    conversionRate,
    aiInteractions: allAppointments.length * 3, // Simulated AI interactions
  };
}
