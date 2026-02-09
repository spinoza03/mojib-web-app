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
import { Plus, Loader2, Phone, User, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth'; 
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '@/App.css';

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

      return data.map((apt: any) => ({
        id: apt.id,
        title: apt.patient_name || 'Unknown',
        start: new Date(apt.start_time),
        end: new Date(apt.end_time),
        resource: {
          phone: apt.patient_phone,
          notes: apt.notes,
          status: apt.status,
        },
      })) as AppointmentEvent[];
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
  };

  return (
    <AppLayout>
      <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Appointments</h1>
            <p className="text-muted-foreground">Manage your clinic's schedule.</p>
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
              <Calendar
                localizer={localizer}
                events={events || []}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                views={['month', 'week', 'day', 'agenda']}
                view={view}
                onView={setView}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={(event) => ({
                  style: {
                    backgroundColor: event.resource.status === 'confirmed' ? '#ef4444' : '#22c55e',
                    color: 'white',
                    borderRadius: '4px',
                    border: 'none',
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
            <DialogFooter><Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button></DialogFooter>
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
//just to push