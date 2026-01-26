import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchDashboardStats, fetchAppointments } from '@/services/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import {
  Calendar,
  CheckCircle2,
  Clock,
  TrendingUp,
  MessageSquare,
  Users,
  Wallet,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Helper for animation
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const { profile } = useAuth(); // <--- This contains the LIVE credits

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
  });

  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: fetchAppointments,
  });

  const upcomingAppointments = appointments?.filter(
    (a) => a.status !== 'cancelled'
  ).slice(0, 3);

  const clinicName = profile?.clinic_name || 'Doctor';

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Welcome back, <span className="text-gradient">{clinicName}</span>
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening with your AI receptionist today.
            </p>
          </div>
          
          {/* THE NEW WALLET CARD */}
          <Card className="glass-card border-primary/20 bg-primary/5 min-w-[250px]">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Available Credits</p>
                <div className="flex items-baseline gap-1">
                   <span className="text-2xl font-bold text-primary">
                     {profile?.credits || 0}
                   </span>
                   <span className="text-xs text-muted-foreground">msgs</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* We map the other stats manually or dynamically here */}
          {[
            { title: 'Appointments', value: stats?.totalAppointments || 0, icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { title: 'Confirmed', value: stats?.confirmedToday || 0, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
            { title: 'Pending', value: stats?.pendingReview || 0, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
            { title: 'AI Reply Rate', value: '100%', icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-400/10' },
          ].map((stat, i) => (
            <motion.div key={i} variants={item}>
              <Card className="glass-card border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                      <p className="text-2xl font-bold">
                        {statsLoading ? <span className="animate-pulse">...</span> : stat.value}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.bg}`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Recent Appointments */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Upcoming Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appointmentsLoading ? (
                <div className="space-y-3">
                   {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-secondary/50 rounded-lg animate-pulse" />)}
                </div>
              ) : upcomingAppointments && upcomingAppointments.length > 0 ? (
                <div className="space-y-3">
                  {upcomingAppointments.map((appointment) => (
                    <div key={appointment.id} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">{appointment.patient_name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-medium">{appointment.patient_name}</p>
                          <p className="text-sm text-muted-foreground">{appointment.service_type || 'General Checkup'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{new Date(appointment.date_time).toLocaleDateString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(appointment.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No upcoming appointments</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}