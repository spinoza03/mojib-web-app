import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Users, Clock, ArrowRight, Activity, Loader2, Bot, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user, profile, isNicheActive } = useAuth();

  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Stats State
  const [stats, setStats] = useState({
    totalAppointments: 0,
    upcomingAppointments: 0,
    totalPatients: 0,
  });

  // Upcoming List State
  const [upcomingList, setUpcomingList] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user?.id) return;

      try {
        const now = new Date().toISOString();

        // 1. Get Total Appointments (Fixed: Filter by doctor_id)
        const { count: totalCount } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('doctor_id', user.id); // <--- CRITICAL SECURITY FIX

        // 2. Get Upcoming Count (Fixed: Filter by doctor_id & Time)
        const { count: upcomingCount } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('doctor_id', user.id)
          .gte('start_time', now); // Only future dates

        // 3. Get Unique Patients Count (Approximation by counting rows for now)
        // In a real app, you might have a separate 'patients' table
        const { count: patientsCount } = await supabase
          .from('appointments')
          .select('patient_phone', { count: 'exact', head: true })
          .eq('doctor_id', user.id);

        setStats({
          totalAppointments: totalCount || 0,
          upcomingAppointments: upcomingCount || 0,
          totalPatients: patientsCount || 0,
        });

        // 4. Fetch actual list of next 5 appointments
        const { data: upcomingData } = await supabase
          .from('appointments')
          .select('*')
          .eq('doctor_id', user.id)
          .gte('start_time', now)
          .order('start_time', { ascending: true }) // Closest first
          .limit(5);

        if (upcomingData) {
          setUpcomingList(upcomingData);
        }

      } catch (error) {
        console.error("Error loading dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [user]);

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {greeting}, {profile?.clinic_name || 'Doctor'}
            </h1>
            <p className="text-muted-foreground mt-1">
              Here is what's happening in your clinic today.
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => navigate('/appointments')} className="bg-primary hover:bg-primary/90">
              <Calendar className="mr-2 h-4 w-4" />
              View Calendar
            </Button>
            <Button variant="outline" onClick={() => navigate('/settings')}>
              Manage Bot
            </Button>
          </div>
        </div>

        {/* Coming Soon for inactive niches */}
        {!isNicheActive && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-6 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-yellow-500/20 flex items-center justify-center">
                <Bot className="h-8 w-8 text-yellow-500" />
              </div>
              <h3 className="text-xl font-bold text-yellow-400">🚧 AI Features Coming Soon</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                AI-powered features for your industry are under development. Calendar and appointment management are available now!
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => navigate('/appointments')} className="bg-primary hover:bg-primary/90">
                  <Calendar className="mr-2 h-4 w-4" /> View Calendar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(`https://wa.me/212600000000?text=${encodeURIComponent('Hello, I want to know when my industry will be supported on Mojib.AI.')}`, '_blank')}
                  className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
                >
                  <MessageSquare className="mr-2 h-4 w-4" /> Contact Support
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-2xl font-bold">{stats.totalAppointments}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">All time bookings</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-2xl font-bold">{stats.upcomingAppointments}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Scheduled for future</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-2xl font-bold">{stats.totalPatients}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Unique contacts</p>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming List Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4 glass-card">
            <CardHeader>
              <CardTitle>Upcoming Appointments</CardTitle>
              <CardDescription>
                Your next 5 scheduled visits.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : upcomingList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No upcoming appointments found.</p>
                  <Button variant="link" onClick={() => navigate('/appointments')} className="mt-2">
                    Schedule one now
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingList.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-secondary/10 border border-white/5 hover:bg-secondary/20 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {apt.patient_name ? apt.patient_name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <p className="font-medium">{apt.patient_name || 'Unknown Patient'}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(apt.start_time), 'PPP')} at {format(new Date(apt.start_time), 'p')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                           {apt.status}
                         </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions / Promo Card */}
          <Card className="col-span-3 glass-card bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
             <CardHeader>
               <CardTitle>Connect WhatsApp</CardTitle>
               <CardDescription>
                 Is your AI receptionist active?
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${profile?.whatsapp_status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-medium capitalize">{profile?.whatsapp_status || 'Disconnected'}</span>
               </div>
               <p className="text-sm text-muted-foreground">
                 Scan the QR code to let the AI handle your patient bookings automatically 24/7.
               </p>
               <Button onClick={() => navigate('/connect')} className="w-full">
                 Check Connection <ArrowRight className="ml-2 h-4 w-4" />
               </Button>
             </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}