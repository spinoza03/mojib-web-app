import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CalendarDays, MapPin } from 'lucide-react';

type PropertyStatus = 'Disponible' | 'Réservé' | 'Vendu' | 'Loué';

export default function RealEstateMatchingPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<any[]>([]);
  const [firstPhotoById, setFirstPhotoById] = useState<Record<string, string>>({});

  const [quartier, setQuartier] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [bedroomsMin, setBedroomsMin] = useState('');
  const [surfaceMin, setSurfaceMin] = useState('');
  const [status, setStatus] = useState<'all' | PropertyStatus>('all');

  const [searching, setSearching] = useState(false);

  // Visit booking dialog
  const [bookOpen, setBookOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [startAt, setStartAt] = useState('');
  const [notes, setNotes] = useState('');
  const [booking, setBooking] = useState(false);

  const statusOptions = useMemo(
    () => ['Disponible', 'Réservé', 'Vendu', 'Loué'] as PropertyStatus[],
    []
  );

  const fetchPhotosFor = async (propertyIds: string[]) => {
    if (propertyIds.length === 0) return;
    const { data: media, error } = await supabase
      .from('real_estate_property_media')
      .select('property_id, public_url, media_type')
      .eq('user_id', user?.id)
      .in('property_id', propertyIds)
      .eq('media_type', 'photo')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const map: Record<string, string> = {};
    for (const m of media || []) {
      if (!map[m.property_id] && m.public_url) map[m.property_id] = m.public_url;
    }
    setFirstPhotoById(map);
  };

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('real_estate_properties')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8);
        if (error) throw error;
        setProperties(data || []);
        await fetchPhotosFor((data || []).map((p: any) => p.id));
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Erreur', description: err.message || 'Load failed.' });
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onSearch = async () => {
    if (!user) return;
    setSearching(true);
    try {
      let query = supabase
        .from('real_estate_properties')
        .select('*')
        .eq('user_id', user.id);

      if (quartier.trim()) {
        query = query.ilike('quartier', `%${quartier.trim()}%`);
      }
      if (budgetMax.trim()) {
        query = query.lte('price_dh', Number(budgetMax));
      }
      if (bedroomsMin.trim()) {
        query = query.gte('bedrooms', Number(bedroomsMin));
      }
      if (surfaceMin.trim()) {
        query = query.gte('surface_m2', Number(surfaceMin));
      }
      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query.order('updated_at', { ascending: false }).limit(10);
      if (error) throw error;

      setProperties(data || []);
      setFirstPhotoById({});
      await fetchPhotosFor((data || []).map((p: any) => p.id));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err.message || 'Search failed.' });
    } finally {
      setSearching(false);
    }
  };

  const openBooking = (property: any) => {
    setSelectedProperty(property);
    setClientName('');
    setClientPhone('');
    setStartAt('');
    setNotes('');
    setBookOpen(true);
  };

  const onBook = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProperty) return;
    setBooking(true);
    try {
      const cleanPhone = clientPhone.replace(/\D/g, '');
      if (!clientName.trim() || !cleanPhone.trim() || !startAt) {
        toast({ variant: 'destructive', title: 'Champs manquants', description: 'Nom, téléphone et date/heure sont requis.' });
        return;
      }

      const start = new Date(startAt);
      if (Number.isNaN(start.getTime())) {
        toast({ variant: 'destructive', title: 'Date invalide', description: 'Vérifiez la date/heure.' });
        return;
      }

      // Upsert client by phone
      const { data: existingClient } = await supabase
        .from('real_estate_clients')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'acquereur')
        .eq('phone', cleanPhone)
        .maybeSingle();

      let clientId = existingClient?.id || null;
      if (!clientId) {
        const { data: createdClient, error: createClientErr } = await supabase
          .from('real_estate_clients')
          .insert({
            user_id: user.id,
            role: 'acquereur',
            full_name: clientName,
            phone: cleanPhone,
            email: null,
            details: {}
          })
          .select('id')
          .single();

        if (createClientErr) throw createClientErr;
        clientId = createdClient?.id || null;
      }

      const end = new Date(start.getTime() + 30 * 60000);
      const { error: visitErr } = await supabase
        .from('real_estate_visits')
        .insert({
          user_id: user.id,
          property_id: selectedProperty.id,
          client_id: clientId,
          client_name: clientName,
          client_phone: cleanPhone,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: 'confirmed',
          notes: notes || null
        });

      if (visitErr) throw visitErr;

      toast({ title: 'Visite programmée', description: 'La visite a été enregistrée.' });
      setBookOpen(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err.message || 'Booking failed.' });
    } finally {
      setBooking(false);
    }
  };

  return (
    <AppLayout>
      <Card className="glass-card">
        <CardHeader className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold">Matching Immobilier (Manuel)</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Cherchez un bien et programmez une visite en quelques clics.</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Quartier</Label>
              <Input value={quartier} onChange={(e) => setQuartier(e.target.value)} placeholder="ex: Guéliz" />
            </div>
            <div className="space-y-2">
              <Label>Budget max (DH)</Label>
              <Input value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="ex: 1200000" />
            </div>
            <div className="space-y-2">
              <Label>Chambres min</Label>
              <Input value={bedroomsMin} onChange={(e) => setBedroomsMin(e.target.value)} placeholder="ex: 2" />
            </div>
            <div className="space-y-2">
              <Label>Surface min (m²)</Label>
              <Input value={surfaceMin} onChange={(e) => setSurfaceMin(e.target.value)} placeholder="ex: 80" />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-5 flex justify-end">
            <Button onClick={onSearch} disabled={searching}>
              {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Rechercher
            </Button>
          </div>

          {loading ? (
            <div className="py-10 text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Chargement...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 pt-6">
              {properties.map((p: any) => (
                <div key={p.id} className="border rounded-xl bg-secondary/20 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{p.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {p.quartier || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline">{p.status}</Badge>
                  </div>

                  {firstPhotoById[p.id] ? (
                    <div className="aspect-video bg-black/10 rounded-lg overflow-hidden">
                      <img src={firstPhotoById[p.id]} alt={p.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-video bg-black/5 rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                      Pas de photo
                    </div>
                  )}

                  <div className="text-sm">
                    <div>Prix: {p.price_dh != null ? `${p.price_dh} DH` : 'N/A'}</div>
                    <div className="text-muted-foreground mt-1">
                      {p.surface_m2 ? `${p.surface_m2} m²` : 'Surface N/A'} · {p.bedrooms ? `${p.bedrooms} ch.` : 'Chambres N/A'}
                    </div>
                  </div>

                  <Button onClick={() => openBooking(p)} className="w-full">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Programmer une visite
                  </Button>
                </div>
              ))}

              {properties.length === 0 ? (
                <div className="col-span-full text-center py-10 text-muted-foreground">
                  Aucun bien trouvé avec ces critères.
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Programmer une visite</DialogTitle>
          </DialogHeader>

          {selectedProperty ? (
            <div className="text-sm text-muted-foreground -mt-2">
              Bien: <span className="font-medium text-foreground">{selectedProperty.title}</span>
            </div>
          ) : null}

          <form onSubmit={onBook} className="space-y-5 pt-2">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom du client</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} required placeholder="+212 ..." />
              </div>
              <div className="space-y-2">
                <Label>Date & heure</Label>
                <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ex: Le client veut voir la cuisine + la vue." />
            </div>

            <div className="flex gap-3 flex-col sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setBookOpen(false)} disabled={booking}>
                Annuler
              </Button>
              <Button type="submit" disabled={booking}>
                {booking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

