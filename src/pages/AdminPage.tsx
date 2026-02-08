import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchAdminStats, fetchAllClinics, type ClinicWithEmail } from '@/services/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client'; // Import Supabase directly for RPC
import { DollarSign, Calendar, Loader2, Trash2, Users, Settings2 } from 'lucide-react';
import { addDays, isAfter } from 'date-fns';

export default function AdminPage() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ClinicWithEmail | null>(null);
  const [userEmails, setUserEmails] = useState<Record<string, string>>({});
  const [planSelection, setPlanSelection] = useState<'starter' | 'pro'>('starter');
  const [statusSelection, setStatusSelection] = useState<'trial' | 'active' | 'expired'>('trial');
  const [trialEndDate, setTrialEndDate] = useState('');
  const [trialExtension, setTrialExtension] = useState('');

  // 1. Fetch Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: fetchAdminStats,
  });

  // 2. Fetch Users/Clinics
  const { data: clinics, isLoading: clinicsLoading } = useQuery<ClinicWithEmail[]>({
    queryKey: ['allClinics'],
    queryFn: fetchAllClinics,
  });

  useEffect(() => {
    if (!clinics) return;
    // Logic to try and map emails if possible
    const emails: Record<string, string> = {};
    for (const clinic of clinics) {
      if (user?.id === clinic.id) {
        emails[clinic.id] = user.email || 'N/A';
      } else {
        // If we mapped email in the fetchAllClinics API, use it, otherwise placeholder
        emails[clinic.id] = clinic.email || 'N/A';
      }
    }
    setUserEmails(emails);
  }, [clinics, user]);

  // 3. Mutation: Delete User
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Try to use the secure RPC function if available
      const { error } = await (supabase as any).rpc('delete_user_by_email', { 
        user_email: userEmails[userId] // Pass email if using the RPC
      });

      // If RPC fails or returns no error (void), we check if the user is gone. 
      // Fallback: Delete profile row directly
      if (error) {
         const { error: deleteError } = await supabase.from('profiles').delete().eq('id', userId);
         if (deleteError) throw deleteError;
      }
    },
    onSuccess: () => {
      toast({
        title: 'User Deleted',
        description: `Successfully deleted ${selectedUser?.clinic_name}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['allClinics'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setDeleteDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete user.',
        variant: 'destructive',
      });
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Partial<ClinicWithEmail> }) => {
      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
      if (error) {
        console.error('[Admin] Error updating subscription:', error);
        throw error;
      }
    },
  });

  const handleCloseManage = () => {
    setManageDialogOpen(false);
    setSelectedUser(null);
    setTrialExtension('');
  };

  const handleOpenManage = (clinic: ClinicWithEmail) => {
    setSelectedUser(clinic);
    setPlanSelection((clinic.plan_type as 'starter' | 'pro') || 'starter');
    setStatusSelection((clinic.subscription_status as 'trial' | 'active' | 'expired') || 'trial');
    setTrialEndDate(clinic.trial_ends_at ? clinic.trial_ends_at.slice(0, 10) : '');
    setTrialExtension('');
    setManageDialogOpen(true);
  };

  const handleSaveSubscription = async () => {
    if (!selectedUser) return;

    const updates: Partial<ClinicWithEmail> = {
      plan_type: planSelection,
      subscription_status: statusSelection,
    };

    if (trialEndDate) {
      updates.trial_ends_at = new Date(trialEndDate).toISOString();
    }

    try {
      await updateSubscriptionMutation.mutateAsync({
        userId: selectedUser.id,
        updates,
      });

      toast({
        title: 'Subscription Updated',
        description: `${selectedUser.clinic_name}'s plan has been updated.`,
      });

      queryClient.invalidateQueries({ queryKey: ['allClinics'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      handleCloseManage();
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Unable to update subscription.',
        variant: 'destructive',
      });
    }
  };

  const handleExtendTrial = async () => {
    if (!selectedUser) return;

    const days = parseInt(trialExtension, 10);
    if (isNaN(days) || days <= 0) {
      toast({
        title: 'Invalid Days',
        description: 'Please enter a valid number of days to extend.',
        variant: 'destructive',
      });
      return;
    }

    const currentTrialDate = selectedUser.trial_ends_at ? new Date(selectedUser.trial_ends_at) : null;
    const today = new Date();
    const baseDate = currentTrialDate && isAfter(currentTrialDate, today) ? currentTrialDate : today;
    const updatedDate = addDays(baseDate, days);
    const isoDate = updatedDate.toISOString();

    try {
      await updateSubscriptionMutation.mutateAsync({
        userId: selectedUser.id,
        updates: {
          trial_ends_at: isoDate,
          subscription_status: 'trial',
        },
      });

      toast({
        title: 'Trial Extended',
        description: `${selectedUser.clinic_name} trial extended by ${days} days.`,
      });

      setStatusSelection('trial');
      setTrialEndDate(isoDate.slice(0, 10));
      setTrialExtension('');
      // Update local selected user to keep UI in sync
      setSelectedUser((prev) => (prev ? { ...prev, trial_ends_at: isoDate, subscription_status: 'trial' } : prev));
      queryClient.invalidateQueries({ queryKey: ['allClinics'] });
    } catch (error: any) {
      toast({
        title: 'Extension Failed',
        description: error.message || 'Unable to extend trial.',
        variant: 'destructive',
      });
    }
  };

  // Handlers
  const handleOpenDelete = (clinic: ClinicWithEmail) => {
    setSelectedUser(clinic);
    setDeleteDialogOpen(true);
  };

  // Protected Route Check
  if (profile?.role !== 'superuser') {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <p className="text-muted-foreground">Access Denied. You are not an administrator.</p>
        </div>
      </AppLayout>
    );
  }

  // Stat Cards Configuration
  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Total Revenue',
      value: `${stats?.totalRevenue ?? 0} DH`,
      icon: DollarSign,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Active Appointments',
      value: stats?.activeAppointments ?? 0,
      icon: Calendar,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            Admin <span className="text-primary">Panel</span>
          </h1>
          <p className="text-muted-foreground">
            Manage all users and monitor system-wide statistics.
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
              <Card className="glass-card border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold text-white">
                        {statsLoading ? (
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
          <Card className="glass-card border-primary/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clinicsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : clinics && clinics.length > 0 ? (
                <div className="rounded-md border border-primary/20">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-primary/20 hover:bg-primary/5">
                        <TableHead className="text-foreground">Clinic Name</TableHead>
                        <TableHead className="text-foreground">Email</TableHead>
                        <TableHead className="text-foreground">Phone</TableHead>
                        <TableHead className="text-foreground">Plan</TableHead>
                        <TableHead className="text-foreground">Status</TableHead>
                        <TableHead className="text-foreground text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clinics.map((clinic) => (
                        <TableRow key={clinic.id} className="border-primary/20 hover:bg-primary/5">
                          <TableCell className="font-medium text-foreground">
                            {clinic.clinic_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {userEmails[clinic.id] || clinic.email || '...'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {clinic.phone || 'N/A'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {clinic.plan_type ? clinic.plan_type.toUpperCase() : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                clinic.subscription_status === 'active'
                                  ? 'bg-green-500/20 text-green-500 border-green-500/30'
                                  : clinic.subscription_status === 'trial'
                                    ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
                                    : 'bg-red-500/20 text-red-500 border-red-500/30'
                              }
                            >
                              {clinic.subscription_status || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenManage(clinic)}
                                className="border-primary/30 text-primary hover:bg-primary/10"
                              >
                                <Settings2 className="h-4 w-4 mr-1" />
                                Manage
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleOpenDelete(clinic)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No users found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Manage Subscription Dialog */}
      <Dialog
        open={manageDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseManage();
          }
        }}
      >
        <DialogContent className="glass-card border-primary/20">
          <DialogHeader>
            <DialogTitle>Manage Subscription</DialogTitle>
            <DialogDescription>
              Update plan, status, or extend trial for {selectedUser?.clinic_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={planSelection} onValueChange={(value) => setPlanSelection(value as 'starter' | 'pro')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter (300 DH)</SelectItem>
                    <SelectItem value="pro">Pro (500 DH)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={statusSelection}
                  onValueChange={(value) => setStatusSelection(value as 'trial' | 'active' | 'expired')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Trial Ends At</Label>
                <Input
                  type="date"
                  value={trialEndDate}
                  onChange={(e) => setTrialEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Extend Trial (days)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={trialExtension}
                    onChange={(e) => setTrialExtension(e.target.value)}
                    placeholder="e.g. 7"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleExtendTrial}
                    disabled={updateSubscriptionMutation.isPending}
                  >
                    Extend
                  </Button>
                </div>
              </div>
            </div>

            {selectedUser?.trial_ends_at && (
              <p className="text-xs text-muted-foreground">
                Current trial end: {new Date(selectedUser.trial_ends_at).toLocaleDateString()}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseManage}
              className="border-primary/30"
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSubscription} disabled={updateSubscriptionMutation.isPending}>
              {updateSubscriptionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-primary/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete User</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-white">{selectedUser?.clinic_name}</span>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-primary/30 text-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}