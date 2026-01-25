// Neora Agency API Service
// All async functions are mocked with setTimeout for development
// Replace the mock implementations with n8n webhook URLs when ready

export interface Doctor {
  id: string;
  email: string;
  clinic_name: string;
  whatsapp_status: 'connected' | 'disconnected';
  phone?: string;
}

export interface Appointment {
  id: string;
  patient_name: string;
  phone: string;
  service_type: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  date_time: string;
  ai_summary: string;
}

export interface BotConfig {
  doctor_id: string;
  clinic_name: string;
  bot_tone: 'friendly' | 'formal' | 'direct';
  services_list: string;
  pricing_rules: string;
}

// Mock delay to simulate API calls
const mockDelay = (ms: number = 1000) => new Promise(resolve => setTimeout(resolve, ms));

// Mock data
const mockAppointments: Appointment[] = [
  {
    id: '1',
    patient_name: 'Sarah Johnson',
    phone: '+1 (555) 123-4567',
    service_type: 'Teeth Cleaning',
    status: 'confirmed',
    date_time: '2024-01-26T10:00:00',
    ai_summary: 'Regular cleaning appointment. Patient mentioned sensitivity on upper left molars.'
  },
  {
    id: '2',
    patient_name: 'Michael Chen',
    phone: '+1 (555) 234-5678',
    service_type: 'Root Canal',
    status: 'pending',
    date_time: '2024-01-26T14:30:00',
    ai_summary: 'Follow-up from emergency visit. X-rays needed before procedure.'
  },
  {
    id: '3',
    patient_name: 'Emily Rodriguez',
    phone: '+1 (555) 345-6789',
    service_type: 'Consultation',
    status: 'confirmed',
    date_time: '2024-01-27T09:00:00',
    ai_summary: 'First-time patient. Interested in Invisalign treatment options.'
  },
  {
    id: '4',
    patient_name: 'James Wilson',
    phone: '+1 (555) 456-7890',
    service_type: 'Filling',
    status: 'cancelled',
    date_time: '2024-01-27T11:00:00',
    ai_summary: 'Cancelled due to scheduling conflict. Reschedule needed.'
  },
  {
    id: '5',
    patient_name: 'Lisa Park',
    phone: '+1 (555) 567-8901',
    service_type: 'Whitening',
    status: 'pending',
    date_time: '2024-01-28T15:00:00',
    ai_summary: 'Cosmetic whitening session. Pre-treatment sensitivity check required.'
  },
];

// ==========================================
// APPOINTMENTS API
// Replace with: fetch('YOUR_N8N_WEBHOOK_URL/appointments')
// ==========================================
export async function fetchAppointments(): Promise<Appointment[]> {
  await mockDelay(800);
  return mockAppointments;
}

export async function cancelAppointment(id: string): Promise<{ success: boolean }> {
  await mockDelay(500);
  // In production: POST to n8n webhook with appointment ID
  console.log(`[API] Cancelling appointment: ${id}`);
  return { success: true };
}

// ==========================================
// WHATSAPP QR CODE API
// Replace with: fetch('YOUR_N8N_WEBHOOK_URL/generate-qr')
// ==========================================
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

// ==========================================
// BOT CONFIG API
// Replace with: fetch('YOUR_N8N_WEBHOOK_URL/bot-config', { method: 'POST' })
// ==========================================
export async function saveBotConfig(config: Partial<BotConfig>): Promise<{ success: boolean }> {
  await mockDelay(1000);
  // In production: POST to n8n webhook with bot configuration
  console.log('[API] Saving bot config:', config);
  return { success: true };
}

export async function fetchBotConfig(doctorId: string): Promise<BotConfig> {
  await mockDelay(600);
  // In production: GET from n8n webhook
  return {
    doctor_id: doctorId,
    clinic_name: 'Neora Dental Clinic',
    bot_tone: 'friendly',
    services_list: `• Teeth Cleaning - $120
• Whitening - $350
• Root Canal - $800-1200
• Filling - $150-300
• Consultation - Free`,
    pricing_rules: 'All prices include initial consultation. Insurance accepted. Payment plans available for procedures over $500.'
  };
}

// ==========================================
// AUTH API (Prepare for Supabase)
// ==========================================
export async function loginUser(email: string, password: string): Promise<{ user: Doctor | null; error?: string }> {
  await mockDelay(1000);
  // In production: Use Supabase Auth
  if (email && password) {
    return {
      user: {
        id: 'user_1',
        email,
        clinic_name: 'Neora Dental Clinic',
        whatsapp_status: 'disconnected'
      }
    };
  }
  return { user: null, error: 'Invalid credentials' };
}

export async function registerUser(email: string, password: string): Promise<{ user: Doctor | null; error?: string }> {
  await mockDelay(1000);
  // In production: Use Supabase Auth
  if (email && password) {
    return {
      user: {
        id: 'user_' + Date.now(),
        email,
        clinic_name: 'New Clinic',
        whatsapp_status: 'disconnected'
      }
    };
  }
  return { user: null, error: 'Registration failed' };
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
  await mockDelay(700);
  return {
    totalAppointments: 156,
    confirmedToday: 8,
    pendingReview: 3,
    conversionRate: 78,
    aiInteractions: 432
  };
}
