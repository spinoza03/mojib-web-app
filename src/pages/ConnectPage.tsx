import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { generateQRCode } from '@/services/api';
import {
  Smartphone,
  QrCode,
  Loader2,
  CheckCircle2,
  MessageCircle,
  ScanLine,
  Link2,
} from 'lucide-react';

type ConnectionState = 'idle' | 'loading' | 'qr' | 'success';

export default function ConnectPage() {
  const [state, setState] = useState<ConnectionState>('idle');
  const [qrUrl, setQrUrl] = useState<string>('');
  const [connectedPhone, setConnectedPhone] = useState<string>('');

  const handleGenerateQR = async () => {
    setState('loading');
    try {
      const result = await generateQRCode();
      setQrUrl(result.qr_url);
      setState('qr');

      // Simulate successful connection after 5 seconds (for demo)
      setTimeout(() => {
        setConnectedPhone('+1 (555) 000-0000');
        setState('success');
      }, 8000);
    } catch (error) {
      setState('idle');
    }
  };

  const steps = [
    { icon: Smartphone, text: 'Open WhatsApp on your phone' },
    { icon: ScanLine, text: 'Go to Menu → Linked Devices' },
    { icon: QrCode, text: 'Tap "Link a Device" and scan the code' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Smartphone className="h-8 w-8 text-primary" />
            Connect WhatsApp
          </h1>
          <p className="text-muted-foreground">
            Link your WhatsApp Business account to enable AI-powered patient communication.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="glass-card border-0 h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  How to Connect
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {steps.map((step, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 + 0.2 }}
                    className="flex items-start gap-4"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold">{index + 1}</span>
                    </div>
                    <div className="flex-1 pt-2">
                      <div className="flex items-center gap-2">
                        <step.icon className="h-4 w-4 text-muted-foreground" />
                        <p className="text-foreground">{step.text}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}

                <div className="pt-4 border-t border-[hsl(var(--glass-border))]">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Note:</strong> Your WhatsApp session will be securely managed through our n8n automation workflow.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* QR Code Stage */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className="glass-card border-0 h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-primary" />
                  Connection Status
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center min-h-[400px]">
                <AnimatePresence mode="wait">
                  {state === 'idle' && (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="text-center"
                    >
                      <div className="w-24 h-24 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-6">
                        <QrCode className="h-12 w-12 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground mb-6">
                        Ready to connect your WhatsApp account
                      </p>
                      <Button
                        onClick={handleGenerateQR}
                        size="lg"
                        className="glow-primary gap-2"
                      >
                        <QrCode className="h-5 w-5" />
                        Generate QR Code
                      </Button>
                    </motion.div>
                  )}

                  {state === 'loading' && (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="text-center"
                    >
                      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                        <Loader2 className="h-12 w-12 text-primary animate-spin" />
                      </div>
                      <p className="text-foreground font-medium mb-2">
                        Fetching secure session from n8n...
                      </p>
                      <p className="text-sm text-muted-foreground">
                        This may take a few seconds
                      </p>
                    </motion.div>
                  )}

                  {state === 'qr' && (
                    <motion.div
                      key="qr"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="text-center"
                    >
                      <div className="p-4 bg-white rounded-2xl mb-6 inline-block">
                        <img
                          src={qrUrl}
                          alt="WhatsApp QR Code"
                          className="w-64 h-64 object-contain"
                        />
                      </div>
                      <p className="text-foreground font-medium mb-2">
                        Scan this QR code with WhatsApp
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Waiting for connection...
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">
                          Listening for scan...
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {state === 'success' && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="text-center"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6"
                      >
                        <CheckCircle2 className="h-14 w-14 text-success" />
                      </motion.div>
                      <p className="text-foreground font-medium text-xl mb-2">
                        WhatsApp Connected!
                      </p>
                      <p className="text-success font-mono text-lg">
                        {connectedPhone}
                      </p>
                      <p className="text-sm text-muted-foreground mt-4">
                        Your AI receptionist is now active
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
