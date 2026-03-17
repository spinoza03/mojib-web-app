import { useState } from 'react';
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
import { Plus, Loader2, Phone, User, FileText, Trash2, Edit3, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toDate, formatInTimeZone } from 'date-fns-tz';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth'; 
import 'react-big-calendar/lib/css/react-big-calendar.css';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '@/App.css';

const DnDCalendar = withDragAndDrop(Calendar);

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface AppointmentEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    phone: string;
    notes?: string;
    status: string;
  };
}

export default function AppointmentsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State for View Dialog
  const [selectedEvent, setSelectedEvent] = useState<AppointmentEvent | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  
  // State for Edit Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editAppointment, setEditAppointment] = useState({
    id: '',
    patientName: '',
    phone: '',
    date: '',
    time: '',
    notes: '',
    status: ''
  });
  
  // State for Create Dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    patientName: '',
    phone: '',
    date: '',
    time: '',
    notes: ''
  });

  const [view, setView] = useState<View>(Views.MONTH);
  
  // Default timezone fallback if VPN is completely wrong or user prefers manual override
  const browserIz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const popularTimezones = [
    { value: 'UTC', label: 'UTC (GMT+0)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Africa/Casablanca', label: 'Casablanca (Morocco)' },
    { value: 'America/New_York', label: 'New York (EST/EDT)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: browserIz, label: `Local (${browserIz})` }
  ];
  
  // Try to use browser Iz if it exists in the list to avoid duplicate entries, 
  // otherwise we can just inject it. But for ease, we start with the assumed local.
  const [selectedTimzeone, setSelectedTimezone] = useState(browserIz || 'Africa/Casablanca');

  // 1. FIXED QUERY: Filter by doctor_id
  const { data: events, isLoading } = useQuery({
    queryKey: ['appointments', user?.id], // Dependent on user.id
    queryFn: async () => {
      if (!user?.id) return [];

      // SECURITY FIX: Only fetch appointments for the logged-in doctor
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', user.id); // <--- The Critical Fix

      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        throw error;
      }

      return data.map((apt: any) => {
        // apt.start_time is UTC from db. 
        // We need to convert it visually into 'selectedTimzeone' objects for react-big-calendar
        
        // date-fns-tz trick: We read the UTC string, convert to destination timezone string, 
        // and parse it back to a naive Date object so the calendar renders it exactly at that visual hour.
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
            rawStart: apt.start_time, // keep real UTC strings for DB updates
            rawEnd: apt.end_time
          },
        };
      }) as AppointmentEvent[];
    },
    enabled: !!user?.id, // Don't run query until user is loaded
  });

  // 2. Handle Create Submit
  const handleCreateAppointment = async () => {
    if (!user) return;
    if (!newAppointment.patientName || !newAppointment.date || !newAppointment.time) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill in Name, Date, and Time.' });
      return;
    }

    const startDateTime = new Date(`${newAppointment.date}T${newAppointment.time}`);
    const endDateTime = new Date(startDateTime.getTime() + 30 * 60000); // 30 mins

    const { error } = await supabase.from('appointments').insert({
      doctor_id: user.id, // Assign to current user
      patient_name: newAppointment.patientName,
      patient_phone: newAppointment.phone,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      status: 'confirmed',
      notes: newAppointment.notes
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
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
    
    // Convert back from the visual naive Date back into the selected timezone string representation for formatting
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

    // SECURITY DIAGNOSIS: We append .select() to see if RLS actually allowed the delete.
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

  const handleUpdateAppointment = async () => {
    if (!user || !editAppointment.id) return;
    if (!editAppointment.patientName || !editAppointment.date || !editAppointment.time) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill in Name, Date, and Time.' });
      return;
    }

    const startDateTime = new Date(`${editAppointment.date}T${editAppointment.time}`);
    const endDateTime = new Date(startDateTime.getTime() + 30 * 60000); 

    // SECURITY DIAGNOSIS: We append .select() to ensure RLS permitted the update.
    const { data, error } = await supabase.from('appointments').update({
        patient_name: editAppointment.patientName,
        patient_phone: editAppointment.phone,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        notes: editAppointment.notes,
        status: editAppointment.status
      }).eq('id', editAppointment.id).select();

    if (error) {
      toast({ variant: 'destructive', title: 'Database Error', description: error.message });
    } else if (!data || data.length === 0) {
      toast({ variant: 'destructive', title: 'Update Failed (RLS)', description: 'Your Supabase database blocked the update due to Row-Level Security. Please update your UPDATE policy to check for doctor_id.' });
    } else {
      toast({ title: 'Updated', description: 'Appointment updated successfully.' });
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    }
  };

  const onEventDrop = async ({ event, start, end }: any) => {
    // SECURITY DIAGNOSIS: Append .select() for drag-and-drop as well.
    const { data, error } = await supabase.from('appointments').update({
        start_time: start.toISOString(),
        end_time: end.toISOString()
      }).eq('id', event.id).select();

    if (error) {
      toast({ variant: 'destructive', title: 'Database Error', description: error.message });
    } else if (!data || data.length === 0) {
       toast({ variant: 'destructive', title: 'Drag & Drop Failed (RLS)', description: 'Row-Level Security blocked this move. Update your UPDATE policy.' });
    } else {
      toast({ title: 'Moved', description: 'Appointment time updated.' });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    }
  };

  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <AppLayout>
      <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Appointments</h1>
            <p className="text-muted-foreground">Manage your clinic's schedule.</p>
            <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
               <span className="text-sm font-medium text-muted-foreground">Timezone:</span>
               <Select value={selectedTimzeone} onValueChange={setSelectedTimezone}>
                 <SelectTrigger className="w-[220px] h-8 text-xs font-semibold">
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
          <Button 
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Manual Booking
          </Button>
        </div>

        <Card className="flex-1 glass border-[hsl(var(--glass-border))] overflow-hidden flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Calendar View</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4 min-h-[500px]">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <DnDCalendar
                localizer={localizer}
                events={events || []}
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
                eventPropGetter={(event: AppointmentEvent) => ({
                  style: {
                    backgroundColor: event.resource.status === 'confirmed' ? '#ef4444' : '#22c55e',
                    color: 'white',
                    borderRadius: '4px',
                    border: 'none',
                    padding: '2px',
                  },
                })}
              />
            )}
          </CardContent>
        </Card>

        {/* VIEW Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="glass-card">
            <DialogHeader><DialogTitle>{selectedEvent?.title}</DialogTitle></DialogHeader>
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
              <DialogTitle>Modify Appointment</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Patient Name</Label>
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
              <DialogTitle>New Appointment</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Patient Name</Label>
                <Input 
                  id="name" 
                  value={newAppointment.patientName} 
                  onChange={(e) => setNewAppointment({...newAppointment, patientName: e.target.value})}
                  placeholder="e.g. Sara Ahmed" 
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
                <Label htmlFor="notes">Notes</Label>
                <Input 
                  id="notes" 
                  value={newAppointment.notes} 
                  onChange={(e) => setNewAppointment({...newAppointment, notes: e.target.value})}
                  placeholder="Reason for visit..." 
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateAppointment}>Book Appointment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
