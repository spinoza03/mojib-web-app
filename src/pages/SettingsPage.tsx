import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, Save, Building2, Upload, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const { user, refreshProfile, profile } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [prompt, setPrompt] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const planType = profile?.plan_type || 'starter';
  const subscriptionStatus = profile?.subscription_status || 'trial';
  const trialEndsAt = profile?.trial_ends_at;

  const getTrialDaysLeft = (trialEndsAtValue?: string) => {
    if (!trialEndsAtValue) return 0;
    const endDate = new Date(trialEndsAtValue);
    const today = new Date();
    const diff = endDate.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const whatsappNumber = '212600000000';
  const getWhatsAppLink = (targetPlan: 'starter' | 'pro') => {
    const message =
      targetPlan === 'pro'
        ? 'Hello, I want to upgrade to the PRO Plan.'
        : 'Hello, I want to change to the STARTER Plan.';
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  };


  // 1. Fetch current settings
  useEffect(() => {
    async function loadSettings() {
      if (!user) return;
      // We search by 'user_id' because 'id' is just a random number for the profile itself
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id) 
        .single();

      const profileData = data as {
        system_prompt?: string | null;
        clinic_name?: string | null;
        avatar_url?: string | null;
      } | null;
      
      if (profileData) {
        setPrompt(profileData.system_prompt || '');
        setClinicName(profileData.clinic_name || '');
        setAvatarUrl(profileData.avatar_url || '');
      }
    }
    loadSettings();
  }, [user]);

  // 2. Handle Logo Upload
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      // Safety Check: Ensure user is logged in
      if (!user || !user.id) {
        throw new Error('User session not found. Please log out and log in again.');
      }

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      // Create a unique filename with timestamp to prevent browser caching issues
      const filePath = `${user.id}-${Date.now()}.${fileExt}`;

      // A. Upload to Bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { 
          upsert: true 
        });

      if (uploadError) throw uploadError;

      // B. Get the Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // C. Update Profile (CRITICAL FIX: user_id)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', user.id); // <--- Matches the auth.users ID

      if (updateError) throw updateError;

      // D. Success! Update the UI
      setAvatarUrl(publicUrl);
      await refreshProfile(); // Refresh sidebar instantly
      toast({ title: 'Success', description: 'Logo updated successfully.' });

    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    } finally {
      setUploading(false);
    }
  };

  // 3. Save Text Settings
  const handleSave = async () => {
    setLoading(true);
    
    // CRITICAL FIX: user_id
    const { error } = await supabase
      .from('profiles')
      .update({ 
        system_prompt: prompt,
        clinic_name: clinicName 
      })
      .eq('user_id', user?.id); // <--- Matches the auth.users ID
    
    setLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      await refreshProfile();
      toast({ title: 'Configuration Saved', description: 'Your settings have been updated.' });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your clinic identity and AI personality.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Identity Card */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Clinic Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Logo Upload Section */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-primary/20">
                  <AvatarImage src={avatarUrl} className="object-cover" />
                  <AvatarFallback className="text-xl font-bold bg-secondary">
                    {clinicName.substring(0, 2).toUpperCase() || 'DR'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="space-y-2">
                  <Label htmlFor="logo-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-md text-sm font-medium transition-colors border border-input">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? 'Uploading...' : 'Upload Logo'}
                    </div>
                  </Label>
                  <Input 
                    id="logo-upload" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleLogoUpload}
                    disabled={uploading}
                  />
                  <p className="text-xs text-muted-foreground">Recommended: 500x500px (PNG/JPG)</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Clinic Name (Used in Greetings)</Label>
                <Input 
                  value={clinicName} 
                  onChange={(e) => setClinicName(e.target.value)} 
                  placeholder="e.g. Smile Dental"
                  className="bg-secondary/50"
                />
              </div>
            </CardContent>
          </Card>

          {/* System Prompt Card */}
          <Card className="glass-card md:row-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                System Prompt
              </CardTitle>
              <CardDescription>
                This is the "Brain" of your bot. Give it specific instructions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[300px] font-mono text-sm bg-secondary/50 leading-relaxed"
                placeholder="You are a helpful receptionist for Dr. Smile. Your goal is to book appointments..."
              />
              <Button onClick={handleSave} disabled={loading} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Saving...' : 'Update Settings'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Section */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>View your current plan and manage upgrades.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border p-4 bg-secondary/20">
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-lg font-semibold">{planType === 'starter' ? 'Starter' : 'Pro'}</p>
              </div>
              <div className="rounded-lg border border-border p-4 bg-secondary/20">
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-lg font-semibold capitalize">{subscriptionStatus}</p>
              </div>
              <div className="rounded-lg border border-border p-4 bg-secondary/20">
                <p className="text-sm text-muted-foreground">Trial Ends</p>
                <p className="text-lg font-semibold">
                  {subscriptionStatus === 'trial' && trialEndsAt
                    ? `${getTrialDaysLeft(trialEndsAt)} days left`
                    : trialEndsAt
                      ? new Date(trialEndsAt).toLocaleDateString()
                      : 'N/A'}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div
                className={`rounded-lg border p-5 ${
                  planType === 'starter'
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border bg-background'
                }`}
              >
                <div className="space-y-2">
                  <p className="text-lg font-semibold">Starter</p>
                  <p className="text-sm text-muted-foreground">300 DH / month</p>
                  <p className="text-xs text-muted-foreground">Basic chat access</p>
                </div>
                {planType !== 'starter' && (
                  <Button
                    className="mt-4 w-full"
                    variant="outline"
                    onClick={() => window.open(getWhatsAppLink('starter'), '_blank')}
                  >
                    Upgrade / Change Plan
                  </Button>
                )}
              </div>

              <div
                className={`rounded-lg border p-5 ${
                  planType === 'pro'
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border bg-background'
                }`}
              >
                <div className="space-y-2">
                  <p className="text-lg font-semibold">Pro</p>
                  <p className="text-sm text-muted-foreground">500 DH / month</p>
                  <p className="text-xs text-muted-foreground">All features unlocked</p>
                </div>
                {planType !== 'pro' && (
                  <Button
                    className="mt-4 w-full"
                    onClick={() => window.open(getWhatsAppLink('pro'), '_blank')}
                  >
                    Upgrade / Change Plan
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}