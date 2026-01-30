import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client'; // <--- Added this import
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Lock, Mail, Phone, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';

export default function AuthPage() {
  const { signIn, signUp, user, loading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [phone, setPhone] = useState('');
  
  // NEW: State for Password Reset Mode
  const [resetMode, setResetMode] = useState(false);

  if (user && !loading) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    
    if (error) {
      toast({ variant: 'destructive', title: 'Login Failed', description: error.message });
    }
  };

  // NEW: Function to send the reset email
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter your email address first.' });
      return;
    }
    
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    setIsLoading(false);
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Check your email', description: 'Password reset link sent!' });
      setResetMode(false); // Go back to login mode
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicName || !phone) {
      toast({ variant: 'destructive', title: 'Missing Info', description: 'Please enter your Clinic Name and Phone.' });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(email, password, {
      clinic_name: clinicName,
      phone: phone
    });
    setIsLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Sign Up Failed', description: error.message });
    } else {
      toast({ title: 'Welcome to Mojib.AI!', description: 'Account created. You can now log in.' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-background pattern-grid opacity-20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      
      <Card className="w-full max-w-md glass-card relative z-10 border-primary/20">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mb-2">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            MOJIB<span className="text-primary">.AI</span>
          </CardTitle>
          <CardDescription>
            The Intelligent AI Responder for Modern Business.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-secondary/50">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Sign Up</TabsTrigger>
            </TabsList>

            {/* LOGIN FORM */}
            <TabsContent value="login">
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="doctor@clinic.com" 
                      className="pl-9 bg-secondary/30"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Only show Password field if NOT in reset mode */}
                {!resetMode && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="password" 
                        type="password" 
                        className="pl-9 bg-secondary/30"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* --- THIS IS THE PART YOU ASKED FOR --- */}
                <div className="flex justify-end">
                  <button 
                    type="button"
                    onClick={() => setResetMode(!resetMode)}
                    className="text-xs text-primary hover:underline"
                  >
                    {resetMode ? 'Back to Login' : 'Forgot Password?'}
                  </button>
                </div>

                {resetMode ? (
                  <Button onClick={handleResetPassword} className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send Reset Link'}
                  </Button>
                ) : (
                  <Button onClick={handleLogin} className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sign In'}
                  </Button>
                )}
                {/* -------------------------------------- */}

              </form>
            </TabsContent>

            {/* REGISTER FORM */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label>Clinic Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="e.g. Royal Dental Center" 
                      className="pl-9 bg-secondary/30"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="+212 6..." 
                      className="pl-9 bg-secondary/30"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    type="email" 
                    placeholder="doctor@clinic.com" 
                    className="bg-secondary/30"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input 
                    type="password" 
                    className="bg-secondary/30"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <Button className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Agency Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}