import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Users, Clock, ArrowRight, Activity, Loader2, Bot, MessageSquare, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user, profile, isNicheActive } = useAuth();
  const isImmobilier = profile?.niche === 'immobilier';
  const isRestaurant = profile?.niche === 'restaurant';

  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Stats State
  const [stats, setStats] = useState({
    totalAppointments: 0,
    upcomingAppointments: 0,
    totalPatients: 0,
  });

  // Upcoming List State
  const [upcomingList, setUpcomingList] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user?.id) return;

      try {
        const now = new Date().toISOString();

        if (profile?.niche === 'restaurant') {
          // Restaurant stats: orders & customers
          const { count: totalOrders } = await supabase
            .from('restaurant_orders' as any)
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

          const { count: pendingOrders } = await supabase
            .from('restaurant_orders' as any)
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .in('status', ['pending', 'preparing']);

          const { count: totalCustomers } = await supabase
            .from('restaurant_customers' as any)
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

          setStats({
            totalAppointments: totalOrders || 0,
            upcomingAppointments: pendingOrders || 0,
            totalPatients: totalCustomers || 0,
          });

          // Recent orders
          const { data: recentOrders } = await supabase
            .from('restaurant_orders' as any)
            .select('*')
            .eq('user_id', user.id)
            .in('status', ['pending', 'preparing', 'ready_for_pickup', 'out_for_delivery'])
            .order('created_at', { ascending: false })
            .limit(5);

          if (recentOrders) {
            setUpcomingList(recentOrders);
          }
        } else {
          // Medical / Immobilier: appointment stats
          let { count: totalCount, error: totalErr } = await supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('doctor_id', user.id);

          if (totalErr) {
            ({ count: totalCount } = await supabase
              .from('appointments')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id));
          }

          let { count: upcomingCount, error: upcomingErr } = await supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('doctor_id', user.id)
            .gte('start_time', now);

          if (upcomingErr) {
            ({ count: upcomingCount } = await supabase
              .from('appointments')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('date_time', now));
          }

          let { count: patientsCount, error: patientsErr } = await supabase
            .from('appointments')
            .select('patient_phone', { count: 'exact', head: true })
            .eq('doctor_id', user.id);

          if (patientsErr) {
            ({ count: patientsCount } = await supabase
              .from('appointments')
              .select('phone', { count: 'exact', head: true })
              .eq('user_id', user.id));
          }

          setStats({
            totalAppointments: totalCount || 0,
            upcomingAppointments: upcomingCount || 0,
            totalPatients: patientsCount || 0,
          });

          let { data: upcomingData, error: listErr } = await supabase
            .from('appointments')
            .select('*')
            .eq('doctor_id', user.id)
            .gte('start_time', now)
            .order('start_time', { ascending: true })
            .limit(5);

          if (listErr) {
            ({ data: upcomingData } = await supabase
              .from('appointments')
              .select('*')
              .eq('user_id', user.id)
              .gte('date_time', now)
              .order('date_time', { ascending: true })
              .limit(5));
          }

          if (upcomingData) {
            setUpcomingList(upcomingData);
          }
        }
      } catch (error) {
        console.error("Error loading dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [user, profile]);

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {greeting}, {profile?.clinic_name || (isRestaurant ? 'Chef' : isImmobilier ? 'Agent' : 'Docteur')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isRestaurant ? "Voici l'activité de votre restaurant aujourd'hui." : isImmobilier ? "Voici l'activité de votre agence aujourd'hui." : "Voici ce qui se passe dans votre clinique aujourd'hui."}
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => navigate('/appointments')} className="bg-primary hover:bg-primary/90">
              <Calendar className="mr-2 h-4 w-4" />
              Voir Calendrier
            </Button>
            <Button variant="outline" onClick={() => navigate('/settings')}>
              Gérer l'IA
            </Button>
          </div>
        </div>

        {/* Coming Soon for inactive niches */}
        {!isNicheActive && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-6 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-yellow-500/20 flex items-center justify-center">
                <Bot className="h-8 w-8 text-yellow-500" />
              </div>
              <h3 className="text-xl font-bold text-yellow-400">🚧 Fonctionnalités IA à venir</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Les fonctionnalités basées sur l'IA pour votre secteur sont en cours de développement. La gestion du calendrier et des rendez-vous est disponible dès maintenant !
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => navigate('/appointments')} className="bg-primary hover:bg-primary/90">
                  <Calendar className="mr-2 h-4 w-4" /> Voir Calendrier
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(`https://wa.me/212600000000?text=${encodeURIComponent('Bonjour, je veux savoir quand mon industrie sera disponible sur Mojib.AI.')}`, '_blank')}
                  className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
                >
                  <MessageSquare className="mr-2 h-4 w-4" /> Contacter le Support
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{isRestaurant ? 'Total Commandes' : 'Total Rendez-vous'}</CardTitle>
              {isRestaurant ? <ShoppingCart className="h-4 w-4 text-primary" /> : <Activity className="h-4 w-4 text-primary" />}
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-2xl font-bold">{stats.totalAppointments}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">{isRestaurant ? 'Commandes depuis toujours' : 'Réservations depuis toujours'}</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{isRestaurant ? 'En Cours' : 'À Venir'}</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-2xl font-bold">{stats.upcomingAppointments}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">{isRestaurant ? 'En attente ou en préparation' : 'Planifiés pour le futur'}</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{isRestaurant ? 'Total Clients' : isImmobilier ? 'Total Clients' : 'Total Patients'}</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <div className="text-2xl font-bold">{stats.totalPatients}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Contacts uniques</p>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming List Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="md:col-span-1 lg:col-span-4 glass-card">
            <CardHeader>
              <CardTitle>{isRestaurant ? 'Commandes Actives' : 'Prochains Rendez-vous'}</CardTitle>
              <CardDescription>
                {isRestaurant ? 'Vos dernières commandes en cours.' : 'Vos 5 prochaines visites planifiées.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : upcomingList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Aucun rendez-vous à venir.</p>
                  <Button variant="link" onClick={() => navigate('/appointments')} className="mt-2">
                    En planifier un maintenant
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingList.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-secondary/10 border border-white/5 hover:bg-secondary/20 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {apt.patient_name ? apt.patient_name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <p className="font-medium">{apt.patient_name || apt.customer_name || (isRestaurant ? 'Client' : isImmobilier ? 'Client Inconnu' : 'Patient Inconnu')}</p>
                          <p className="text-sm text-muted-foreground">
                            {apt.start_time
                              ? `${format(new Date(apt.start_time), 'dd/MM/yyyy')} à ${format(new Date(apt.start_time), 'HH:mm')}`
                              : apt.date_time
                                ? `${format(new Date(apt.date_time), 'dd/MM/yyyy')} à ${format(new Date(apt.date_time), 'HH:mm')}`
                                : 'Date non définie'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                           {apt.status}
                         </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions / Promo Card */}
          <Card className="md:col-span-1 lg:col-span-3 glass-card bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
             <CardHeader>
               <CardTitle>Connecter WhatsApp</CardTitle>
               <CardDescription>
                 {isRestaurant ? 'Votre serveur IA est-il actif ?' : isImmobilier ? 'Votre agent commercial IA est-il actif ?' : 'Votre réceptionniste IA est-elle active ?'}
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${profile?.whatsapp_status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-medium capitalize">{profile?.whatsapp_status || 'Déconnectée'}</span>
               </div>
               <p className="text-sm text-muted-foreground">
                 Scannez le code QR pour laisser l'IA gérer automatiquement vos réservations 24h/24 et 7j/7.
               </p>
               <Button onClick={() => navigate('/connect')} className="w-full">
                 Vérifier la Connexion <ArrowRight className="ml-2 h-4 w-4" />
               </Button>
             </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}