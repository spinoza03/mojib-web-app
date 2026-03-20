import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Pencil } from 'lucide-react';

type PropertyStatus = 'Disponible' | 'Réservé' | 'Vendu' | 'Loué';

type PropertyForm = {
  title: string;
  price_dh: string;
  quartier: string;
  surface_m2: string;
  bedrooms: string;
  floor: string;
  orientation: string;
  condition: string;
  status: PropertyStatus;
  gps_lat: string;
  gps_lng: string;
  attributes: {
    has_chouka: boolean;
    without_view: boolean;
    has_elevator: boolean;
    has_garage: boolean;
  };
};

const emptyForm: PropertyForm = {
  title: '',
  price_dh: '',
  quartier: '',
  surface_m2: '',
  bedrooms: '',
  floor: '',
  orientation: '',
  condition: '',
  status: 'Disponible',
  gps_lat: '',
  gps_lng: '',
  attributes: {
    has_chouka: false,
    without_view: false,
    has_elevator: false,
    has_garage: false
  }
};

function parseNumber(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function RealEstateCataloguePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | PropertyStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [form, setForm] = useState<PropertyForm>(emptyForm);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const bucketName = 'property-media';

  const statusOptions = useMemo(
    () => ['Disponible', 'Réservé', 'Vendu', 'Loué'] as PropertyStatus[],
    []
  );

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('real_estate_properties')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchTerm.trim()) {
        query = query.ilike('title', `%${searchTerm.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const items = data || [];

      // Fetch a single representative photo per property (first uploaded photo)
      const propertyIds = items.map((p: any) => p.id);
      if (propertyIds.length > 0) {
        const { data: media, error: mediaErr } = await supabase
          .from('real_estate_property_media')
          .select('property_id, public_url, media_type')
          .eq('user_id', user.id)
          .in('property_id', propertyIds)
          .eq('media_type', 'photo')
          .order('created_at', { ascending: true });

        if (mediaErr) throw mediaErr;

        const firstPhotoByPropertyId: Record<string, string> = {};
        for (const m of media || []) {
          if (!firstPhotoByPropertyId[m.property_id] && m.public_url) {
            firstPhotoByPropertyId[m.property_id] = m.public_url;
          }
        }

        setProperties(
          items.map((p: any) => ({
            ...p,
            firstPhoto: firstPhotoByPropertyId[p.id] || null
          }))
        );
      } else {
        setProperties(items);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err.message || 'Failed to load catalogue.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, statusFilter, searchTerm]);

  const openAdd = () => {
    setEditingPropertyId(null);
    setForm(emptyForm);
    setFiles([]);
    setDialogOpen(true);
  };

  const openEdit = (property: any) => {
    setEditingPropertyId(property.id);
    setForm({
      title: property.title || '',
      price_dh: property.price_dh != null ? String(property.price_dh) : '',
      quartier: property.quartier || '',
      surface_m2: property.surface_m2 != null ? String(property.surface_m2) : '',
      bedrooms: property.bedrooms != null ? String(property.bedrooms) : '',
      floor: property.floor != null ? String(property.floor) : '',
      orientation: property.orientation || '',
      condition: property.condition || '',
      status: (property.status || 'Disponible') as PropertyStatus,
      gps_lat: property.gps_lat != null ? String(property.gps_lat) : '',
      gps_lng: property.gps_lng != null ? String(property.gps_lng) : '',
      attributes: {
        has_chouka: !!property.attributes?.has_chouka,
        without_view: !!property.attributes?.without_view,
        has_elevator: !!property.attributes?.has_elevator,
        has_garage: !!property.attributes?.has_garage
      }
    });
    setFiles([]);
    setDialogOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.title.trim()) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Title is required.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        title: form.title.trim(),
        price_dh: parseNumber(form.price_dh),
        quartier: form.quartier.trim() || null,
        surface_m2: parseNumber(form.surface_m2),
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        floor: form.floor ? Number(form.floor) : null,
        orientation: form.orientation.trim() || null,
        condition: form.condition.trim() || null,
        status: form.status,
        gps_lat: parseNumber(form.gps_lat),
        gps_lng: parseNumber(form.gps_lng),
        attributes: form.attributes
      };

      let propertyId: string;
      if (editingPropertyId) {
        const { data: updated, error: updateErr } = await supabase
          .from('real_estate_properties')
          .update(payload)
          .eq('id', editingPropertyId)
          .select('id')
          .single();

        if (updateErr) throw updateErr;
        propertyId = updated.id;
      } else {
        const { data: created, error: createErr } = await supabase
          .from('real_estate_properties')
          .insert(payload)
          .select('id')
          .single();

        if (createErr) throw createErr;
        propertyId = created.id;
      }

      // Upload media (optional). We append new media rows; we don't delete old ones in MVP.
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const mediaType = file.type.startsWith('video') ? 'video' : 'photo';

        const fileExt = (file.name.split('.').pop() || '').toLowerCase();
        const filePath = `${propertyId}/${Date.now()}_${i}.${fileExt || 'bin'}`;

        const { error: uploadErr } = await supabase.storage
          .from(bucketName)
          .upload(filePath, file, { upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
        const publicUrl = urlData.publicUrl;

        const mediaRow = {
          user_id: user.id,
          property_id: propertyId,
          media_type: mediaType,
          file_path: filePath,
          public_url: publicUrl
        };

        const { error: mediaInsertErr } = await supabase
          .from('real_estate_property_media')
          .insert(mediaRow);

        if (mediaInsertErr) throw mediaInsertErr;
      }

      toast({ title: 'Succès', description: 'Catalogue mis à jour.' });
      setDialogOpen(false);
      refresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err.message || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (property: any) => {
    if (!user) return;
    const ok = window.confirm(`Supprimer "${property.title}" ?`);
    if (!ok) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('real_estate_properties')
        .delete()
        .eq('id', property.id)
        .eq('user_id', user.id);

      if (error) throw error;
      toast({ title: 'Supprimé', description: 'Bien supprimé.' });
      refresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err.message || 'Delete failed.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <Card className="glass-card">
        <CardHeader className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold">Gestion du Catalogue Immobilier</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Ajoutez vos biens, leurs photos, GPS et statut pour que l'IA puisse matcher.
            </p>
          </div>
          <Button onClick={openAdd} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un bien
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between mb-5">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="w-full sm:w-64">
                <Label>Recherche</Label>
                <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Titre / nom du bien" />
              </div>
              <div className="w-full sm:w-56">
                <Label>Statut</Label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
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
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {properties.map((p: any) => (
                <div key={p.id} className="border rounded-xl bg-secondary/20 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{p.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {p.quartier || 'N/A'} · {p.surface_m2 ? `${p.surface_m2} m²` : 'Surface N/A'}
                      </div>
                      <div className="text-sm font-semibold mt-1">
                        {p.price_dh != null ? `${p.price_dh} DH` : 'Prix N/A'}
                      </div>
                    </div>
                    <Badge variant="outline">{p.status}</Badge>
                  </div>

                  {p.firstPhoto ? (
                    <div className="aspect-video bg-black/10 rounded-lg overflow-hidden">
                      <img src={p.firstPhoto} alt={p.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-video bg-black/5 rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                      Pas encore de photo
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => openEdit(p)} disabled={saving}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Modifier
                    </Button>
                    <Button variant="destructive" onClick={() => onDelete(p)} disabled={saving}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {properties.length === 0 && (
                <div className="col-span-full text-center py-10 text-muted-foreground">
                  Aucun bien trouvé. Cliquez sur “Ajouter un bien”.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingPropertyId ? 'Modifier un bien' : 'Ajouter un bien'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Prix (DH)</Label>
                <Input value={form.price_dh} onChange={(e) => setForm((f) => ({ ...f, price_dh: e.target.value }))} placeholder="ex: 1200000" />
              </div>
              <div className="space-y-2">
                <Label>Quartier</Label>
                <Input value={form.quartier} onChange={(e) => setForm((f) => ({ ...f, quartier: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Surface (m²)</Label>
                <Input value={form.surface_m2} onChange={(e) => setForm((f) => ({ ...f, surface_m2: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Chambres</Label>
                <Input value={form.bedrooms} onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Etage</Label>
                <Input value={form.floor} onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Orientation</Label>
                <Input value={form.orientation} onChange={(e) => setForm((f) => ({ ...f, orientation: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Etat (neuf/ancien)</Label>
                <Input value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))} placeholder="ex: ancien" />
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as PropertyStatus }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>GPS latitude</Label>
                <Input value={form.gps_lat} onChange={(e) => setForm((f) => ({ ...f, gps_lat: e.target.value }))} placeholder="ex: 31.63" />
              </div>
              <div className="space-y-2">
                <Label>GPS longitude</Label>
                <Input value={form.gps_lng} onChange={(e) => setForm((f) => ({ ...f, gps_lng: e.target.value }))} placeholder="ex: -7.99" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Atouts (pour le matching AI)</Label>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3 bg-secondary/20">
                  <div>
                    <div className="font-medium">Chouka / coin</div>
                    <div className="text-xs text-muted-foreground">Très ensoleillé</div>
                  </div>
                  <Switch
                    checked={form.attributes.has_chouka}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, attributes: { ...f.attributes, has_chouka: !!checked } }))}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border p-3 bg-secondary/20">
                  <div>
                    <div className="font-medium">Sans vis-à-vis</div>
                    <div className="text-xs text-muted-foreground">Pas de vue gênante</div>
                  </div>
                  <Switch
                    checked={form.attributes.without_view}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, attributes: { ...f.attributes, without_view: !!checked } }))}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border p-3 bg-secondary/20">
                  <div>
                    <div className="font-medium">Ascenseur</div>
                    <div className="text-xs text-muted-foreground">Disponible</div>
                  </div>
                  <Switch
                    checked={form.attributes.has_elevator}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, attributes: { ...f.attributes, has_elevator: !!checked } }))}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border p-3 bg-secondary/20">
                  <div>
                    <div className="font-medium">Garage</div>
                    <div className="text-xs text-muted-foreground">Disponible</div>
                  </div>
                  <Switch
                    checked={form.attributes.has_garage}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, attributes: { ...f.attributes, has_garage: !!checked } }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Photos / vidéos</Label>
              <Input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
              <p className="text-xs text-muted-foreground">Optionnel. Les fichiers seront uploadés sur Supabase Storage.</p>
            </div>

            <div className="flex gap-3 flex-col sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingPropertyId ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

