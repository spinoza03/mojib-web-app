import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { fetchAdminStats, fetchAllClinics, type ClinicWithEmail } from '@/services/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client'; // Import Supabase directly for RPC
import { Building2, DollarSign, Calendar, Loader2, Plus, Trash2, Users } from 'lucide-react';

export default function AdminPage() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [addCreditsDialogOpen, setAddCreditsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ClinicWithEmail | null>(null);
  const [creditsToAdd, setCreditsToAdd] = useState<string>('');
  const [userEmails, setUserEmails] = useState<Record<string, string>>({});

  // 1. Fetch Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: fetchAdminStats,
  });

  // 2. Fetch Users/Clinics
  const { data: clinics, isLoading: clinicsLoading } = useQuery({
    queryKey: ['allClinics'],
    queryFn: fetchAllClinics,
    onSuccess: async (data) => {
      // Logic to try and map emails if possible
      const emails: Record<string, string> = {};
      for (const clinic of data) {
        if (user?.id === clinic.id) {
          emails[clinic.id] = user.email || 'N/A';
        } else {
          // If we mapped email in the fetchAllClinics API, use it, otherwise placeholder
          emails[clinic.id] = clinic.email || 'N/A';
        }
      }
      setUserEmails(emails);
    },
  });

  // 3. Mutation: Add Credits (Using the Secure RPC function)
  const addCreditsMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      // Call the secure database function "add_credits"
      const { error } = await supabase.rpc('add_credits', {
        target_user_id: userId,
        amount: amount,
      });
      
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast({
        title: 'Credits Added',
        description: `Successfully added ${creditsToAdd} credits to ${selectedUser?.clinic_name}.`,
      });
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['allClinics'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      // Reset UI
      setAddCreditsDialogOpen(false);
      setSelectedUser(null);
      setCreditsToAdd('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add credits.',
        variant: 'destructive',
      });
    },
  });

  // 4. Mutation: Delete User
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Try to use the secure RPC function if available
      const { error } = await supabase.rpc('delete_user_by_email', { 
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

  // Handlers
  const handleOpenAddCredits = (clinic: ClinicWithEmail) => {
    setSelectedUser(clinic);
    setCreditsToAdd(''); // Reset input
    setAddCreditsDialogOpen(true);
  };

  const handleOpenDelete = (clinic: ClinicWithEmail) => {
    setSelectedUser(clinic);
    setDeleteDialogOpen(true);
  };

  const handleSubmitAddCredits = () => {
    if (!selectedUser || !creditsToAdd) return;
    const credits = parseInt(creditsToAdd, 10);
    
    if (isNaN(credits) || credits <= 0) {
      toast({
        title: 'Invalid Input',
        description: 'Please enter a valid number of credits.',
        variant: 'destructive',
      });
      return;
    }

    // Trigger the mutation
    addCreditsMutation.mutate({ userId: selectedUser.id, amount: credits });
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
      color: 'text-[#ef4444]',
      bgColor: 'bg-[#ef4444]/10',
    },
    {
      title: 'Total Revenue',
      value: `${stats?.totalRevenue ?? 0}`,
      icon: DollarSign,
      color: 'text-[#ef4444]',
      bgColor: 'bg-[#ef4444]/10',
    },
    {
      title: 'Active Appointments',
      value: stats?.activeAppointments ?? 0,
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
              <Card className="glass-card border-[#ef4444]/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
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
          <Card className="glass-card border-[#ef4444]/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-[#ef4444]" />
                User Management
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
                        <TableHead className="text-white">Phone</TableHead>
                        <TableHead className="text-white">Current Credits</TableHead>
                        <TableHead className="text-white text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clinics.map((clinic) => (
                        <TableRow key={clinic.id} className="border-[#ef4444]/20 hover:bg-[#ef4444]/5">
                          <TableCell className="font-medium text-white">
                            {clinic.clinic_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {userEmails[clinic.id] || clinic.email || '...'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {clinic.phone || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30">
                              {clinic.credits ?? 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenAddCredits(clinic)}
                                className="border-[#ef4444]/30 hover:bg-[#ef4444]/10 text-white"
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Credits
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleOpenDelete(clinic)}
                                className="bg-[#ef4444] hover:bg-[#ef4444]/90"
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

      {/* Add Credits Dialog */}
      <Dialog open={addCreditsDialogOpen} onOpenChange={setAddCreditsDialogOpen}>
        <DialogContent className="glass-card border-[#ef4444]/20">
          <DialogHeader>
            <DialogTitle className="text-white">Add Credits</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add credits to {selectedUser?.clinic_name || 'this user'}. Current balance:{' '}
              <span className="font-medium text-white">{selectedUser?.credits ?? 0}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="credits" className="text-white">Credits to Add</Label>
              <Input
                id="credits"
                type="number"
                min="1"
                placeholder="100"
                value={creditsToAdd}
                onChange={(e) => setCreditsToAdd(e.target.value)}
                className="bg-secondary border-[#ef4444]/20 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddCreditsDialogOpen(false)}
              className="border-[#ef4444]/30 text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAddCredits}
              disabled={addCreditsMutation.isPending}
              className="bg-[#ef4444] hover:bg-[#ef4444]/90 text-white"
            >
              {addCreditsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-[#ef4444]/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete User</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-white">{selectedUser?.clinic_name}</span>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#ef4444]/30 text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
              disabled={deleteUserMutation.isPending}
              className="bg-[#ef4444] hover:bg-[#ef4444]/90 text-white"
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