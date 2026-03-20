import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Property = { id: string; title: string; price_dh: number | null; status: string };

export default function RealEstateFinancePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);

  const [stats, setStats] = useState({
    commissions_total: 0,
    rent_overdue_total: 0,
    rent_overdue_count: 0,
    ads_total: 0
  });

  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [saleSaving, setSaleSaving] = useState(false);
  const [saleForm, setSaleForm] = useState({
    property_id: '',
    sale_amount_dh: '',
    commission_rate: '0.025',
    sold_at: ''
  });

  const [rentDialogOpen, setRentDialogOpen] = useState(false);
  const [rentSaving, setRentSaving] = useState(false);
  const [rentForm, setRentForm] = useState({
    property_id: '',
    due_date: '',
    amount_dh: '',
    client_name: '',
    client_phone: ''
  });

  const [adDialogOpen, setAdDialogOpen] = useState(false);
  const [adSaving, setAdSaving] = useState(false);
  const [adForm, setAdForm] = useState({
    property_id: '',
    platform: 'Facebook Ads',
    amount_dh: '',
    expense_date: ''
  });

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [propRes, salesRes, rentRes, adsRes] = await Promise.all([
        supabase
          .from('real_estate_properties')
          .select('id,title,price_dh,status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('real_estate_sales')
          .select('commission_amount_dh')
          .eq('user_id', user.id),
        supabase
          .from('real_estate_rent_payments')
          .select('due_date,amount_dh,paid_at')
          .eq('user_id', user.id),
        supabase
          .from('real_estate_ad_expenses')
          .select('amount_dh')
          .eq('user_id', user.id)
      ]);

      if (propRes.error) throw propRes.error;
      if (salesRes.error) throw salesRes.error;
      if (rentRes.error) throw rentRes.error;
      if (adsRes.error) throw adsRes.error;

      setProperties((propRes.data || []) as Property[]);

      const sales = salesRes.data || [];
      const commissions_total = sales.reduce((sum: number, s: any) => sum + (Number(s.commission_amount_dh) || 0), 0);

      const rentRows = rentRes.data || [];
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const overdue = rentRows.filter((r: any) => {
        if (r.paid_at) return false;
        const due = r.due_date ? new Date(r.due_date) : null;
        return due ? due < today : false;
      });
      const rent_overdue_count = overdue.length;
      const rent_overdue_total = overdue.reduce((sum: number, r: any) => sum + (Number(r.amount_dh) || 0), 0);

      const ads = adsRes.data || [];
      const ads_total = ads.reduce((sum: number, a: any) => sum + (Number(a.amount_dh) || 0), 0);

      setStats({
        commissions_total,
        rent_overdue_total,
        rent_overdue_count,
        ads_total
      });
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

  const ensurePropertySelectedDefaults = () => {
    if (properties.length === 0) return;
    if (!saleForm.property_id) setSaleForm((f) => ({ ...f, property_id: properties[0].id }));
    if (!rentForm.property_id) setRentForm((f) => ({ ...f, property_id: properties[0].id }));
    if (!adForm.property_id) setAdForm((f) => ({ ...f, property_id: properties[0].id }));
  };

  useEffect(() => {
    ensurePropertySelectedDefaults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties]);

  const onAddSale = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaleSaving(true);
    try {
      const { error } = await supabase.from('real_estate_sales').insert({
        user_id: user.id,
        property_id: saleForm.property_id,
        sale_amount_dh: Number(saleForm.sale_amount_dh),
        commission_rate: Number(saleForm.commission_rate),
        sold_at: saleForm.sold_at ? new Date(saleForm.sold_at).toISOString() : new Date().toISOString()
      });
      if (error) throw error;
      toast({ title: 'Succès', description: 'Commission ajoutée.' });
      setSaleDialogOpen(false);
      refresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err.message || 'Failed to add sale.' });
    } finally {
      setSaleSaving(false);
    }
  };

  const onAddRent = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setRentSaving(true);
    try {
      const cleanPhone = rentForm.client_phone ? String(rentForm.client_phone).replace(/\D/g, '') : '';

      // Upsert client (acquereur role in MVP)
      let clientId: string | null = null;
      if (cleanPhone) {
        const { data: existingClient } = await supabase
          .from('real_estate_clients')
          .select('id')
          .eq('user_id', user.id)
          .eq('role', 'acquereur')
          .eq('phone', cleanPhone)
          .maybeSingle();
        clientId = existingClient?.id ?? null;

        if (!clientId) {
          const { data: createdClient, error: createClientError } = await supabase
            .from('real_estate_clients')
            .insert({
              user_id: user.id,
              role: 'acquereur',
              full_name: rentForm.client_name || 'Locataire',
              phone: cleanPhone,
              email: null,
              details: {}
            })
            .select('id')
            .single();
          if (createClientError) throw createClientError;
          clientId = createdClient?.id ?? null;
        }
      }

      const { error } = await supabase.from('real_estate_rent_payments').insert({
        user_id: user.id,
        property_id: rentForm.property_id,
        client_id: clientId,
        due_date: rentForm.due_date ? new Date(rentForm.due_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        amount_dh: Number(rentForm.amount_dh),
        paid_at: null,
        notes: null
      });
      if (error) throw error;

      toast({ title: 'Succès', description: 'Loyer ajouté (non payé pour l’instant).' });
      setRentDialogOpen(false);
      refresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err.message || 'Failed to add rent.' });
    } finally {
      setRentSaving(false);
    }
  };

  const onAddAd = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAdSaving(true);
    try {
      const { error } = await supabase.from('real_estate_ad_expenses').insert({
        user_id: user.id,
        property_id: adForm.property_id,
        platform: adForm.platform,
        amount_dh: Number(adForm.amount_dh),
        expense_date: adForm.expense_date ? new Date(adForm.expense_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
      });
      if (error) throw error;

      toast({ title: 'Succès', description: 'Dépense publicitaire ajoutée.' });
      setAdDialogOpen(false);
      refresh();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err.message || 'Failed to add ad.' });
    } finally {
      setAdSaving(false);
    }
  };

  return (
    <AppLayout>
      <Card className="glass-card">
        <CardHeader className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold">Finance Immobilier</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Commissions, loyers et dépenses publicitaires.</p>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Chargement...
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="rounded-xl border p-4 bg-secondary/20">
                  <div className="text-sm text-muted-foreground">Commissions (Vendu)</div>
                  <div className="text-2xl font-bold mt-2">{stats.commissions_total.toFixed(2)} DH</div>
                </div>
                <div className="rounded-xl border p-4 bg-secondary/20">
                  <div className="text-sm text-muted-foreground">Loyers en retard</div>
                  <div className="text-2xl font-bold mt-2">{stats.rent_overdue_count} / {stats.rent_overdue_total.toFixed(2)} DH</div>
                </div>
                <div className="rounded-xl border p-4 bg-secondary/20">
                  <div className="text-sm text-muted-foreground">Dépenses publicitaires</div>
                  <div className="text-2xl font-bold mt-2">{stats.ads_total.toFixed(2)} DH</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={() => setSaleDialogOpen(true)} className="flex-1">
                  <Plus className="mr-2 h-4 w-4" /> Ajouter vente / commission
                </Button>
                <Button onClick={() => setRentDialogOpen(true)} className="flex-1" variant="secondary">
                  <Plus className="mr-2 h-4 w-4" /> Ajouter loyer (due)
                </Button>
                <Button onClick={() => setAdDialogOpen(true)} className="flex-1" variant="secondary">
                  <Plus className="mr-2 h-4 w-4" /> Ajouter dépense pub
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sale dialog */}
      <Dialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter une vente / commission</DialogTitle>
          </DialogHeader>

          <form onSubmit={onAddSale} className="space-y-4">
            <div className="space-y-2">
              <Label>Bien</Label>
              <Select value={saleForm.property_id} onValueChange={(v) => setSaleForm((f) => ({ ...f, property_id: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Montant vente (DH)</Label>
              <Input value={saleForm.sale_amount_dh} onChange={(e) => setSaleForm((f) => ({ ...f, sale_amount_dh: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Taux commission (ex: 0.025 = 2.5%)</Label>
              <Input value={saleForm.commission_rate} onChange={(e) => setSaleForm((f) => ({ ...f, commission_rate: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Date vente</Label>
              <Input type="date" value={saleForm.sold_at ? saleForm.sold_at.slice(0, 10) : ''} onChange={(e) => setSaleForm((f) => ({ ...f, sold_at: e.target.value }))} />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setSaleDialogOpen(false)} disabled={saleSaving}>
                Annuler
              </Button>
              <Button type="submit" disabled={saleSaving}>
                {saleSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rent dialog */}
      <Dialog open={rentDialogOpen} onOpenChange={setRentDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter loyer (due)</DialogTitle>
          </DialogHeader>

          <form onSubmit={onAddRent} className="space-y-4">
            <div className="space-y-2">
              <Label>Bien</Label>
              <Select value={rentForm.property_id} onValueChange={(v) => setRentForm((f) => ({ ...f, property_id: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input type="date" value={rentForm.due_date} onChange={(e) => setRentForm((f) => ({ ...f, due_date: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Montant (DH)</Label>
                <Input value={rentForm.amount_dh} onChange={(e) => setRentForm((f) => ({ ...f, amount_dh: e.target.value }))} />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom locataire</Label>
                <Input value={rentForm.client_name} onChange={(e) => setRentForm((f) => ({ ...f, client_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={rentForm.client_phone} onChange={(e) => setRentForm((f) => ({ ...f, client_phone: e.target.value }))} />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setRentDialogOpen(false)} disabled={rentSaving}>
                Annuler
              </Button>
              <Button type="submit" disabled={rentSaving}>
                {rentSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ad dialog */}
      <Dialog open={adDialogOpen} onOpenChange={setAdDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter dépense publicitaire</DialogTitle>
          </DialogHeader>

          <form onSubmit={onAddAd} className="space-y-4">
            <div className="space-y-2">
              <Label>Bien</Label>
              <Select value={adForm.property_id} onValueChange={(v) => setAdForm((f) => ({ ...f, property_id: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plateforme</Label>
                <Input value={adForm.platform} onChange={(e) => setAdForm((f) => ({ ...f, platform: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Montant (DH)</Label>
                <Input value={adForm.amount_dh} onChange={(e) => setAdForm((f) => ({ ...f, amount_dh: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={adForm.expense_date} onChange={(e) => setAdForm((f) => ({ ...f, expense_date: e.target.value }))} required />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setAdDialogOpen(false)} disabled={adSaving}>
                Annuler
              </Button>
              <Button type="submit" disabled={adSaving}>
                {adSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

