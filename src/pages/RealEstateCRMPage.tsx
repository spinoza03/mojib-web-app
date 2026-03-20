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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';

type ClientRole = 'acquereur' | 'vendeur';

type RealEstateClient = {
  id: string;
  user_id: string;
  role: ClientRole;
  full_name: string;
  phone: string | null;
  email: string | null;
  details: any;
  created_at: string;
};

export default function RealEstateCRMPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<RealEstateClient[]>([]);
  const [roleTab, setRoleTab] = useState<ClientRole>('acquereur');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const emptyBuyer = {
    full_name: '',
    phone: '',
    email: '',
    budget_max_dh: '',
    desired_quartier: '',
    desired_type: 'Appartement'
  };

  const emptySeller = {
    full_name: '',
    phone: '',
    email: '',
    ownership_title: '',
    notes: ''
  };

  const [buyerForm, setBuyerForm] = useState(emptyBuyer);
  const [sellerForm, setSellerForm] = useState(emptySeller);

  const roleDetails = useMemo(
    () => ({
      acquereur: 'Acheteurs (criteria de recherche)',
      vendeur: 'Vendeurs (biens à vendre)'
    }),
    []
  );

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('real_estate_clients')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients((data || []) as RealEstateClient[]);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err.message || 'Load failed.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    // Reset forms based on tab
    if (roleTab === 'acquereur') {
      setBuyerForm(emptyBuyer);
    } else {
      setSellerForm(emptySeller);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleTab]);

  const filtered = clients.filter((c) => c.role === roleTab);

  const openAdd = () => setDialogOpen(true);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const cleanPhone = (roleTab === 'acquereur' ? buyerForm.phone : sellerForm.phone)
        ? String(roleTab === 'acquereur' ? buyerForm.phone : sellerForm.phone).replace(/\D/g, '')
        : '';

      const base = {
        user_id: user.id,
        role: roleTab,
        full_name: roleTab === 'acquereur' ? buyerForm.full_name : sellerForm.full_name,
        phone: cleanPhone || null,
        email: roleTab === 'acquereur' ? buyerForm.email || null : sellerForm.email || null,
      };

      const details =
        roleTab === 'acquereur'
          ? {
              budget_max_dh: buyerForm.budget_max_dh ? Number(buyerForm.budget_max_dh) : null,
              desired_quartier: buyerForm.desired_quartier || null,
              desired_type: buyerForm.desired_type
            }
          : {
              ownership_title: sellerForm.ownership_title || null,
              notes: sellerForm.notes || null
            };

      const { error } = await supabase
        .from('real_estate_clients')
        .insert({
          ...base,
          details
        });

      if (error) throw error;
      toast({ title: 'Succès', description: 'Client ajouté.' });
      setDialogOpen(false);
      refresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err.message || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (clientId: string) => {
    if (!user) return;
    const ok = window.confirm('Supprimer ce client ?');
    if (!ok) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('real_estate_clients')
        .delete()
        .eq('id', clientId)
        .eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'Supprimé', description: 'Client supprimé.' });
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
            <CardTitle className="text-2xl font-bold">CRM Immobilier - Double Face</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Acheteurs vs Vendeurs (criteria & ownership).</p>
          </div>
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={roleTab} onValueChange={(v) => setRoleTab(v as ClientRole)}>
            <TabsList>
              <TabsTrigger value="acquereur">Acheteurs</TabsTrigger>
              <TabsTrigger value="vendeur">Vendeurs</TabsTrigger>
            </TabsList>

            <TabsContent value="acquereur" className="pt-4">
              {loading ? (
                <div className="py-10 text-muted-foreground flex items-center gap-2 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" /> Chargement...
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.length === 0 ? (
                    <div className="text-muted-foreground text-sm">Aucun acheteur.</div>
                  ) : (
                    filtered.map((c) => (
                      <div key={c.id} className="border rounded-xl p-4 bg-secondary/20 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{c.full_name}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {c.phone || 'N/A'}
                          </div>
                          <div className="text-sm mt-2">
                            Budget max: {c.details?.budget_max_dh ?? 'N/A'} DH
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Quartier: {c.details?.desired_quartier ?? 'N/A'} · Type: {c.details?.desired_type ?? 'N/A'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Acquéreur</Badge>
                          <Button variant="destructive" size="icon" onClick={() => onDelete(c.id)} disabled={saving}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="vendeur" className="pt-4">
              {loading ? (
                <div className="py-10 text-muted-foreground flex items-center gap-2 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" /> Chargement...
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.length === 0 ? (
                    <div className="text-muted-foreground text-sm">Aucun vendeur.</div>
                  ) : (
                    filtered.map((c) => (
                      <div key={c.id} className="border rounded-xl p-4 bg-secondary/20 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{c.full_name}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {c.phone || 'N/A'}
                          </div>
                          <div className="text-sm text-muted-foreground mt-2">
                            {c.details?.ownership_title || 'N/A'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Vendeur</Badge>
                          <Button variant="destructive" size="icon" onClick={() => onDelete(c.id)} disabled={saving}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{roleTab === 'acquereur' ? 'Ajouter un acheteur' : 'Ajouter un vendeur'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom complet</Label>
                <Input
                  value={roleTab === 'acquereur' ? buyerForm.full_name : sellerForm.full_name}
                  onChange={(e) =>
                    roleTab === 'acquereur'
                      ? setBuyerForm((f) => ({ ...f, full_name: e.target.value }))
                      : setSellerForm((f) => ({ ...f, full_name: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  value={roleTab === 'acquereur' ? buyerForm.phone : sellerForm.phone}
                  onChange={(e) =>
                    roleTab === 'acquereur'
                      ? setBuyerForm((f) => ({ ...f, phone: e.target.value }))
                      : setSellerForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email (optionnel)</Label>
              <Input
                value={roleTab === 'acquereur' ? buyerForm.email : sellerForm.email}
                onChange={(e) =>
                  roleTab === 'acquereur'
                    ? setBuyerForm((f) => ({ ...f, email: e.target.value }))
                    : setSellerForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>

            {roleTab === 'acquereur' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Budget max (DH)</Label>
                  <Input
                    value={buyerForm.budget_max_dh}
                    onChange={(e) => setBuyerForm((f) => ({ ...f, budget_max_dh: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quartier souhaité</Label>
                  <Input
                    value={buyerForm.desired_quartier}
                    onChange={(e) => setBuyerForm((f) => ({ ...f, desired_quartier: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type souhaité</Label>
                  <Select value={buyerForm.desired_type} onValueChange={(v) => setBuyerForm((f) => ({ ...f, desired_type: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['Appartement', 'Villa', 'Terrain'].map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Détails / Titre de propriété</Label>
                  <Input
                    value={sellerForm.ownership_title}
                    onChange={(e) => setSellerForm((f) => ({ ...f, ownership_title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={sellerForm.notes}
                    onChange={(e) => setSellerForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 flex-col sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

