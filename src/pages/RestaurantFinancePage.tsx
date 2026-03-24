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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, TrendingUp, TrendingDown, DollarSign, PieChart, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';

const EXPENSE_CATEGORIES = [
  { value: 'ingredients', label: 'Ingredients' },
  { value: 'utilities', label: 'Services (eau, electricite, gaz)' },
  { value: 'rent', label: 'Loyer' },
  { value: 'equipment', label: 'Equipement' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Autre' },
];

type ExpenseForm = {
  category: string;
  description: string;
  amount_dh: string;
  expense_date: string;
  notes: string;
};

const emptyForm: ExpenseForm = {
  category: 'ingredients',
  description: '',
  amount_dh: '',
  expense_date: new Date().toISOString().split('T')[0],
  notes: '',
};

export default function RestaurantFinancePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function refreshData() {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Revenue from delivered orders
      const { data: deliveredOrders } = await (supabase.from('restaurant_orders' as any)
        .select('total_dh')
        .eq('user_id', user.id)
        .eq('status', 'delivered') as any);

      const rev = (deliveredOrders || []).reduce((sum: number, o: any) => sum + (o.total_dh || 0), 0);
      setRevenue(rev);
      setTotalOrders((deliveredOrders || []).length);

      // Expenses
      const { data: expenseData } = await (supabase.from('restaurant_expenses' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('expense_date', { ascending: false }) as any);

      setExpenses(expenseData || []);
      const totalExp = (expenseData || []).reduce((sum: number, e: any) => sum + (e.amount_dh || 0), 0);
      setTotalExpenses(totalExp);
    } catch (err) {
      console.error('Error loading finance data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshData(); }, [user]);

  async function saveExpense(e: FormEvent) {
    e.preventDefault();
    if (!user?.id || !form.description.trim() || !form.amount_dh) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        category: form.category,
        description: form.description.trim(),
        amount_dh: parseFloat(form.amount_dh) || 0,
        expense_date: form.expense_date,
        notes: form.notes,
      };
      const { error } = await (supabase.from('restaurant_expenses' as any).insert(payload) as any);
      if (error) throw error;
      toast({ title: 'Depense ajoutee' });
      setDialogOpen(false);
      setForm(emptyForm);
      refreshData();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(id: string) {
    if (!confirm('Supprimer cette depense ?')) return;
    try {
      const { error } = await (supabase.from('restaurant_expenses' as any).delete().eq('id', id) as any);
      if (error) throw error;
      toast({ title: 'Depense supprimee' });
      refreshData();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  }

  const profit = revenue - totalExpenses;
  const avgOrderValue = totalOrders > 0 ? revenue / totalOrders : 0;

  // Group expenses by category
  const expensesByCategory: Record<string, number> = {};
  expenses.forEach((e: any) => {
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + (e.amount_dh || 0);
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Finance</h1>
            <p className="text-muted-foreground">Suivez vos revenus, depenses et marges.</p>
          </div>
          <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter une Depense
          </Button>
        </div>

        {/* Stats Cards */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Revenu Total</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-400">{revenue.toFixed(2)} DH</div>
                  <p className="text-xs text-muted-foreground">{totalOrders} commandes livrees</p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Depenses Totales</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-400">{totalExpenses.toFixed(2)} DH</div>
                  <p className="text-xs text-muted-foreground">{expenses.length} depenses</p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Benefice Net</CardTitle>
                  <DollarSign className={`h-4 w-4 ${profit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{profit.toFixed(2)} DH</div>
                  <p className="text-xs text-muted-foreground">Revenu - Depenses</p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Panier Moyen</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgOrderValue.toFixed(2)} DH</div>
                  <p className="text-xs text-muted-foreground">Par commande</p>
                </CardContent>
              </Card>
            </div>

            {/* Expense Breakdown */}
            {Object.keys(expensesByCategory).length > 0 && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PieChart className="h-5 w-5" /> Repartition des Depenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-3">
                    {Object.entries(expensesByCategory).map(([cat, amount]) => {
                      const label = EXPENSE_CATEGORIES.find(c => c.value === cat)?.label || cat;
                      const pct = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : '0';
                      return (
                        <div key={cat} className="flex items-center justify-between bg-secondary/10 rounded-lg p-3">
                          <span className="text-sm font-medium">{label}</span>
                          <div className="text-right">
                            <span className="font-bold">{amount.toFixed(2)} DH</span>
                            <span className="text-xs text-muted-foreground ml-2">({pct}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Expense List */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Historique des Depenses</CardTitle>
              </CardHeader>
              <CardContent>
                {expenses.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Aucune depense enregistree.</p>
                ) : (
                  <div className="space-y-2">
                    {expenses.map((exp: any) => (
                      <div key={exp.id} className="flex items-center justify-between bg-secondary/10 rounded-lg p-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{exp.description}</span>
                            <Badge variant="outline" className="text-xs">
                              {EXPENSE_CATEGORIES.find(c => c.value === exp.category)?.label || exp.category}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>{exp.expense_date ? format(new Date(exp.expense_date), 'dd/MM/yyyy') : ''}</span>
                            {exp.notes && <span>- {exp.notes}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-red-400">{exp.amount_dh} DH</span>
                          <Button variant="ghost" size="icon" className="text-red-400 h-8 w-8" onClick={() => deleteExpense(exp.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle Depense</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveExpense} className="space-y-4">
            <div>
              <Label>Categorie</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description *</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Montant (DH) *</Label>
                <Input type="number" step="0.01" value={form.amount_dh} onChange={(e) => setForm({ ...form, amount_dh: e.target.value })} required />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Ajouter la depense
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
