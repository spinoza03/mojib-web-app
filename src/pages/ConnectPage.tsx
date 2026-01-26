import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Smartphone, QrCode, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function ConnectPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // UI States for future API integration
  const [status, setStatus] = useState<'disconnected' | 'scanning' | 'connected'>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Fetch real status from DB on load
  useEffect(() => {
    async function checkStatus() {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('whatsapp_status')
        .eq('id', user.id)
        .single();
      
      if (data?.whatsapp_status) {
        // Cast to our known types
        setStatus(data.whatsapp_status as any);
      }
    }
    checkStatus();
  }, [user]);

  // 2. Mock Function: This simulates asking WAHA for a QR code
  const handleStartSession = async () => {
    setIsLoading(true);
    
    // TODO: Later, replace this with: axios.get('https://your-waha-url/api/start')
    
    // SIMULATION (Remove this later when API is ready)
    setTimeout(async () => {
      setStatus('scanning');
      // Update DB to match
      await supabase.from('profiles').update({ whatsapp_status: 'scanning' }).eq('id', user?.id);
      setIsLoading(false);
      toast({ title: 'Session Started', description: 'Please scan the QR code.' });
    }, 1500);
  };

  // 3. Mock Function: Simulates disconnecting
  const handleLogout = async () => {
    setIsLoading(true);
    // TODO: Later, replace with: axios.post('https://your-waha-url/api/logout')
    
    await supabase.from('profiles').update({ whatsapp_status: 'disconnected' }).eq('id', user?.id);
    setStatus('disconnected');
    setQrCode(null);
    setIsLoading(false);
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Connect WhatsApp</h1>
          <p className="text-muted-foreground">Link your existing WhatsApp number to enable the AI.</p>
        </div>

        <Card className="glass-card overflow-hidden border-primary/20">
          <CardContent className="p-0">
            <div className="grid md:grid-cols-2 min-h-[400px]">
              
              {/* Left Side: Instructions */}
              <div className="p-8 space-y-6 flex flex-col justify-center bg-secondary/20">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">1</div>
                    <p>Open WhatsApp on your phone</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">2</div>
                    <p>Go to Settings {'>'} Linked Devices</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">3</div>
                    <p>Tap "Link a Device" and scan</p>
                  </div>
                </div>

                <div className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">Current Status:</span>
                    {status === 'connected' && <Badge className="bg-green-500 hover:bg-green-600">Connected</Badge>}
                    {status === 'scanning' && <Badge variant="secondary" className="animate-pulse">Waiting for Scan...</Badge>}
                    {status === 'disconnected' && <Badge variant="destructive">Disconnected</Badge>}
                  </div>
                </div>
              </div>

              {/* Right Side: The QR Display Area */}
              <div className="p-8 flex flex-col items-center justify-center border-l border-white/5 bg-black/20">
                
                {/* STATE 1: CONNECTED */}
                {status === 'connected' && (
                  <div className="text-center space-y-4">
                    <div className="h-24 w-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="h-12 w-12 text-green-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white">System Online</h3>
                    <p className="text-sm text-muted-foreground">Your AI is active and replying to messages.</p>
                    <Button variant="destructive" onClick={handleLogout} disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Disconnect
                    </Button>
                  </div>
                )}

                {/* STATE 2: SCANNING (Show QR) */}
                {status === 'scanning' && (
                  <div className="text-center space-y-4 w-full">
                    {qrCode ? (
                       <img src={qrCode} alt="QR Code" className="w-48 h-48 mx-auto rounded-lg" />
                    ) : (
                       // Placeholder for the QR until API sends it
                       <div className="w-48 h-48 mx-auto bg-white rounded-lg flex items-center justify-center">
                         <QrCode className="h-16 w-16 text-black opacity-20" />
                         <p className="absolute text-xs text-black font-medium">QR API Not Linked</p>
                       </div>
                    )}
                    <p className="text-sm text-muted-foreground animate-pulse">Waiting for connection...</p>
                    <Button variant="outline" size="sm" onClick={() => setStatus('disconnected')}>Cancel</Button>
                  </div>
                )}

                {/* STATE 3: DISCONNECTED */}
                {status === 'disconnected' && (
                  <div className="text-center space-y-4">
                    <div className="h-24 w-24 bg-secondary rounded-full flex items-center justify-center mx-auto">
                      <Smartphone className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">Session is inactive</p>
                    <Button onClick={handleStartSession} disabled={isLoading} className="bg-[#25D366] hover:bg-[#25D366]/90 text-black font-bold">
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                      Generate QR Code
                    </Button>
                  </div>
                )}

              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}