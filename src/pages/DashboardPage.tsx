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
} from 'lucide-react';

const statCards = [
  {
    title: 'Total Appointments',
    key: 'totalAppointments' as const,
    icon: Calendar,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  {
    title: 'Confirmed Today',
    key: 'confirmedToday' as const,
    icon: CheckCircle2,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  {
    title: 'Pending Review',
    key: 'pendingReview' as const,
    icon: Clock,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  {
    title: 'Conversion Rate',
    key: 'conversionRate' as const,
    icon: TrendingUp,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    suffix: '%',
  },
  {
    title: 'AI Interactions',
    key: 'aiInteractions' as const,
    icon: MessageSquare,
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const { profile } = useAuth();

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
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, <span className="text-gradient">{clinicName}</span>
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your AI receptionist today.
          </p>
        </div>

        {/* Stats Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          {statCards.map((stat) => (
            <motion.div key={stat.key} variants={item}>
              <Card className="glass-card border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold">
                        {statsLoading ? (
                          <span className="animate-pulse">...</span>
                        ) : (
                          <>
                            {stats?.[stat.key] ?? 0}
                            {stat.suffix}
                          </>
                        )}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.bgColor}`}>
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
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 bg-secondary/50 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : upcomingAppointments && upcomingAppointments.length > 0 ? (
                <div className="space-y-3">
                  {upcomingAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {appointment.patient_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {appointment.patient_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {appointment.service_type}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {new Date(appointment.date_time).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(appointment.date_time).toLocaleTimeString(
                            [],
                            {
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No upcoming appointments</p>
                  <p className="text-sm">New appointments will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
