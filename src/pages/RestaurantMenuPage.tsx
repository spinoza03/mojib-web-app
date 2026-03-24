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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Pencil, UtensilsCrossed, FolderPlus, GripVertical } from 'lucide-react';

type CategoryForm = { name: string; display_order: string };
type MenuItemForm = {
  name: string;
  description: string;
  price_dh: string;
  category_id: string;
  is_available: boolean;
};

const emptyCategory: CategoryForm = { name: '', display_order: '0' };
const emptyItem: MenuItemForm = { name: '', description: '', price_dh: '', category_id: '', is_available: true };

export default function RestaurantMenuPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Category dialog
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState<CategoryForm>(emptyCategory);
  const [savingCat, setSavingCat] = useState(false);

  // Item dialog
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<MenuItemForm>(emptyItem);
  const [itemPhoto, setItemPhoto] = useState<File | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  const bucketName = 'restaurant-media';

  async function refreshData() {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: cats } = await (supabase.from('restaurant_menu_categories' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true }) as any);
      setCategories(cats || []);

      let query = supabase.from('restaurant_menu_items' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true }) as any;

      if (categoryFilter !== 'all') {
        query = query.eq('category_id', categoryFilter);
      }
      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data: menuItems } = await query;
      setItems(menuItems || []);
    } catch (err) {
      console.error('Error loading menu data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshData(); }, [user, categoryFilter, searchTerm]);

  // --- Category CRUD ---
  function openNewCategory() {
    setEditingCatId(null);
    setCatForm(emptyCategory);
    setCatDialogOpen(true);
  }
  function openEditCategory(cat: any) {
    setEditingCatId(cat.id);
    setCatForm({ name: cat.name, display_order: String(cat.display_order || 0) });
    setCatDialogOpen(true);
  }
  async function saveCategory(e: FormEvent) {
    e.preventDefault();
    if (!user?.id || !catForm.name.trim()) return;
    setSavingCat(true);
    try {
      const payload = {
        user_id: user.id,
        name: catForm.name.trim(),
        display_order: parseInt(catForm.display_order) || 0,
      };
      if (editingCatId) {
        const { error } = await (supabase.from('restaurant_menu_categories' as any).update(payload).eq('id', editingCatId) as any);
        if (error) throw error;
        toast({ title: 'Categorie mise a jour' });
      } else {
        const { error } = await (supabase.from('restaurant_menu_categories' as any).insert(payload) as any);
        if (error) throw error;
        toast({ title: 'Categorie ajoutee' });
      }
      setCatDialogOpen(false);
      refreshData();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSavingCat(false);
    }
  }
  async function deleteCategory(catId: string) {
    if (!confirm('Supprimer cette categorie ? Les articles resteront sans categorie.')) return;
    try {
      // Unlink items from this category
      await (supabase.from('restaurant_menu_items' as any).update({ category_id: null }).eq('category_id', catId) as any);
      const { error } = await (supabase.from('restaurant_menu_categories' as any).delete().eq('id', catId) as any);
      if (error) throw error;
      toast({ title: 'Categorie supprimee' });
      refreshData();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  }

  // --- Menu Item CRUD ---
  function openNewItem() {
    setEditingItemId(null);
    setItemForm(emptyItem);
    setItemPhoto(null);
    setItemDialogOpen(true);
  }
  function openEditItem(item: any) {
    setEditingItemId(item.id);
    setItemForm({
      name: item.name || '',
      description: item.description || '',
      price_dh: String(item.price_dh || ''),
      category_id: item.category_id || '',
      is_available: item.is_available !== false,
    });
    setItemPhoto(null);
    setItemDialogOpen(true);
  }

  async function saveItem(e: FormEvent) {
    e.preventDefault();
    if (!user?.id || !itemForm.name.trim() || !itemForm.price_dh) return;
    setSavingItem(true);
    try {
      let photo_url: string | undefined;
      if (itemPhoto) {
        const ext = itemPhoto.name.split('.').pop() || 'jpg';
        const filePath = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(bucketName).upload(filePath, itemPhoto);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
        photo_url = urlData.publicUrl;
      }

      const payload: any = {
        user_id: user.id,
        name: itemForm.name.trim(),
        description: itemForm.description.trim(),
        price_dh: parseFloat(itemForm.price_dh) || 0,
        category_id: itemForm.category_id || null,
        is_available: itemForm.is_available,
      };
      if (photo_url) payload.photo_url = photo_url;

      if (editingItemId) {
        const { error } = await (supabase.from('restaurant_menu_items' as any).update(payload).eq('id', editingItemId) as any);
        if (error) throw error;
        toast({ title: 'Article mis a jour' });
      } else {
        const { error } = await (supabase.from('restaurant_menu_items' as any).insert(payload) as any);
        if (error) throw error;
        toast({ title: 'Article ajoute' });
      }
      setItemDialogOpen(false);
      refreshData();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSavingItem(false);
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Supprimer cet article du menu ?')) return;
    try {
      const { error } = await (supabase.from('restaurant_menu_items' as any).delete().eq('id', itemId) as any);
      if (error) throw error;
      toast({ title: 'Article supprime' });
      refreshData();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  }

  async function toggleAvailability(itemId: string, current: boolean) {
    try {
      await (supabase.from('restaurant_menu_items' as any).update({ is_available: !current }).eq('id', itemId) as any);
      refreshData();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  }

  function getCategoryName(catId: string | null) {
    if (!catId) return 'Sans categorie';
    return categories.find((c: any) => c.id === catId)?.name || 'Inconnu';
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Gestion du Menu</h1>
            <p className="text-muted-foreground">Ajoutez et organisez les plats de votre restaurant.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openNewCategory}>
              <FolderPlus className="mr-2 h-4 w-4" /> Categorie
            </Button>
            <Button onClick={openNewItem}>
              <Plus className="mr-2 h-4 w-4" /> Ajouter un Plat
            </Button>
          </div>
        </div>

        {/* Categories Section */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune categorie. Ajoutez-en une pour organiser votre menu.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat: any) => (
                  <div key={cat.id} className="inline-flex items-center gap-1 bg-secondary/20 border border-white/10 rounded-lg px-3 py-1.5">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium">{cat.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditCategory(cat)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={() => deleteCategory(cat.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Rechercher un plat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="sm:max-w-[200px]">
              <SelectValue placeholder="Categorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les categories</SelectItem>
              {categories.map((cat: any) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Menu Items Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="p-12 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/20 flex items-center justify-center">
                <UtensilsCrossed className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Aucun plat dans le menu</h3>
              <p className="text-muted-foreground">Commencez par ajouter vos plats pour que l'IA puisse les proposer aux clients.</p>
              <Button onClick={openNewItem}><Plus className="mr-2 h-4 w-4" /> Ajouter un Plat</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item: any) => (
              <Card key={item.id} className={`glass-card overflow-hidden ${!item.is_available ? 'opacity-60' : ''}`}>
                {item.photo_url && (
                  <div className="h-40 overflow-hidden">
                    <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardContent className={`${item.photo_url ? 'p-4' : 'p-4 pt-6'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">{item.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.description || 'Pas de description'}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-primary font-bold">{item.price_dh} DH</Badge>
                        <Badge variant="outline" className="text-xs">{getCategoryName(item.category_id)}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Switch
                        checked={item.is_available}
                        onCheckedChange={() => toggleAvailability(item.id, item.is_available)}
                      />
                      <span className={`text-xs ${item.is_available ? 'text-green-400' : 'text-red-400'}`}>
                        {item.is_available ? 'Disponible' : 'Indisponible'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditItem(item)}>
                      <Pencil className="mr-1 h-3 w-3" /> Modifier
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-400 hover:text-red-300" onClick={() => deleteItem(item.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCatId ? 'Modifier la Categorie' : 'Nouvelle Categorie'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveCategory} className="space-y-4">
            <div>
              <Label>Nom</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required />
            </div>
            <div>
              <Label>Ordre d'affichage</Label>
              <Input type="number" value={catForm.display_order} onChange={(e) => setCatForm({ ...catForm, display_order: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={savingCat}>
              {savingCat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingCatId ? 'Mettre a jour' : 'Ajouter'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Menu Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItemId ? 'Modifier le Plat' : 'Nouveau Plat'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveItem} className="space-y-4">
            <div>
              <Label>Nom du plat *</Label>
              <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prix (DH) *</Label>
                <Input type="number" step="0.01" value={itemForm.price_dh} onChange={(e) => setItemForm({ ...itemForm, price_dh: e.target.value })} required />
              </div>
              <div>
                <Label>Categorie</Label>
                <Select value={itemForm.category_id || 'none'} onValueChange={(v) => setItemForm({ ...itemForm, category_id: v === 'none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Photo du plat</Label>
              <Input type="file" accept="image/*" onChange={(e) => setItemPhoto(e.target.files?.[0] || null)} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={itemForm.is_available} onCheckedChange={(v) => setItemForm({ ...itemForm, is_available: v })} />
              <Label>Disponible</Label>
            </div>
            <Button type="submit" className="w-full" disabled={savingItem}>
              {savingItem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingItemId ? 'Mettre a jour' : 'Ajouter au menu'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
