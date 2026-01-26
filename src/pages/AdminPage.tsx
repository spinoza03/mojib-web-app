import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { fetchAdminStats, fetchAllClinics, type ClinicWithEmail } from '@/services/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Building2, Bot, Calendar, Loader2 } from 'lucide-react';

export default function AdminPage() {
  const { profile } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: fetchAdminStats,
  });

  const { data: clinics, isLoading: clinicsLoading } = useQuery({
    queryKey: ['allClinics'],
    queryFn: fetchAllClinics,
  });

  // Redirect if not superuser (handled by protected route, but double-check)
  if (profile?.role !== 'superuser') {
    return null;
  }

  const statCards = [
    {
      title: 'Total Clinics',
      value: stats?.totalClinics ?? 0,
      icon: Building2,
      color: 'text-[#ef4444]',
      bgColor: 'bg-[#ef4444]/10',
    },
    {
      title: 'Active Bots',
      value: stats?.activeBots ?? 0,
      icon: Bot,
      color: 'text-[#ef4444]',
      bgColor: 'bg-[#ef4444]/10',
    },
    {
      title: 'Total Appointments',
      value: stats?.totalAppointments ?? 0,
      icon: Calendar,
      color: 'text-[#ef4444]',
      bgColor: 'bg-[#ef4444]/10',
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2 text-white">
            Admin <span className="text-[#ef4444]">Panel</span>
          </h1>
          <p className="text-muted-foreground">
            Manage all clinics and monitor system-wide statistics.
          </p>
        </div>

        {/* Global Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-[#050505] border-[#ef4444]/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {stat.title}
                      </p>
                      <p className="text-3xl font-bold text-white">
                        {statsLoading ? (
                          <Loader2 className="h-6 w-6 animate-spin text-[#ef4444]" />
                        ) : (
                          stat.value
                        )}
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Clinics Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-[#050505] border-[#ef4444]/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#ef4444]" />
                All Clinics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clinicsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#ef4444]" />
                </div>
              ) : clinics && clinics.length > 0 ? (
                <div className="rounded-md border border-[#ef4444]/20">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#ef4444]/20 hover:bg-[#ef4444]/5">
                        <TableHead className="text-white">Clinic Name</TableHead>
                        <TableHead className="text-white">Email</TableHead>
                        <TableHead className="text-white">WhatsApp Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clinics.map((clinic) => (
                        <TableRow
                          key={clinic.id}
                          className="border-[#ef4444]/20 hover:bg-[#ef4444]/5"
                        >
                          <TableCell className="font-medium text-white">
                            {clinic.clinic_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {clinic.email || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                clinic.whatsapp_status === 'connected'
                                  ? 'default'
                                  : 'secondary'
                              }
                              className={
                                clinic.whatsapp_status === 'connected'
                                  ? 'bg-[#ef4444] text-white'
                                  : 'bg-muted text-muted-foreground'
                              }
                            >
                              {clinic.whatsapp_status === 'connected'
                                ? 'Connected'
                                : 'Disconnected'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No clinics found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
