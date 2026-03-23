import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PieChart, TrendingUp, DollarSign, Activity, ArrowUpRight, ArrowDownRight, Package } from 'lucide-react';
import moment from 'moment';
import 'moment/locale/fr';

moment.locale('fr');

export default function FinancePage() {
	const { user } = useAuth();
	const { toast } = useToast();
	const [loading, setLoading] = useState(true);
	const [treatments, setTreatments] = useState<any[]>([]);

	useEffect(() => {
		if (user) fetchAllTreatments();
	}, [user]);

	const fetchAllTreatments = async () => {
		try {
			const { data, error } = await supabase
				.from('treatments')
				.select(`
                    id,
                    treatment_name,
                    collected_amount,
                    product_cost,
                    net_profit,
                    date,
                    patient_id,
                    patients ( first_name, last_name )
                `)
				.eq('user_id', user?.id)
				.order('date', { ascending: false });

			if (error) throw error;
			setTreatments(data || []);
		} catch (error: any) {
			toast({ variant: 'destructive', title: 'Erreur', description: 'Données financières introuvables.' });
		} finally {
			setLoading(false);
		}
	};

    // Calculate aggregated metrics
    const totalCollected = treatments.reduce((sum, t) => sum + (t.collected_amount || 0), 0);
    const totalCost = treatments.reduce((sum, t) => sum + (t.product_cost || 0), 0);
    const totalProfit = treatments.reduce((sum, t) => sum + (t.net_profit || 0), 0);
    
    // Group by treatment name for Margin Analysis
    const analytics = treatments.reduce((acc, current) => {
        const name = current.treatment_name;
        if (!acc[name]) {
            acc[name] = { count: 0, revenue: 0, cost: 0, profit: 0 };
        }
        acc[name].count += 1;
        acc[name].revenue += current.collected_amount;
        acc[name].cost += current.product_cost;
        acc[name].profit += current.net_profit;
        return acc;
    }, {} as Record<string, any>);

    // Convert object to sorted array by profit margin
    const performanceList = Object.entries(analytics).map(([name, stats]: [string, any]) => ({
        name,
        ...stats,
        marginPercentage: stats.revenue > 0 ? (stats.profit / stats.revenue) * 100 : 0
    })).sort((a, b) => b.marginPercentage - a.marginPercentage);

    const formatDH = (num: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(num);

	return (
		<AppLayout>
			<div className="max-w-6xl mx-auto space-y-8">
				<div>
					<h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
						<PieChart className="h-8 w-8 text-primary" /> Intelligence Financière
					</h1>
					<p className="text-muted-foreground">Suivez vos marges réelles : Chiffre d'Affaires vs Coût des Consommables.</p>
				</div>

                {loading ? (
                    <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
                ) : (
                    <>
                        {/* KPI Cards */}
                        <div className="grid md:grid-cols-3 gap-6">
                            <Card className="glass-card bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-green-500/80 uppercase tracking-wider">Chiffre d'Affaires</p>
                                            <p className="text-3xl font-bold text-green-400">{formatDH(totalCollected)}</p>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                            <TrendingUp className="h-5 w-5 text-green-500" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-4">Montant total encaissé (Gros)</p>
                                </CardContent>
                            </Card>

                            <Card className="glass-card bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-red-500/80 uppercase tracking-wider">Coûts Consommables</p>
                                            <p className="text-3xl font-bold text-red-400">{formatDH(totalCost)}</p>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                            <Package className="h-5 w-5 text-red-500" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-4">Prix d'achat des produits/vials utilisés</p>
                                </CardContent>
                            </Card>

                            <Card className="glass-card border-primary/30 relative overflow-hidden shadow-[0_0_30px_-5px_hsl(var(--primary)/0.2)]">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
                                <CardContent className="p-6 relative z-10">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-primary uppercase tracking-wider">BÉNÉFICE NET (MARGE)</p>
                                            <p className="text-4xl font-black text-foreground">{formatDH(totalProfit)}</p>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                                            <DollarSign className="h-5 w-5 text-primary" />
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center gap-2">
                                        <div className="bg-primary/20 text-primary px-2 py-0.5 rounded text-xs font-bold font-mono">
                                            Formula: CA - Coûts
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid lg:grid-cols-3 gap-6">
                            {/* Performance Analysis */}
                            <Card className="lg:col-span-1 glass-card border-white/5">
                                <CardHeader className="bg-secondary/10 border-b border-white/5 pb-4">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Activity className="h-5 w-5 text-primary" /> Santé du Business
                                    </CardTitle>
                                    <CardDescription>Analyse des Marges par Traitement</CardDescription>
                                </CardHeader>
                                <CardContent className="p-0 divide-y divide-white/5">
                                    {performanceList.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground text-sm">Pas de données.</div>
                                    ) : (
                                        performanceList.map((perf, idx) => (
                                            <div key={idx} className="p-4 flex flex-col gap-3 hover:bg-white/5 transition-colors">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold">{perf.name}</span>
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${perf.marginPercentage >= 60 ? 'bg-green-500/20 text-green-400' : perf.marginPercentage < 30 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                                        {perf.marginPercentage.toFixed(0)}% Marge
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>{perf.count} actes</span>
                                                    <span>Net : <strong className="text-foreground">{formatDH(perf.profit)}</strong></span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>

                            {/* Recent Transactions */}
                            <Card className="lg:col-span-2 glass-card border-white/5">
                                <CardHeader className="bg-secondary/10 border-b border-white/5 pb-4">
                                    <CardTitle className="text-lg">Historique des Opérations (Détail)</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-[600px]">
                                            <thead>
                                                <tr className="border-b border-white/10 text-muted-foreground text-left bg-black/20">
                                                    <th className="p-3 md:p-4 font-medium">Date</th>
                                                    <th className="p-3 md:p-4 font-medium">Patient</th>
                                                    <th className="p-3 md:p-4 font-medium hidden sm:table-cell">Acte</th>
                                                    <th className="p-3 md:p-4 font-medium text-right">CA</th>
                                                    <th className="p-3 md:p-4 font-medium text-right hidden sm:table-cell">Coût</th>
                                                    <th className="p-3 md:p-4 font-medium text-right">Marge</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {treatments.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="p-8 text-center text-muted-foreground">Aucune opération enregistrée.</td>
                                                    </tr>
                                                ) : (
                                                    treatments.map((t) => (
                                                        <tr key={t.id} className="hover:bg-white/5 transition-colors">
                                                            <td className="p-3 md:p-4 whitespace-nowrap text-muted-foreground text-xs md:text-sm">
                                                                {moment(t.date).format('DD MMM')}
                                                            </td>
                                                            <td className="p-3 md:p-4 font-medium truncate max-w-[120px] md:max-w-none">
                                                                {t.patients?.first_name} {t.patients?.last_name}
                                                            </td>
                                                            <td className="p-3 md:p-4 text-primary hidden sm:table-cell">
                                                                {t.treatment_name}
                                                            </td>
                                                            <td className="p-3 md:p-4 text-right text-xs md:text-sm">
                                                                {t.collected_amount} DH
                                                            </td>
                                                            <td className="p-3 md:p-4 text-right text-red-400 hidden sm:table-cell">
                                                                - {t.product_cost} DH
                                                            </td>
                                                            <td className="p-3 md:p-4 text-right font-bold text-green-400 text-xs md:text-sm">
                                                                +{t.net_profit} DH
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}
			</div>
		</AppLayout>
	);
}
