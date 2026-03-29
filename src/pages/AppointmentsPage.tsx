import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer, View, Views } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Phone, User, FileText, Trash2, Edit3, Clock, Share2, Copy, Check, UserX, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toDate, formatInTimeZone } from 'date-fns-tz';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '@/App.css';
import { OnboardingPopup, ONBOARDING_CONFIGS } from '@/components/OnboardingPopup';

const DnDCalendar = withDragAndDrop(Calendar);

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Mojib blue color palette for appointment statuses
const STATUS_COLORS: Record<string, { bg: string; label: string; icon: any }> = {
  confirmed:  { bg: '#2589D0', label: 'Confirmed',  icon: CheckCircle2 },
  pending:    { bg: '#F59E0B', label: 'Pending',     icon: AlertCircle },
  completed:  { bg: '#22C55E', label: 'Completed',   icon: CheckCircle2 },
  no_show:    { bg: '#8B5CF6', label: 'No Show',     icon: UserX },
  cancelled:  { bg: '#94A3B8', label: 'Cancelled',   icon: XCircle },
};

interface AppointmentEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    phone: string;
    notes?: string;
    status: string;
    rawStart: string;
    rawEnd: string;
  };
}

export default function AppointmentsPage() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const isImmobilier = profile?.niche === 'immobilier';

  const labels = isImmobilier
    ? { personName: 'Nom du client', phonePlaceholder: '+212...', notesLabel: 'Notes', notesPlaceholder: 'Motif de la visite...', pageTitle: 'Rendez-vous', pageDesc: 'Gérez vos visites immobilières.', bookBtn: 'Nouveau RDV', newTitle: 'Nouveau Rendez-vous', editTitle: 'Modifier le Rendez-vous', namePlaceholder: 'ex. Youssef El Amrani' }
    : { personName: 'Patient Name', phonePlaceholder: '+212...', notesLabel: 'Notes', notesPlaceholder: 'Reason for visit...', pageTitle: 'Appointments', pageDesc: "Manage your clinic's schedule.", bookBtn: 'Manual Booking', newTitle: 'New Appointment', editTitle: 'Modify Appointment', namePlaceholder: 'e.g. Sara Ahmed' };
  const queryClient = useQueryClient();

  const [selectedEvent, setSelectedEvent] = useState<AppointmentEvent | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editAppointment, setEditAppointment] = useState({
    id: '', patientName: '', phone: '', date: '', time: '', notes: '', status: ''
  });

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    patientName: '', phone: '', date: '', time: '', notes: ''
  });

  const [view, setView] = useState<View>(Views.MONTH);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Load saved timezone from bot_config (set in Settings page)
  const { data: savedTimezone } = useQuery({
    queryKey: ['bot_config_timezone', user?.id],
    queryFn: async () => {
      if (!user?.id) return 'Africa/Casablanca';
      const { data } = await supabase.from('bot_configs').select('timezone').eq('user_id', user.id).maybeSingle();
      return (data as any)?.timezone || 'Africa/Casablanca';
    },
    enabled: !!user?.id
  });

  const browserIz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const popularTimezones = [
    { value: 'UTC', label: 'UTC (GMT+0)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Africa/Casablanca', label: 'Casablanca (Morocco)' },
    { value: 'America/New_York', label: 'New York (EST/EDT)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: browserIz, label: `Local (${browserIz})` }
  ];

  const [selectedTimzeone, setSelectedTimezone] = useState(savedTimezone || 'Africa/Casablanca');

  // Sync with saved timezone from settings when it loads
  useEffect(() => {
    if (savedTimezone) setSelectedTimezone(savedTimezone);
  }, [savedTimezone]);

  // Fetch share_token for the public booking link
  const { data: shareToken } = useQuery({
    queryKey: ['share_token', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('profiles').select('share_token').eq('id', user.id).maybeSingle();
      return data?.share_token;
    },
    enabled: !!user?.id
  });

  const publicBookingUrl = shareToken ? `${window.location.origin}/book/${shareToken}` : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicBookingUrl);
    setCopied(true);
    toast({ title: 'Link Copied!', description: 'Share this link with your patients.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const { data: config } = useQuery({
    queryKey: ['bot_config', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('bot_configs').select('slot_interval_minutes').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id
  });
  const slotDuration = config?.slot_interval_minutes || 30;

  const { data: events, isLoading } = useQuery({
    queryKey: ['appointments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', user.id);

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        throw error;
      }

      return data.map((apt: any) => {
        const startTz = toDate(apt.start_time, { timeZone: selectedTimzeone });
        const endTz   = toDate(apt.end_time,   { timeZone: selectedTimzeone });

        return {
          id: apt.id,
          title: apt.patient_name || 'Unknown',
          start: startTz,
          end: endTz,
          resource: {
            phone: apt.patient_phone,
            notes: apt.notes,
            status: apt.status,
            rawStart: apt.start_time,
            rawEnd: apt.end_time
          },
        };
      }) as AppointmentEvent[];
    },
    enabled: !!user?.id,
  });

  // Filter events by status
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (statusFilter === 'all') return events;
    return events.filter(e => e.resource.status === statusFilter);
  }, [events, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    if (!events) return { total: 0, confirmed: 0, noShow: 0, completed: 0 };
    return {
      total: events.length,
      confirmed: events.filter(e => e.resource.status === 'confirmed').length,
      noShow: events.filter(e => e.resource.status === 'no_show').length,
      completed: events.filter(e => e.resource.status === 'completed').length,
    };
  }, [events]);

  const handleCreateAppointment = async () => {
    if (!user) return;
    if (!newAppointment.patientName || !newAppointment.date || !newAppointment.time) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill in Name, Date, and Time.' });
      return;
    }

    const startDateTime = new Date(`${newAppointment.date}T${newAppointment.time}`);
    const endDateTime = new Date(startDateTime.getTime() + slotDuration * 60000);

    const { error } = await supabase.from('appointments').insert({
      doctor_id: user.id,
      patient_name: newAppointment.patientName,
      patient_phone: newAppointment.phone,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      status: 'confirmed',
      notes: newAppointment.notes
    });

    if (error) {
      if (error.message.includes('Capacité du créneau atteinte')) {
         toast({ variant: 'destructive', title: 'Créneau Complet', description: 'Vous avez atteint votre capacité maximum pour cet horaire.' });
      } else {
         toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
    } else {
      toast({ title: 'Success', description: 'Appointment booked successfully.' });
      setIsCreateDialogOpen(false);
      setNewAppointment({ patientName: '', phone: '', date: '', time: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    }
  };

  const handleSelectEvent = (event: AppointmentEvent) => {
    setSelectedEvent(event);
    setIsViewDialogOpen(true);

    const dateStr = formatInTimeZone(event.resource.rawStart, selectedTimzeone, 'yyyy-MM-dd');
    const timeStr = formatInTimeZone(event.resource.rawStart, selectedTimzeone, 'HH:mm');
    setEditAppointment({
      id: event.id,
      patientName: event.title,
      phone: event.resource.phone,
      date: dateStr,
      time: timeStr,
      notes: event.resource.notes || '',
      status: event.resource.status
    });
  };

  const handleDeleteAppointment = async () => {
    if (!selectedEvent) return;
    const confirmDelete = window.confirm("Are you sure you want to delete this appointment?");
    if (!confirmDelete) return;

    const { data, error } = await supabase.from('appointments').delete().eq('id', selectedEvent.id).select();

    if (error) {
      toast({ variant: 'destructive', title: 'Database Error', description: error.message });
    } else if (!data || data.length === 0) {
      toast({ variant: 'destructive', title: 'Delete Failed (RLS)', description: 'Your Supabase database blocked the deletion due to Row-Level Security. Please update your DELETE policy to check for doctor_id.' });
    } else {
      toast({ title: 'Deleted', description: 'Appointment has been removed.' });
      setIsViewDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedEvent || !user) return;
    const { data, error } = await supabase.from('appointments')
      .update({ status: newStatus })
      .eq('id', selectedEvent.id)
      .select();

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else if (data && data.length > 0) {
      toast({ title: 'Status Updated', description: `Marked as ${STATUS_COLORS[newStatus]?.label || newStatus}.` });
      setSelectedEvent({ ...selectedEvent, resource: { ...selectedEvent.resource, status: newStatus } });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });

      // Auto-add patient to CRM when marked as 'completed' (showed up)
      if (newStatus === 'completed' && selectedEvent.title) {
        const patientName = selectedEvent.title;
        const patientPhone = selectedEvent.resource.phone;

        // Check if patient already exists in CRM by phone
        const { data: existing } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user.id)
          .or(patientPhone ? `phone.eq.${patientPhone}` : `first_name.eq.${patientName}`)
          .maybeSingle();

        if (!existing) {
          // Split name into first/last
          const nameParts = patientName.trim().split(/\s+/);
          const firstName = nameParts[0] || patientName;
          const lastName = nameParts.slice(1).join(' ') || '';

          const { error: crmError } = await supabase.from('patients').insert({
            user_id: user.id,
            first_name: firstName,
            last_name: lastName,
            phone: patientPhone || '',
          });

          if (!crmError) {
            toast({ title: 'Patient Added', description: `${patientName} has been added to your CRM.` });
          }
        }
      }
    }
  };

  const handleUpdateAppointment = async () => {
    if (!user || !editAppointment.id) return;
    if (!editAppointment.patientName || !editAppointment.date || !editAppointment.time) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill in Name, Date, and Time.' });
      return;
    }

    const startDateTime = new Date(`${editAppointment.date}T${editAppointment.time}`);
    const endDateTime = new Date(startDateTime.getTime() + slotDuration * 60000);

    const { data, error } = await supabase.from('appointments').update({
        patient_name: editAppointment.patientName,
        patient_phone: editAppointment.phone,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        notes: editAppointment.notes,
        status: editAppointment.status
      }).eq('id', editAppointment.id).select();

    if (error) {
      if (error.message.includes('Capacité du créneau atteinte')) {
         toast({ variant: 'destructive', title: 'Créneau Complet', description: 'Vous avez atteint votre capacité maximum pour cet horaire.' });
      } else {
         toast({ variant: 'destructive', title: 'Database Error', description: error.message });
      }
    } else if (!data || data.length === 0) {
      toast({ variant: 'destructive', title: 'Update Failed (RLS)', description: 'Your Supabase database blocked the update due to Row-Level Security. Please update your UPDATE policy to check for doctor_id.' });
    } else {
      toast({ title: 'Updated', description: 'Appointment updated successfully.' });
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    }
  };

  const onEventDrop = async ({ event, start, end }: any) => {
    const { data, error } = await supabase.from('appointments').update({
        start_time: start.toISOString(),
        end_time: end.toISOString()
      }).eq('id', event.id).select();

    if (error) {
      if (error.message.includes('Capacité du créneau atteinte')) {
         toast({ variant: 'destructive', title: 'Créneau Complet', description: 'Vous avez atteint votre capacité maximum pour cet horaire.' });
      } else {
         toast({ variant: 'destructive', title: 'Database Error', description: error.message });
      }
    } else if (!data || data.length === 0) {
       toast({ variant: 'destructive', title: 'Drag & Drop Failed (RLS)', description: 'Row-Level Security blocked this move. Update your UPDATE policy.' });
    } else {
      toast({ title: 'Moved', description: 'Appointment time updated.' });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    }
  };

  const selectedStatusInfo = selectedEvent ? STATUS_COLORS[selectedEvent.resource.status] || STATUS_COLORS.confirmed : STATUS_COLORS.confirmed;

  return (
    <AppLayout>
      <OnboardingPopup pageKey="appointments" steps={ONBOARDING_CONFIGS.appointments} />
      <div className="space-y-4 h-auto md:h-[calc(100vh-100px)] flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{labels.pageTitle}</h1>
            <p className="text-muted-foreground">{labels.pageDesc}</p>
            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
               <span className="text-sm font-medium text-muted-foreground">Timezone:</span>
               <Select value={selectedTimzeone} onValueChange={setSelectedTimezone}>
                 <SelectTrigger className="w-full sm:w-[220px] h-8 text-xs font-semibold">
                    <SelectValue placeholder="Select timezone" />
                 </SelectTrigger>
                 <SelectContent>
                   {popularTimezones.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                   ))}
                   {!popularTimezones.find(t => t.value === browserIz) && (
                      <SelectItem value={browserIz}>Local ({browserIz})</SelectItem>
                   )}
                 </SelectContent>
               </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setIsShareDialogOpen(true)}
            >
              <Share2 className="h-4 w-4" />
              Share Booking Link
            </Button>
            <Button
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {labels.bookBtn}
            </Button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="glass border-[hsl(var(--glass-border))] cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('all')}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-[hsl(var(--glass-border))] cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('confirmed')}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2589D020' }}>
                <CheckCircle2 className="h-5 w-5" style={{ color: '#2589D0' }} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.confirmed}</p>
                <p className="text-xs text-muted-foreground">Confirmed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-[hsl(var(--glass-border))] cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('completed')}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-[hsl(var(--glass-border))] cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('no_show')}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <UserX className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.noShow}</p>
                <p className="text-xs text-muted-foreground">No Show</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Filter Legend */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Filter:</span>
          <Badge
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setStatusFilter('all')}
          >
            All
          </Badge>
          {Object.entries(STATUS_COLORS).map(([key, val]) => (
            <Badge
              key={key}
              variant={statusFilter === key ? 'default' : 'outline'}
              className="cursor-pointer text-xs gap-1"
              style={statusFilter === key ? { backgroundColor: val.bg, borderColor: val.bg } : { borderColor: val.bg, color: val.bg }}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: val.bg }} />
              {val.label}
            </Badge>
          ))}
        </div>

        {/* Calendar Card */}
        <Card className="flex-1 glass border-[hsl(var(--glass-border))] overflow-hidden flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Calendar View</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-2 md:p-4 min-h-[350px] md:min-h-[500px]">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <DnDCalendar
                localizer={localizer}
                events={filteredEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                views={['month', 'week', 'day', 'agenda']}
                view={view}
                onView={setView}
                onSelectEvent={handleSelectEvent}
                onEventDrop={onEventDrop}
                resizable={false}
                draggableAccessor={() => true}
                popup={true}
                components={{
                  event: ({ event }) => (
                    <div className="flex flex-col h-full items-start justify-center px-1 overflow-hidden pointer-events-none">
                      <span className="font-bold text-xs truncate w-full">
                        {formatInTimeZone(event.resource.rawStart, selectedTimzeone, 'HH:mm')} - {event.title}
                      </span>
                    </div>
                  )
                }}
                eventPropGetter={(event: AppointmentEvent) => {
                  const statusColor = STATUS_COLORS[event.resource.status]?.bg || '#2589D0';
                  return {
                    style: {
                      backgroundColor: statusColor,
                      color: 'white',
                      borderRadius: '6px',
                      border: 'none',
                      padding: '2px 4px',
                      fontSize: '12px',
                    },
                  };
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* VIEW Dialog with Status Actions */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="glass-card">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle>{selectedEvent?.title}</DialogTitle>
                <Badge style={{ backgroundColor: selectedStatusInfo.bg }} className="text-white text-xs">
                  {selectedStatusInfo.label}
                </Badge>
              </div>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">
                  {selectedEvent ? formatInTimeZone(selectedEvent.resource.rawStart, selectedTimzeone, 'PPP p') : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <span>{selectedEvent?.title}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <span>{selectedEvent?.resource.phone || 'No phone'}</span>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{selectedEvent?.resource.notes || 'No notes.'}</p>
              </div>

              {/* Quick Status Actions */}
              <div className="pt-2 border-t">
                <Label className="text-xs text-muted-foreground mb-2 block">Mark Attendance</Label>
                <div className="flex gap-2 flex-wrap">
                  {selectedEvent?.resource.status !== 'completed' && (
                    <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleStatusChange('completed')}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Showed Up
                    </Button>
                  )}
                  {selectedEvent?.resource.status !== 'no_show' && (
                    <Button size="sm" variant="outline" className="gap-1 text-violet-600 border-violet-200 hover:bg-violet-50" onClick={() => handleStatusChange('no_show')}>
                      <UserX className="h-3.5 w-3.5" /> No Show
                    </Button>
                  )}
                  {selectedEvent?.resource.status !== 'cancelled' && (
                    <Button size="sm" variant="outline" className="gap-1 text-slate-500 border-slate-200 hover:bg-slate-50" onClick={() => handleStatusChange('cancelled')}>
                      <XCircle className="h-3.5 w-3.5" /> Cancel
                    </Button>
                  )}
                  {selectedEvent?.resource.status !== 'confirmed' && (
                    <Button size="sm" variant="outline" className="gap-1 border-blue-200 hover:bg-blue-50" style={{ color: '#2589D0' }} onClick={() => handleStatusChange('confirmed')}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Re-confirm
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="flex justify-between w-full sm:justify-between">
              <Button variant="destructive" onClick={handleDeleteAppointment} className="gap-2">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
                <Button onClick={() => { setIsViewDialogOpen(false); setIsEditDialogOpen(true); }} className="gap-2">
                  <Edit3 className="h-4 w-4" /> Edit
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* EDIT Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="glass-card sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{labels.editTitle}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">{labels.personName}</Label>
                <Input
                  id="edit-name"
                  value={editAppointment.patientName}
                  onChange={(e) => setEditAppointment({...editAppointment, patientName: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  value={editAppointment.phone}
                  onChange={(e) => setEditAppointment({...editAppointment, phone: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-date">Date</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editAppointment.date}
                    onChange={(e) => setEditAppointment({...editAppointment, date: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-time">Time</Label>
                  <Input
                    id="edit-time"
                    type="time"
                    value={editAppointment.time}
                    onChange={(e) => setEditAppointment({...editAppointment, time: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={editAppointment.status} onValueChange={(v) => setEditAppointment({...editAppointment, status: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_COLORS).map(([key, val]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: val.bg }} />
                          {val.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Input
                  id="edit-notes"
                  value={editAppointment.notes}
                  onChange={(e) => setEditAppointment({...editAppointment, notes: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateAppointment}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CREATE Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="glass-card sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{labels.newTitle}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{labels.personName}</Label>
                <Input
                  id="name"
                  value={newAppointment.patientName}
                  onChange={(e) => setNewAppointment({...newAppointment, patientName: e.target.value})}
                  placeholder={labels.namePlaceholder}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={newAppointment.phone}
                  onChange={(e) => setNewAppointment({...newAppointment, phone: e.target.value})}
                  placeholder="+212..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newAppointment.date}
                    onChange={(e) => setNewAppointment({...newAppointment, date: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={newAppointment.time}
                    onChange={(e) => setNewAppointment({...newAppointment, time: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">{labels.notesLabel}</Label>
                <Input
                  id="notes"
                  value={newAppointment.notes}
                  onChange={(e) => setNewAppointment({...newAppointment, notes: e.target.value})}
                  placeholder={labels.notesPlaceholder}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateAppointment}>Book Appointment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* SHARE BOOKING LINK Dialog */}
        <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
          <DialogContent className="glass-card sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" />
                Share Booking Link
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Share this link with your patients so they can book appointments directly from their browser.
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={publicBookingUrl || 'Loading...'}
                  className="font-mono text-sm bg-secondary/50"
                />
                <Button onClick={handleCopyLink} variant="outline" className="shrink-0 gap-2">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  Patients will only see available time slots and can book without creating an account.
                  You'll see their bookings appear in your calendar automatically.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
