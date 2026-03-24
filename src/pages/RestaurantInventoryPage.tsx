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
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2, Package, AlertTriangle, Minus } from 'lucide-react';

type InventoryForm = {
  item_name: string;
  quantity: string;
  unit: string;
  unit_cost_dh: string;
  low_stock_threshold: string;
};

const emptyForm: InventoryForm = { item_name: '', quantity: '', unit: 'unite', unit_cost_dh: '', low_stock_threshold: '5' };

export default function RestaurantInventoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InventoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function refreshItems() {
    if (!user?.id) return;
    setLoading(true);
    try {
      let query = supabase.from('restaurant_inventory' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('item_name', { ascending: true }) as any;

      if (searchTerm) {
        query = query.ilike('item_name', `%${searchTerm}%`);
      }

      const { data } = await query;
      setItems(data || []);
    } catch (err) {
      console.error('Error loading inventory:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshItems(); }, [user, searchTerm]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(item: any) {
    setEditingId(item.id);
    setForm({
      item_name: item.item_name || '',
      quantity: String(item.quantity || 0),
      unit: item.unit || 'unite',
      unit_cost_dh: String(item.unit_cost_dh || ''),
      low_stock_threshold: String(item.low_stock_threshold || 5),
    });
    setDialogOpen(true);
  }

  async function saveItem(e: FormEvent) {
    e.preventDefault();
    if (!user?.id || !form.item_name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        item_name: form.item_name.trim(),
        quantity: parseFloat(form.quantity) || 0,
        unit: form.unit,
        unit_cost_dh: parseFloat(form.unit_cost_dh) || 0,
        low_stock_threshold: parseFloat(form.low_stock_threshold) || 5,
      };
      if (editingId) {
        const { error } = await (supabase.from('restaurant_inventory' as any).update(payload).eq('id', editingId) as any);
        if (error) throw error;
        toast({ title: 'Article mis a jour' });
      } else {
        const { error } = await (supabase.from('restaurant_inventory' as any).insert(payload) as any);
        if (error) throw error;
        toast({ title: 'Article ajoute' });
      }
      setDialogOpen(false);
      refreshItems();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm('Supprimer cet article du stock ?')) return;
    try {
      const { error } = await (supabase.from('restaurant_inventory' as any).delete().eq('id', id) as any);
      if (error) throw error;
      toast({ title: 'Article supprime' });
      refreshItems();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  }

  async function adjustQuantity(id: string, delta: number) {
    const item = items.find((i: any) => i.id === id);
    if (!item) return;
    const newQty = Math.max(0, (item.quantity || 0) + delta);
    try {
      await (supabase.from('restaurant_inventory' as any).update({ quantity: newQty }).eq('id', id) as any);
      refreshItems();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  }

  const lowStockCount = items.filter((i: any) => i.quantity <= (i.low_stock_threshold || 5)).length;
  const totalValue = items.reduce((sum: number, i: any) => sum + (i.quantity || 0) * (i.unit_cost_dh || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Gestion du Stock</h1>
            <p className="text-muted-foreground">Suivez votre inventaire et les niveaux de stock.</p>
          </div>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter un Article
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{items.length}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Stock Faible</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-yellow-400' : ''}`}>{lowStockCount}</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Valeur Totale</CardTitle>
              <Package className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalValue.toFixed(2)} DH</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Input
          placeholder="Rechercher un article..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />

        {/* Items List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="p-12 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/20 flex items-center justify-center">
                <Package className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Aucun article en stock</h3>
              <p className="text-muted-foreground">Ajoutez vos ingredients et fournitures pour suivre les niveaux de stock.</p>
              <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Ajouter un Article</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((item: any) => {
              const isLow = item.quantity <= (item.low_stock_threshold || 5);
              return (
                <Card key={item.id} className={`glass-card ${isLow ? 'border-yellow-500/30' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold ${isLow ? 'bg-yellow-500/20 text-yellow-400' : 'bg-primary/10 text-primary'}`}>
                          {isLow ? <AlertTriangle className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-medium">{item.item_name}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{item.unit_cost_dh || 0} DH/{item.unit}</span>
                            <span>Seuil: {item.low_stock_threshold || 5}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => adjustQuantity(item.id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className={`font-bold text-lg min-w-[60px] text-center ${isLow ? 'text-yellow-400' : ''}`}>
                            {item.quantity} {item.unit}
                          </span>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => adjustQuantity(item.id, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        {isLow && <Badge className="bg-yellow-500/20 text-yellow-400">Stock faible</Badge>}
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-400" onClick={() => deleteItem(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier l\'Article' : 'Nouvel Article'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveItem} className="space-y-4">
            <div>
              <Label>Nom de l'article *</Label>
              <Input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantite</Label>
                <Input type="number" step="0.1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div>
                <Label>Unite</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, L, unite..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cout unitaire (DH)</Label>
                <Input type="number" step="0.01" value={form.unit_cost_dh} onChange={(e) => setForm({ ...form, unit_cost_dh: e.target.value })} />
              </div>
              <div>
                <Label>Seuil d'alerte</Label>
                <Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingId ? 'Mettre a jour' : 'Ajouter'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
