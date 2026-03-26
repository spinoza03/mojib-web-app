import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Wrench, Code2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { type NicheType } from '@/hooks/useAuth';

const NICHES: { id: NicheType; label: string }[] = [
  { id: 'dentistry', label: 'Dentisterie' },
  { id: 'doctor', label: 'Médecin / Clinique' },
  { id: 'beauty_center', label: 'Centre de Beauté' },
  { id: 'immobilier', label: 'Immobilier' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'car_location', label: 'Location Voitures (Beta)' },
  { id: 'centre_formation', label: 'Centre Formation (Beta)' },
];

const AVAILABLE_TOOLS: Record<string, { name: string, description: string }[]> = {
  restaurant: [
    { name: 'get_menu', description: 'Fetches the full restaurant menu and categories.' },
    { name: 'check_item_availability', description: 'Checks if a specific dish or item is in stock.' },
    { name: 'place_order', description: 'Finalizes the order, requiring client details and total.' }
  ],
  immobilier: [
    { name: 'search_properties', description: 'Searches the catalogue based on budget, rooms, and location.' },
    { name: 'get_property_photos', description: 'Sends the photos of a specific property ID to the client.' },
    { name: 'book_property_visit', description: 'Schedules an in-person visit with the client.' }
  ],
  dentistry: [
    { name: 'check_availability', description: 'Checks free slots for a specific date.' },
    { name: 'book_appointment', description: 'Books an appointment in the clinic calendar.' }
  ],
  doctor: [
    { name: 'check_availability', description: 'Checks free slots for a specific date.' },
    { name: 'book_appointment', description: 'Books an appointment with the doctor.' }
  ]
};

const STANDARD_VARIABLES = [
  { var: '{{clinic_name}}', desc: 'The name of the business' },
  { var: '{{agent_name}}', desc: 'The name of the assistant/agent' },
  { var: '{{working_hours}}', desc: 'Working hours from user settings' },
  { var: '{{tone}}', desc: 'Tone from user settings' },
  { var: '{{languages}}', desc: 'Languages from user settings' },
  { var: '{{additional_info}}', desc: 'Custom rules from user settings' },
  { var: '{{date}} / {{time}}', desc: 'Current real-time context' }
];

export function AdminPromptsManagement() {
  const [selectedNiche, setSelectedNiche] = useState<NicheType>('restaurant');
  const [promptContent, setPromptContent] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch the current template for the selected niche
  const { data: dbPrompt, isLoading } = useQuery({
    queryKey: ['niche_master_prompt', selectedNiche],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('niche_master_prompts' as any)
        .select('*')
        .eq('niche', selectedNiche)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching master prompt:', error);
      }
      return data || null;
    }
  });

  // Whenever the DB fetch changes, update the text area
  useEffect(() => {
    if (dbPrompt) {
      setPromptContent(dbPrompt.prompt_template);
    } else {
      setPromptContent('');
    }
  }, [dbPrompt]);

  const saveMutation = useMutation({
    mutationFn: async (template: string) => {
      if (dbPrompt?.id) {
        const { error } = await supabase
          .from('niche_master_prompts' as any)
          .update({ prompt_template: template })
          .eq('id', dbPrompt.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('niche_master_prompts' as any)
          .insert({ niche: selectedNiche, prompt_template: template });
        // Error might happen if table doesn't exist yet, we catch it
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Master Prompt Saved',
        description: `Successfully updated the general prompt for ${selectedNiche}. All active agents will pick this up immediately.`
      });
      queryClient.invalidateQueries({ queryKey: ['niche_master_prompt', selectedNiche] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error Saving Prompt',
        description: error.message || 'Make sure the niche_master_prompts table has been created using the SQL script.',
        variant: 'destructive'
      });
    }
  });

  const handleSave = () => {
    if (!promptContent.trim()) return;
    saveMutation.mutate(promptContent);
  };

  const toolsList = AVAILABLE_TOOLS[selectedNiche] || AVAILABLE_TOOLS['doctor']; // fallback to medical

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" />
            Niche Master Prompts
          </h2>
          <p className="text-muted-foreground mt-1">
            Edit the foundational AI instructions applied globally to every business in a specific niche. 
            These templates override the hardcoded backend logic.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Label>Select Niche:</Label>
          <Select value={selectedNiche} onValueChange={(val) => setSelectedNiche(val as NicheType)}>
            <SelectTrigger className="w-[200px] border-primary/20">
              <SelectValue placeholder="Choose a niche..." />
            </SelectTrigger>
            <SelectContent>
              {NICHES.map(niche => (
                <SelectItem key={niche.id} value={niche.id}>
                  {niche.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Section */}
        <Card className="lg:col-span-2 glass-card border-primary/20">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>System Prompt Template</span>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </CardTitle>
            <CardDescription>
              This entire text is sent to the OpenAI system message. Do not leave it empty. If empty, the backend will fallback to the hardcoded default.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!dbPrompt && !isLoading && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
                <div className="text-sm text-yellow-500">
                  No database override exists for this niche yet. Saving this form will create one. Until then, the agent uses the hardcoded backend default.
                </div>
              </div>
            )}
            
            <Textarea 
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
              className="min-h-[500px] font-mono text-sm bg-background/50 border-primary/20"
              placeholder="Paste or write the new master prompt template here..."
            />

            <div className="flex justify-end gap-3 mt-4">
              <Button 
                onClick={handleSave} 
                className="gap-2"
                disabled={saveMutation.isPending || !promptContent.trim()}
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Template Globally
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cheat Sheets Section */}
        <div className="space-y-6">
          {/* Variables */}
          <Card className="glass-card border-primary/20 bg-background/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                <Code2 className="h-4 w-4" /> Available Variables
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground mb-4">
                  These placeholders are automatically replaced by the backend using the client's individual settings.
                </p>
                {STANDARD_VARIABLES.map(v => (
                  <div key={v.var} className="flex flex-col">
                    <code className="text-primary bg-primary/10 px-1 py-0.5 rounded w-fit mb-1">{v.var}</code>
                    <span className="text-muted-foreground text-xs">{v.desc}</span>
                  </div>
                ))}
                {(selectedNiche === 'immobilier' || selectedNiche === 'restaurant') && (
                  <>
                    <hr className="border-white/10 my-2" />
                    <div className="flex flex-col">
                      <code className="text-green-500 bg-green-500/10 px-1 py-0.5 rounded w-fit mb-1">
                        {selectedNiche === 'immobilier' ? '{{uploaded_properties_list}}' : '{{restaurant_menu}}'}
                      </code>
                      <span className="text-muted-foreground text-xs">Dynamically injected JSON/Text representation of the user's data.</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tools */}
          <Card className="glass-card border-primary/20 bg-background/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                <Wrench className="h-4 w-4" /> AI Action Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground mb-4">
                  The AI backend is configured to attach these tools exclusively to this niche. Mention them in the prompt to instruct the AI when to use them.
                </p>
                {toolsList.map(tool => (
                  <div key={tool.name} className="flex flex-col bg-secondary/50 p-2 rounded-md">
                    <span className="font-semibold text-white">`{tool.name}`</span>
                    <span className="text-muted-foreground text-xs mt-1">{tool.description}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
