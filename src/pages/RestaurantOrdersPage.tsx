import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, ShoppingCart, ChevronRight, Phone, MapPin, Clock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

type OrderStatus = 'pending' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'delivered' | 'cancelled';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente',
  preparing: 'En preparation',
  ready_for_pickup: 'Pret',
  out_for_delivery: 'En livraison',
  delivered: 'Livre',
  cancelled: 'Annule',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  preparing: 'bg-blue-500/20 text-blue-400',
  ready_for_pickup: 'bg-green-500/20 text-green-400',
  out_for_delivery: 'bg-purple-500/20 text-purple-400',
  delivered: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'out_for_delivery', 'cancelled'],
  ready_for_pickup: ['delivered', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
};

type OrderItemInput = { item_name: string; quantity: number; customizations: string };

export default function RestaurantOrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('active');
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [orderForm, setOrderForm] = useState({
    customer_name: '',
    customer_phone: '',
    delivery_address: '',
    order_type: 'delivery' as 'delivery' | 'pickup' | 'dine_in',
    notes: '',
  });
  const [orderItems, setOrderItems] = useState<OrderItemInput[]>([{ item_name: '', quantity: 1, customizations: '' }]);

  async function refreshOrders() {
    if (!user?.id) return;
    setLoading(true);
    try {
      let query = supabase.from('restaurant_orders' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }) as any;

      if (activeTab === 'active') {
        query = query.in('status', ['pending', 'preparing', 'ready_for_pickup', 'out_for_delivery']);
      } else if (activeTab === 'delivered') {
        query = query.eq('status', 'delivered');
      } else if (activeTab === 'cancelled') {
        query = query.eq('status', 'cancelled');
      }

      const { data } = await query;
      setOrders(data || []);
    } catch (err) {
      console.error('Error loading orders:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshOrders(); }, [user, activeTab]);

  async function openOrderDetail(order: any) {
    setDetailOrder(order);
    const { data: items } = await (supabase.from('restaurant_order_items' as any)
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true }) as any);
    setDetailItems(items || []);
    setDetailDialogOpen(true);
  }

  async function updateOrderStatus(orderId: string, newStatus: OrderStatus) {
    try {
      const { error } = await (supabase.from('restaurant_orders' as any)
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId) as any);
      if (error) throw error;
      toast({ title: `Commande ${STATUS_LABELS[newStatus]}` });
      setDetailDialogOpen(false);
      refreshOrders();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  }

  async function openCreateOrder() {
    if (user?.id) {
      const { data } = await (supabase.from('restaurant_menu_items' as any)
        .select('id, name, price_dh')
        .eq('user_id', user.id)
        .eq('is_available', true)
        .order('name') as any);
      setMenuItems(data || []);
    }
    setOrderForm({ customer_name: '', customer_phone: '', delivery_address: '', order_type: 'delivery', notes: '' });
    setOrderItems([{ item_name: '', quantity: 1, customizations: '' }]);
    setCreateDialogOpen(true);
  }

  function addOrderItem() {
    setOrderItems([...orderItems, { item_name: '', quantity: 1, customizations: '' }]);
  }
  function removeOrderItem(index: number) {
    if (orderItems.length <= 1) return;
    setOrderItems(orderItems.filter((_, i) => i !== index));
  }
  function updateOrderItem(index: number, field: keyof OrderItemInput, value: any) {
    const updated = [...orderItems];
    updated[index] = { ...updated[index], [field]: value };
    setOrderItems(updated);
  }

  async function submitOrder(e: FormEvent) {
    e.preventDefault();
    if (!user?.id || !orderForm.customer_name || orderItems.every(i => !i.item_name)) return;
    setSaving(true);
    try {
      const validItems = orderItems.filter(i => i.item_name);
      let total = 0;
      const itemsToInsert: any[] = [];

      for (const oi of validItems) {
        const menuItem = menuItems.find((m: any) => m.name === oi.item_name);
        const unitPrice = menuItem?.price_dh || 0;
        total += unitPrice * oi.quantity;
        itemsToInsert.push({
          user_id: user.id,
          menu_item_id: menuItem?.id || null,
          item_name: oi.item_name,
          quantity: oi.quantity,
          unit_price_dh: unitPrice,
          customizations: oi.customizations,
        });
      }

      const { data: newOrder, error: orderErr } = await (supabase.from('restaurant_orders' as any).insert({
        user_id: user.id,
        customer_name: orderForm.customer_name,
        customer_phone: orderForm.customer_phone,
        delivery_address: orderForm.delivery_address,
        order_type: orderForm.order_type,
        status: 'pending',
        total_dh: total,
        notes: orderForm.notes,
      }).select().single() as any);

      if (orderErr) throw orderErr;

      for (const item of itemsToInsert) {
        item.order_id = newOrder.id;
      }
      await (supabase.from('restaurant_order_items' as any).insert(itemsToInsert) as any);

      toast({ title: 'Commande creee' });
      setCreateDialogOpen(false);
      refreshOrders();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function calcOrderTotal() {
    return orderItems.reduce((sum, oi) => {
      const menuItem = menuItems.find((m: any) => m.name === oi.item_name);
      return sum + (menuItem?.price_dh || 0) * oi.quantity;
    }, 0);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Commandes</h1>
            <p className="text-muted-foreground">Gerez les commandes de votre restaurant.</p>
          </div>
          <Button onClick={openCreateOrder}>
            <Plus className="mr-2 h-4 w-4" /> Nouvelle Commande
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="active">Actives</TabsTrigger>
            <TabsTrigger value="delivered">Livrees</TabsTrigger>
            <TabsTrigger value="cancelled">Annulees</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="p-12 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/20 flex items-center justify-center">
                <ShoppingCart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Aucune commande</h3>
              <p className="text-muted-foreground">Les commandes apparaitront ici quand elles seront passees via WhatsApp ou manuellement.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order: any) => (
              <Card key={order.id} className="glass-card hover:bg-secondary/10 transition-colors cursor-pointer" onClick={() => openOrderDetail(order)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {(order.customer_name || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{order.customer_name || 'Client'}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {order.customer_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{order.customer_phone}</span>}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {order.created_at ? format(new Date(order.created_at), 'dd/MM HH:mm') : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary">{order.total_dh || 0} DH</span>
                      <Badge className={STATUS_COLORS[order.status as OrderStatus] || ''}>
                        {STATUS_LABELS[order.status as OrderStatus] || order.status}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail de la Commande</DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Client:</span>
                  <p className="font-medium">{detailOrder.customer_name || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Telephone:</span>
                  <p className="font-medium">{detailOrder.customer_phone || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <p className="font-medium capitalize">{detailOrder.order_type || 'delivery'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Statut:</span>
                  <Badge className={STATUS_COLORS[detailOrder.status as OrderStatus] || ''}>
                    {STATUS_LABELS[detailOrder.status as OrderStatus] || detailOrder.status}
                  </Badge>
                </div>
              </div>

              {detailOrder.delivery_address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span>{detailOrder.delivery_address}</span>
                </div>
              )}

              <div className="border-t border-white/10 pt-3">
                <h4 className="font-medium mb-2">Articles</h4>
                {detailItems.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Aucun article</p>
                ) : (
                  <div className="space-y-2">
                    {detailItems.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center text-sm bg-secondary/10 rounded-lg p-2">
                        <div>
                          <span className="font-medium">{item.quantity}x {item.item_name}</span>
                          {item.customizations && <p className="text-xs text-muted-foreground">{item.customizations}</p>}
                        </div>
                        <span>{(item.unit_price_dh * item.quantity).toFixed(2)} DH</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between font-bold mt-3 pt-2 border-t border-white/10">
                  <span>Total</span>
                  <span className="text-primary">{detailOrder.total_dh || 0} DH</span>
                </div>
              </div>

              {detailOrder.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Notes:</span>
                  <p>{detailOrder.notes}</p>
                </div>
              )}

              {NEXT_STATUS[detailOrder.status as OrderStatus] && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {NEXT_STATUS[detailOrder.status as OrderStatus]!.map((nextStatus) => (
                    <Button
                      key={nextStatus}
                      variant={nextStatus === 'cancelled' ? 'outline' : 'default'}
                      size="sm"
                      className={nextStatus === 'cancelled' ? 'text-red-400 border-red-400/30' : ''}
                      onClick={() => updateOrderStatus(detailOrder.id, nextStatus)}
                    >
                      {nextStatus === 'cancelled' ? 'Annuler' : STATUS_LABELS[nextStatus]}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Order Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle Commande</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitOrder} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nom du client *</Label>
                <Input value={orderForm.customer_name} onChange={(e) => setOrderForm({ ...orderForm, customer_name: e.target.value })} required />
              </div>
              <div>
                <Label>Telephone</Label>
                <Input value={orderForm.customer_phone} onChange={(e) => setOrderForm({ ...orderForm, customer_phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={orderForm.order_type} onValueChange={(v: any) => setOrderForm({ ...orderForm, order_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delivery">Livraison</SelectItem>
                    <SelectItem value="pickup">Emporter</SelectItem>
                    <SelectItem value="dine_in">Sur place</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Adresse de livraison</Label>
                <Input value={orderForm.delivery_address} onChange={(e) => setOrderForm({ ...orderForm, delivery_address: e.target.value })} />
              </div>
            </div>

            <div className="border-t border-white/10 pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-medium">Articles</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOrderItem}>
                  <Plus className="h-3 w-3 mr-1" /> Ajouter
                </Button>
              </div>
              {orderItems.map((oi, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <Select value={oi.item_name || 'select'} onValueChange={(v) => updateOrderItem(idx, 'item_name', v === 'select' ? '' : v)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Choisir un plat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="select" disabled>Choisir un plat</SelectItem>
                      {menuItems.map((mi: any) => (
                        <SelectItem key={mi.id} value={mi.name}>{mi.name} - {mi.price_dh} DH</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    className="w-16"
                    value={oi.quantity}
                    onChange={(e) => updateOrderItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                  />
                  <Input
                    placeholder="Notes"
                    className="w-32"
                    value={oi.customizations}
                    onChange={(e) => updateOrderItem(idx, 'customizations', e.target.value)}
                  />
                  {orderItems.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="text-red-400" onClick={() => removeOrderItem(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="text-right font-bold text-primary mt-2">Total: {calcOrderTotal().toFixed(2)} DH</div>
            </div>

            <div>
              <Label>Notes generales</Label>
              <Textarea value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} rows={2} />
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Creer la commande
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
