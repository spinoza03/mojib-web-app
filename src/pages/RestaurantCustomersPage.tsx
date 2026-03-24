import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2, Users, Send, Phone, ShoppingCart, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function RestaurantCustomersPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Customer dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', address: '', notes: '' });
  const [saving, setSaving] = useState(false);

  // Customer detail
  const [detailCustomer, setDetailCustomer] = useState<any | null>(null);
  const [detailOrders, setDetailOrders] = useState<any[]>([]);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Bulk marketing
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [marketingDialogOpen, setMarketingDialogOpen] = useState(false);
  const [marketingMessage, setMarketingMessage] = useState('');
  const [sendingMarketing, setSendingMarketing] = useState(false);

  async function refreshCustomers() {
    if (!user?.id) return;
    setLoading(true);
    try {
      let query = supabase.from('restaurant_customers' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }) as any;

      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const { data } = await query;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshCustomers(); }, [user, searchTerm]);

  function openNewCustomer() {
    setEditingId(null);
    setForm({ full_name: '', phone: '', email: '', address: '', notes: '' });
    setDialogOpen(true);
  }

  function openEditCustomer(c: any) {
    setEditingId(c.id);
    setForm({
      full_name: c.full_name || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      notes: c.notes || '',
    });
    setDialogOpen(true);
  }

  async function saveCustomer(e: FormEvent) {
    e.preventDefault();
    if (!user?.id || !form.full_name.trim()) return;
    setSaving(true);
    try {
      const payload = { user_id: user.id, ...form };
      if (editingId) {
        const { error } = await (supabase.from('restaurant_customers' as any).update(payload).eq('id', editingId) as any);
        if (error) throw error;
        toast({ title: 'Client mis a jour' });
      } else {
        const { error } = await (supabase.from('restaurant_customers' as any).insert(payload) as any);
        if (error) throw error;
        toast({ title: 'Client ajoute' });
      }
      setDialogOpen(false);
      refreshCustomers();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer(id: string) {
    if (!confirm('Supprimer ce client ?')) return;
    try {
      const { error } = await (supabase.from('restaurant_customers' as any).delete().eq('id', id) as any);
      if (error) throw error;
      toast({ title: 'Client supprime' });
      refreshCustomers();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  }

  async function openCustomerDetail(customer: any) {
    setDetailCustomer(customer);
    const { data: orders } = await (supabase.from('restaurant_orders' as any)
      .select('*')
      .eq('user_id', user?.id)
      .eq('customer_phone', customer.phone)
      .order('created_at', { ascending: false })
      .limit(10) as any);
    setDetailOrders(orders || []);
    setDetailDialogOpen(true);
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  function toggleSelectAll() {
    if (selectedIds.size === customers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map((c: any) => c.id)));
    }
  }

  function openMarketingDialog() {
    if (selectedIds.size === 0) {
      toast({ title: 'Selectionnez des clients', variant: 'destructive' });
      return;
    }
    setMarketingMessage('');
    setMarketingDialogOpen(true);
  }

  async function sendBulkMarketing(e: FormEvent) {
    e.preventDefault();
    if (!user?.id || !marketingMessage.trim() || selectedIds.size === 0) return;
    setSendingMarketing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/marketing/bulk-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          customer_ids: Array.from(selectedIds),
          message: marketingMessage,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erreur');
      toast({ title: `Messages envoyes: ${result.sent}/${result.total}` });
      setMarketingDialogOpen(false);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSendingMarketing(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Clients</h1>
            <p className="text-muted-foreground">Gerez vos clients et envoyez des messages marketing.</p>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <Button variant="outline" onClick={openMarketingDialog}>
                <Send className="mr-2 h-4 w-4" /> Envoyer ({selectedIds.size})
              </Button>
            )}
            <Button onClick={openNewCustomer}>
              <Plus className="mr-2 h-4 w-4" /> Ajouter un Client
            </Button>
          </div>
        </div>

        <div className="flex gap-3">
          <Input
            placeholder="Rechercher par nom ou telephone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : customers.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="p-12 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/20 flex items-center justify-center">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Aucun client</h3>
              <p className="text-muted-foreground">Les clients seront ajoutes automatiquement lors des commandes ou manuellement.</p>
              <Button onClick={openNewCustomer}><Plus className="mr-2 h-4 w-4" /> Ajouter un Client</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2">
              <Checkbox
                checked={selectedIds.size === customers.length && customers.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-muted-foreground">Tout selectionner</span>
            </div>
            {customers.map((c: any) => (
              <Card key={c.id} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedIds.has(c.id)}
                      onCheckedChange={() => toggleSelect(c.id)}
                    />
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold cursor-pointer" onClick={() => openCustomerDetail(c)}>
                      {(c.full_name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openCustomerDetail(c)}>
                      <p className="font-medium">{c.full_name || 'Sans nom'}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                        <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" />{c.total_orders || 0} commandes</span>
                        <span>{c.total_spent || 0} DH</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditCustomer(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-400" onClick={() => deleteCustomer(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Customer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier le Client' : 'Nouveau Client'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveCustomer} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom complet *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </div>
              <div>
                <Label>Telephone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Adresse</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingId ? 'Mettre a jour' : 'Ajouter'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Fiche Client</DialogTitle>
          </DialogHeader>
          {detailCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Nom:</span><p className="font-medium">{detailCustomer.full_name}</p></div>
                <div><span className="text-muted-foreground">Telephone:</span><p className="font-medium">{detailCustomer.phone || 'N/A'}</p></div>
                <div><span className="text-muted-foreground">Email:</span><p className="font-medium">{detailCustomer.email || 'N/A'}</p></div>
                <div><span className="text-muted-foreground">Adresse:</span><p className="font-medium">{detailCustomer.address || 'N/A'}</p></div>
              </div>
              <div className="flex gap-4">
                <Badge variant="secondary"><ShoppingCart className="h-3 w-3 mr-1" />{detailCustomer.total_orders || 0} commandes</Badge>
                <Badge variant="secondary">{detailCustomer.total_spent || 0} DH depenses</Badge>
              </div>
              {detailCustomer.notes && (
                <div className="text-sm"><span className="text-muted-foreground">Notes:</span><p>{detailCustomer.notes}</p></div>
              )}
              <div className="border-t border-white/10 pt-3">
                <h4 className="font-medium mb-2">Dernieres Commandes</h4>
                {detailOrders.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Aucune commande</p>
                ) : (
                  <div className="space-y-2">
                    {detailOrders.map((order: any) => (
                      <div key={order.id} className="flex justify-between items-center text-sm bg-secondary/10 rounded-lg p-2">
                        <div>
                          <span className="font-medium">{order.created_at ? format(new Date(order.created_at), 'dd/MM/yyyy HH:mm') : ''}</span>
                          <Badge className="ml-2 text-xs" variant="outline">{order.status}</Badge>
                        </div>
                        <span className="font-bold">{order.total_dh || 0} DH</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Marketing Dialog */}
      <Dialog open={marketingDialogOpen} onOpenChange={setMarketingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><MessageSquare className="inline h-5 w-5 mr-2" />Message Marketing</DialogTitle>
          </DialogHeader>
          <form onSubmit={sendBulkMarketing} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Envoyer un message WhatsApp a {selectedIds.size} client(s) selectionne(s).
            </p>
            <div>
              <Label>Message *</Label>
              <Textarea
                value={marketingMessage}
                onChange={(e) => setMarketingMessage(e.target.value)}
                rows={4}
                placeholder="Ex: Bonjour! Decouvrez nos nouvelles offres cette semaine..."
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={sendingMarketing}>
              {sendingMarketing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Envoyer a {selectedIds.size} clients
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
