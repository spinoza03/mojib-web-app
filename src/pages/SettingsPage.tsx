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
import { Bot, Save, Sparkles, MessageSquare } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // State for the fields we need for n8n
  const [prompt, setPrompt] = useState('');
  const [clinicName, setClinicName] = useState('');

  // 1. Fetch current settings
  useEffect(() => {
    async function loadSettings() {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('system_prompt, clinic_name')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setPrompt(data.system_prompt || '');
        setClinicName(data.clinic_name || '');
      }
    }
    loadSettings();
  }, [user]);

  // 2. Save settings (This updates the DB, ready for n8n to read)
  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ 
        system_prompt: prompt,
        clinic_name: clinicName 
      })
      .eq('id', user?.id);
    
    setLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Configuration Saved', description: 'Your AI personality has been updated.' });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold mb-2">Bot Configuration</h1>
          <p className="text-muted-foreground">Customize how your AI receptionist interacts with patients.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column: Basic Settings */}
          <div className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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

            {/* Test / Preview (Visual Only for now) */}
            <Card className="glass-card border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-primary">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-green-500 font-medium">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  Ready to reply
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: The System Prompt */}
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
                className="min-h-[400px] font-mono text-sm bg-secondary/50 leading-relaxed"
                placeholder="You are a helpful receptionist for Dr. Smile. Your goal is to book appointments..."
              />
              <Button onClick={handleSave} disabled={loading} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Saving...' : 'Update AI Personality'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}