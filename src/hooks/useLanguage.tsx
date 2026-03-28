import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type AppLanguage = 'fr' | 'en';

const translations = {
  // Sidebar & Navigation
  'nav.dashboard': { fr: 'Tableau de Bord', en: 'Dashboard' },
  'nav.appointments': { fr: 'Rendez-vous', en: 'Appointments' },
  'nav.crm': { fr: 'Patients CRM', en: 'Patients CRM' },
  'nav.finance': { fr: 'Finance', en: 'Finance' },
  'nav.connect': { fr: 'Connexion WhatsApp', en: 'WhatsApp Connect' },
  'nav.settings': { fr: 'Paramètres', en: 'Settings' },

  // Appointments Page
  'apt.title': { fr: 'Rendez-vous', en: 'Appointments' },
  'apt.desc': { fr: 'Gérez le calendrier de votre cabinet.', en: "Manage your clinic's schedule." },
  'apt.manualBooking': { fr: 'Réservation Manuelle', en: 'Manual Booking' },
  'apt.newAppointment': { fr: 'Nouveau Rendez-vous', en: 'New Appointment' },
  'apt.editAppointment': { fr: 'Modifier le Rendez-vous', en: 'Modify Appointment' },
  'apt.patientName': { fr: 'Nom du Patient', en: 'Patient Name' },
  'apt.phone': { fr: 'Numéro de Téléphone', en: 'Phone Number' },
  'apt.date': { fr: 'Date', en: 'Date' },
  'apt.time': { fr: 'Heure', en: 'Time' },
  'apt.notes': { fr: 'Notes', en: 'Notes' },
  'apt.reasonForVisit': { fr: 'Motif de la visite...', en: 'Reason for visit...' },
  'apt.shareBookingLink': { fr: 'Partager le Lien de Réservation', en: 'Share Booking Link' },
  'apt.calendarView': { fr: 'Vue Calendrier', en: 'Calendar View' },
  'apt.total': { fr: 'Total', en: 'Total' },
  'apt.confirmed': { fr: 'Confirmé', en: 'Confirmed' },
  'apt.pending': { fr: 'En Attente', en: 'Pending' },
  'apt.completed': { fr: 'Terminé', en: 'Completed' },
  'apt.noShow': { fr: 'Absent', en: 'No Show' },
  'apt.cancelled': { fr: 'Annulé', en: 'Cancelled' },
  'apt.filter': { fr: 'Filtrer:', en: 'Filter:' },
  'apt.all': { fr: 'Tous', en: 'All' },
  'apt.markAttendance': { fr: 'Marquer la Présence', en: 'Mark Attendance' },
  'apt.showedUp': { fr: 'Présent', en: 'Showed Up' },
  'apt.cancel': { fr: 'Annuler', en: 'Cancel' },
  'apt.reconfirm': { fr: 'Re-confirmer', en: 'Re-confirm' },
  'apt.delete': { fr: 'Supprimer', en: 'Delete' },
  'apt.close': { fr: 'Fermer', en: 'Close' },
  'apt.edit': { fr: 'Modifier', en: 'Edit' },
  'apt.save': { fr: 'Enregistrer', en: 'Save Changes' },
  'apt.bookAppointment': { fr: 'Réserver', en: 'Book Appointment' },
  'apt.status': { fr: 'Statut', en: 'Status' },
  'apt.timezone': { fr: 'Fuseau Horaire:', en: 'Timezone:' },
  'apt.shareTitle': { fr: 'Partager le Lien de Réservation', en: 'Share Booking Link' },
  'apt.shareDesc': { fr: 'Partagez ce lien avec vos patients pour qu\'ils puissent réserver directement depuis leur navigateur.', en: 'Share this link with your patients so they can book appointments directly from their browser.' },
  'apt.shareInfo': { fr: 'Les patients verront uniquement les créneaux disponibles et pourront réserver sans créer de compte. Leurs réservations apparaîtront automatiquement dans votre calendrier.', en: "Patients will only see available time slots and can book without creating an account. You'll see their bookings appear in your calendar automatically." },
  'apt.copy': { fr: 'Copier', en: 'Copy' },
  'apt.copied': { fr: 'Copié!', en: 'Copied!' },

  // Immobilier labels
  'apt.immo.title': { fr: 'Rendez-vous', en: 'Appointments' },
  'apt.immo.desc': { fr: 'Gérez vos visites immobilières.', en: 'Manage your property visits.' },
  'apt.immo.clientName': { fr: 'Nom du client', en: 'Client Name' },
  'apt.immo.newRdv': { fr: 'Nouveau RDV', en: 'New Appointment' },
  'apt.immo.editRdv': { fr: 'Modifier le RDV', en: 'Edit Appointment' },

  // Settings Page
  'settings.title': { fr: "Paramètres de l'IA", en: 'AI Settings' },
  'settings.save': { fr: 'Enregistrer', en: 'Save' },
  'settings.saved': { fr: 'Enregistré', en: 'Saved' },
  'settings.savedDesc': { fr: 'Paramètres mis à jour avec succès.', en: 'Settings updated successfully.' },
  'settings.workingHours': { fr: 'Horaires de Travail', en: 'Working Hours' },
  'settings.workingHoursDesc': { fr: "Configurez les jours et horaires d'ouverture.", en: 'Configure your opening days and hours.' },
  'settings.tone': { fr: "Ton de l'Agent", en: 'Agent Tone' },
  'settings.addSlot': { fr: 'Ajouter un créneau', en: 'Add time slot' },
  'settings.copyToAll': { fr: 'Copier vers les autres jours', en: 'Copy to other days' },
  'settings.dayOff': { fr: 'Jour de repos', en: 'Day off' },
  'settings.reminders': { fr: 'Rappels de Rendez-vous', en: 'Appointment Reminders' },
  'settings.remindersDesc': { fr: 'Configurez les rappels automatiques WhatsApp.', en: 'Configure automatic WhatsApp reminders.' },

  // Common
  'common.cancel': { fr: 'Annuler', en: 'Cancel' },
  'common.success': { fr: 'Succès', en: 'Success' },
  'common.error': { fr: 'Erreur', en: 'Error' },
  'common.loading': { fr: 'Chargement...', en: 'Loading...' },
  'common.noPhone': { fr: 'Pas de téléphone', en: 'No phone' },
  'common.noNotes': { fr: 'Pas de notes.', en: 'No notes.' },
  'common.language': { fr: 'Langue', en: 'Language' },

  // Days of week
  'day.monday': { fr: 'Lundi', en: 'Monday' },
  'day.tuesday': { fr: 'Mardi', en: 'Tuesday' },
  'day.wednesday': { fr: 'Mercredi', en: 'Wednesday' },
  'day.thursday': { fr: 'Jeudi', en: 'Thursday' },
  'day.friday': { fr: 'Vendredi', en: 'Friday' },
  'day.saturday': { fr: 'Samedi', en: 'Saturday' },
  'day.sunday': { fr: 'Dimanche', en: 'Sunday' },

  // Onboarding - Dashboard
  'onboarding.dashboard.1.title': { fr: 'Bienvenue sur votre Tableau de Bord', en: 'Welcome to your Dashboard' },
  'onboarding.dashboard.1.desc': { fr: "C'est votre centre de commande. Consultez vos indicateurs clés en un coup d'oeil — rendez-vous du jour, nouveaux patients, chiffre d'affaires et statistiques IA.", en: 'This is your command center. See all your key metrics at a glance — appointments today, new patients, revenue, and AI conversation stats.' },
  'onboarding.dashboard.2.title': { fr: 'Analytiques en Temps Réel', en: 'Real-Time Analytics' },
  'onboarding.dashboard.2.desc': { fr: "Vos chiffres se mettent à jour en temps réel. Suivez le flux de patients, les taux de conversion et les absences pour optimiser votre cabinet.", en: 'Your numbers update in real-time. Track patient flow, conversion rates, and no-show patterns to optimize your practice.' },

  // Onboarding - Appointments
  'onboarding.appointments.1.title': { fr: 'Gérez votre Calendrier', en: 'Manage Your Calendar' },
  'onboarding.appointments.1.desc': { fr: "Visualisez tous les rendez-vous en vue mois, semaine ou jour. Glissez-déposez pour reprogrammer. Cliquez sur un rendez-vous pour voir les détails.", en: 'View all appointments in month, week, or day view. Drag and drop to reschedule instantly. Click any appointment to see details.' },
  'onboarding.appointments.2.title': { fr: 'Suivi des Présences', en: 'Track Patient Attendance' },
  'onboarding.appointments.2.desc': { fr: 'Marquez les patients comme "Présent", "Absent" ou "Annulé" en un clic. Suivez les absences pour réduire les rendez-vous manqués.', en: 'Mark patients as "Showed Up", "No Show", or "Cancelled" with one click. Track no-show patterns to reduce missed appointments.' },
  'onboarding.appointments.3.title': { fr: 'Partagez votre Lien de Réservation', en: 'Share Your Booking Link' },
  'onboarding.appointments.3.desc': { fr: 'Cliquez sur "Partager le Lien" pour obtenir une URL publique. Envoyez-la par WhatsApp, réseaux sociaux ou site web — les patients réservent sans compte.', en: 'Click "Share Booking Link" to get a public URL. Send it via WhatsApp, social media, or website — patients book without an account.' },
  'onboarding.appointments.4.title': { fr: 'Couleurs par Statut', en: 'Color-Coded Statuses' },
  'onboarding.appointments.4.desc': { fr: 'Bleu = Confirmé, Jaune = En attente, Vert = Terminé, Violet = Absent, Gris = Annulé. Filtrez en cliquant sur les badges de statut.', en: 'Blue = Confirmed, Yellow = Pending, Green = Completed, Purple = No Show, Grey = Cancelled. Filter by clicking the status badges.' },

  // Onboarding - Connect
  'onboarding.connect.1.title': { fr: 'Connectez WhatsApp', en: 'Connect WhatsApp' },
  'onboarding.connect.1.desc': { fr: "Scannez le QR code pour lier votre numéro WhatsApp Business. Une fois connecté, l'agent IA répondra automatiquement 24h/24.", en: 'Scan the QR code to link your WhatsApp Business number. Once connected, the AI agent will respond automatically 24/7.' },
  'onboarding.connect.2.title': { fr: 'Conversations IA', en: 'AI-Powered Conversations' },
  'onboarding.connect.2.desc': { fr: "Votre assistant IA gère les réservations, FAQ et suivis. Il parle Darija, Français et Anglais — s'adaptant automatiquement à chaque patient.", en: 'Your AI assistant handles booking requests, FAQs, and follow-ups. It speaks Darija, French, and English — adapting to each patient.' },
  'onboarding.connect.3.title': { fr: 'Reprise Manuelle', en: 'Manual Takeover' },
  'onboarding.connect.3.desc': { fr: "Besoin d'intervenir ? Répondez depuis votre téléphone — l'IA se met en pause et reprend après le délai configuré.", en: 'Need to jump in? Reply from your phone — the AI pauses automatically and resumes after the configured cooldown.' },

  // Onboarding - Settings
  'onboarding.settings.1.title': { fr: 'Configurez votre Agent IA', en: 'Configure Your AI Agent' },
  'onboarding.settings.1.desc': { fr: "Personnalisez le nom de votre entreprise, les horaires, le ton de l'agent et les langues supportées.", en: 'Customize your business name, working hours, agent tone, and supported languages.' },
  'onboarding.settings.2.title': { fr: 'Configurez les Rappels', en: 'Set Up Reminders' },
  'onboarding.settings.2.desc': { fr: 'Configurez les rappels automatiques WhatsApp avant les rendez-vous (ex: 24h + 30 min avant) pour réduire les absences.', en: 'Configure automatic WhatsApp reminders before appointments (e.g., 24 hours + 30 minutes before) to reduce no-shows.' },
  'onboarding.settings.3.title': { fr: 'Capacité & Intervalles', en: 'Slot Capacity & Intervals' },
  'onboarding.settings.3.desc': { fr: "Définissez combien de patients peuvent réserver le même créneau et la durée de chaque créneau (15, 30 ou 60 minutes).", en: 'Set how many patients can book the same time slot, and the duration of each slot (15, 30, or 60 minutes).' },

  // Onboarding - CRM
  'onboarding.crm.1.title': { fr: 'Gestion des Patients', en: 'Patient Management' },
  'onboarding.crm.1.desc': { fr: "Consultez tous vos patients en un seul endroit. Coordonnées, historique des rendez-vous et dossiers de traitement.", en: 'View all your patients in one place. Contact info, appointment history, and treatment records.' },
  'onboarding.crm.2.title': { fr: 'Actions Rapides', en: 'Quick Actions' },
  'onboarding.crm.2.desc': { fr: "Cliquez sur un patient pour voir son profil complet, lui envoyer un WhatsApp ou planifier son prochain rendez-vous.", en: 'Click on any patient to view their full profile, send them a WhatsApp message, or schedule their next appointment.' },

  // Onboarding - Finance
  'onboarding.finance.1.title': { fr: 'Vue Financière', en: 'Financial Overview' },
  'onboarding.finance.1.desc': { fr: "Suivez vos revenus, dépenses et bénéfices en temps réel. Identifiez les traitements les plus rentables.", en: 'Track your revenue, expenses, and profit in real-time. See which treatments are most profitable.' },
  'onboarding.finance.2.title': { fr: 'Dossiers de Traitement', en: 'Treatment Records' },
  'onboarding.finance.2.desc': { fr: "Enregistrez les traitements avec leur coût et prix. Le système calcule automatiquement votre marge bénéficiaire.", en: 'Log treatments with cost and price. The system automatically calculates your profit margin.' },
} as const;

type TranslationKey = keyof typeof translations;

interface LanguageContextType {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLanguage>(() => {
    const saved = localStorage.getItem('neora_lang');
    if (saved === 'en' || saved === 'fr') return saved;
    // Auto-detect from browser
    const browserLang = navigator.language?.split('-')[0];
    return browserLang === 'fr' ? 'fr' : 'en';
  });

  const setLang = (newLang: AppLanguage) => {
    setLangState(newLang);
    localStorage.setItem('neora_lang', newLang);
  };

  const t = (key: TranslationKey): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[lang] || entry.en;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
