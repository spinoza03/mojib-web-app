import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { saveBotConfig, fetchBotConfig, BotConfig } from '@/services/api';
import { Settings, Bot, Save, Loader2, Sparkles } from 'lucide-react';

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [clinicName, setClinicName] = useState('');
  const [botTone, setBotTone] = useState<'friendly' | 'formal' | 'direct'>('friendly');
  const [servicesList, setServicesList] = useState('');

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['botConfig', user?.id],
    queryFn: () => fetchBotConfig(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (config) {
      setClinicName(config.clinic_name);
      setBotTone(config.bot_tone);
      setServicesList(config.services_list || '');
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<BotConfig>) => saveBotConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botConfig'] });
      refreshProfile();
      toast({
        title: 'Configuration Saved',
        description: 'Your settings have been saved successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save configuration.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    if (!user) return;
    saveMutation.mutate({
      user_id: user.id,
      clinic_name: clinicName,
      bot_tone: botTone,
      services_list: servicesList,
    });
  };

  const toneDescriptions = {
    friendly: 'Warm and approachable, uses casual language and emojis',
    formal: 'Professional and courteous, maintains clinical tone',
    direct: 'Concise and efficient, gets straight to the point',
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            Bot Configuration
          </h1>
          <p className="text-muted-foreground">
            Customize how your AI receptionist interacts with patients.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                AI Receptionist Brain
              </CardTitle>
              <CardDescription>
                Configure your bot's personality and knowledge base
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {configLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-secondary/30 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Clinic Name */}
                  <div className="space-y-2">
                    <Label htmlFor="clinic-name">Clinic Name</Label>
                    <Input
                      id="clinic-name"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      placeholder="Enter your clinic name"
                      className="bg-secondary border-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      This name will be used in greetings and confirmations
                    </p>
                  </div>

                  {/* Bot Tone */}
                  <div className="space-y-2">
                    <Label htmlFor="bot-tone">Bot Tone</Label>
                    <Select value={botTone} onValueChange={(v) => setBotTone(v as 'friendly' | 'formal' | 'direct')}>
                      <SelectTrigger className="bg-secondary border-input">
                        <SelectValue placeholder="Select tone" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-[hsl(var(--glass-border))]">
                        <SelectItem value="friendly">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-yellow-500" />
                            Friendly
                          </div>
                        </SelectItem>
                        <SelectItem value="formal">
                          <div className="flex items-center gap-2">
                            <span className="text-blue-400">📋</span>
                            Formal
                          </div>
                        </SelectItem>
                        <SelectItem value="direct">
                          <div className="flex items-center gap-2">
                            <span className="text-green-400">⚡</span>
                            Direct
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {toneDescriptions[botTone]}
                    </p>
                  </div>

                  {/* Services List */}
                  <div className="space-y-2">
                    <Label htmlFor="services">Service List & Prices</Label>
                    <Textarea
                      id="services"
                      value={servicesList}
                      onChange={(e) => setServicesList(e.target.value)}
                      placeholder="List your services and prices..."
                      className="bg-secondary border-input min-h-[200px] font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      The AI will reference this list when patients ask about services or pricing
                    </p>
                  </div>

                  {/* Save Button */}
                  <div className="pt-4 border-t border-[hsl(var(--glass-border))]">
                    <Button
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      className="w-full glow-primary gap-2"
                      size="lg"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Configuration
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
