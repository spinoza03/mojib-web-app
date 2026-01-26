import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleUpdate = async () => {
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Too Short', description: 'Password must be at least 6 characters.' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: password });
    setLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Success', description: 'Password updated. Taking you to dashboard...' });
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-background pattern-grid opacity-20" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />

      <Card className="w-full max-w-md glass-card relative z-10 border-primary/20">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Set New Password</CardTitle>
          <CardDescription>Enter your new secure password below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input 
            type="password" 
            placeholder="New Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            className="bg-secondary/50"
          />
          <Button onClick={handleUpdate} className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Update Password'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}