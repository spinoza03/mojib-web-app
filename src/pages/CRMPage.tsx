import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, Search, Plus, Calendar, FileText, ChevronRight, Activity, TrendingUp, Upload, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import moment from 'moment';
import 'moment/locale/fr';

moment.locale('fr');
import { OnboardingPopup, ONBOARDING_CONFIGS } from '@/components/OnboardingPopup';

export default function CRMPage() {
	const { user } = useAuth();
	const { toast } = useToast();
	const [patients, setPatients] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState('');
	
	// Patient Modal State
	const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
	const [newPatient, setNewPatient] = useState({ first_name: '', last_name: '', phone: '', email: '' });
	const [savingPatient, setSavingPatient] = useState(false);

	// Life File "Dossier Patient" State
	const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
	const [treatments, setTreatments] = useState<any[]>([]);
	const [loadingTreatments, setLoadingTreatments] = useState(false);
	
	// Add Treatment State
	const [isAddTreatmentOpen, setIsAddTreatmentOpen] = useState(false);
	const [newTreatment, setNewTreatment] = useState({ treatment_name: '', quantity: '', collected_amount: '', product_cost: '', notes: '' });
	const [savingTreatment, setSavingTreatment] = useState(false);

	// Files State
	const [patientFiles, setPatientFiles] = useState<any[]>([]);
	const [loadingFiles, setLoadingFiles] = useState(false);
	const [uploadingFile, setUploadingFile] = useState(false);
	const [activeTab, setActiveTab] = useState('history');

	useEffect(() => {
		if (user) fetchPatients();
	}, [user]);

	const fetchPatients = async () => {
		try {
			const { data, error } = await supabase
				.from('patients')
				.select('*')
				.eq('user_id', user?.id)
				.order('created_at', { ascending: false });

			if (error) throw error;
			setPatients(data || []);
		} catch (error: any) {
			toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de charger les patients.' });
		} finally {
			setLoading(false);
		}
	};

	const fetchTreatments = async (patientId: string) => {
		setLoadingTreatments(true);
		try {
			const { data, error } = await supabase
				.from('treatments')
				.select('*')
				.eq('patient_id', patientId)
				.order('date', { ascending: false });

			if (error) throw error;
			setTreatments(data || []);
		} catch (error: any) {
			toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de charger l\'historique.' });
		} finally {
			setLoadingTreatments(false);
		}
	};

	const fetchPatientFiles = async (patientId: string) => {
		setLoadingFiles(true);
		try {
			const { data, error } = await supabase
				.from('patient_files')
				.select('*')
				.eq('patient_id', patientId)
				.order('created_at', { ascending: false });

			if (error) throw error;
			setPatientFiles(data || []);
		} catch (error: any) {
			toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de charger les fichiers.' });
		} finally {
			setLoadingFiles(false);
		}
	};

	const handleAddPatient = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newPatient.first_name || !newPatient.last_name) {
			toast({ variant: 'destructive', description: 'Le nom et prénom sont obligatoires.' });
			return;
		}
		setSavingPatient(true);
		try {
			const { data, error } = await supabase
				.from('patients')
				.insert({ user_id: user?.id, ...newPatient })
				.select()
				.single();
			if (error) throw error;

			setPatients([data, ...patients]);
			setIsAddPatientOpen(false);
			setNewPatient({ first_name: '', last_name: '', phone: '', email: '' });
			toast({ title: 'Succès', description: 'Patient ajouté au CRM.' });
		} catch (error: any) {
			toast({ variant: 'destructive', title: 'Erreur', description: error.message });
		} finally {
			setSavingPatient(false);
		}
	};

	const handleAddTreatment = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedPatient || !newTreatment.treatment_name) return;
		setSavingTreatment(true);
		try {
			const { data, error } = await supabase
				.from('treatments')
				.insert({
					user_id: user?.id,
					patient_id: selectedPatient.id,
					treatment_name: newTreatment.treatment_name,
					quantity: newTreatment.quantity,
					collected_amount: parseFloat(newTreatment.collected_amount || '0'),
					product_cost: parseFloat(newTreatment.product_cost || '0'),
					notes: newTreatment.notes
				})
				.select()
				.single();
			
			if (error) throw error;

			setTreatments([data, ...treatments]);
			setIsAddTreatmentOpen(false);
			setNewTreatment({ treatment_name: '', quantity: '', collected_amount: '', product_cost: '', notes: '' });
			toast({ title: 'Séance ajoutée', description: 'Historique mis à jour.' });
		} catch (error: any) {
			toast({ variant: 'destructive', title: 'Erreur', description: error.message });
		} finally {
			setSavingTreatment(false);
		}
	};

	const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploadingFile(true);
            if (!user || !selectedPatient || !event.target.files || event.target.files.length === 0) return;

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${selectedPatient.id}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage.from('patient-files').upload(fileName, file, { upsert: true });
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('patient-files').getPublicUrl(fileName);
            
            const { data, error } = await supabase.from('patient_files').insert({
                patient_id: selectedPatient.id,
                user_id: user.id,
                file_name: file.name,
                file_url: publicUrl,
                file_type: file.type || fileExt
            }).select().single();

            if (error) throw error;
            setPatientFiles([data, ...patientFiles]);
            toast({ title: 'Succès', description: 'Fichier ajouté au dossier.' });

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
        } finally {
            setUploadingFile(false);
        }
    };

	const openLifeFile = (patient: any) => {
		setSelectedPatient(patient);
		fetchTreatments(patient.id);
		fetchPatientFiles(patient.id);
		setActiveTab('history');
	};

	const filteredPatients = patients.filter(p => 
		`${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
		(p.phone && p.phone.includes(searchTerm))
	);

	return (
		<AppLayout>
			<OnboardingPopup pageKey="crm" steps={ONBOARDING_CONFIGS.crm} />
			<div className="max-w-6xl mx-auto space-y-6">
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
					<div>
						<h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
							<Users className="h-8 w-8 text-primary" /> Gestion des Patients
						</h1>
						<p className="text-muted-foreground">Le CRM "Life File" pour suivre l'historique de soins et la fidélité.</p>
					</div>
					<Dialog open={isAddPatientOpen} onOpenChange={setIsAddPatientOpen}>
						<DialogTrigger asChild>
							<Button className="shrink-0"><Plus className="mr-2 h-4 w-4" /> Nouveau Patient</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Ajouter un Patient</DialogTitle>
							</DialogHeader>
							<form onSubmit={handleAddPatient} className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label>Prénom *</Label>
										<Input value={newPatient.first_name} onChange={e => setNewPatient({...newPatient, first_name: e.target.value})} required />
									</div>
									<div className="space-y-2">
										<Label>Nom *</Label>
										<Input value={newPatient.last_name} onChange={e => setNewPatient({...newPatient, last_name: e.target.value})} required />
									</div>
								</div>
								<div className="space-y-2">
									<Label>Téléphone</Label>
									<Input value={newPatient.phone} onChange={e => setNewPatient({...newPatient, phone: e.target.value})} placeholder="+212..." />
								</div>
								<div className="space-y-2">
									<Label>Email</Label>
									<Input type="email" value={newPatient.email} onChange={e => setNewPatient({...newPatient, email: e.target.value})} />
								</div>
								<Button type="submit" className="w-full" disabled={savingPatient}>
									{savingPatient ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Créer le Dossier'}
								</Button>
							</form>
						</DialogContent>
					</Dialog>
				</div>

				<div className="grid lg:grid-cols-3 gap-6">

					{/* Patients List (Left Column) */}
					<Card className="lg:col-span-1 glass-card h-[60vh] lg:h-[calc(100vh-200px)] flex flex-col">
						<CardHeader className="pb-3 border-b border-white/5 space-y-4">
							<div className="relative">
								<Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
								<Input 
									placeholder="Rechercher par nom..." 
									className="pl-9 bg-secondary/30"
									value={searchTerm}
									onChange={e => setSearchTerm(e.target.value)}
								/>
							</div>
						</CardHeader>
						<CardContent className="p-0 overflow-y-auto flex-1">
							{loading ? (
								<div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
							) : filteredPatients.length === 0 ? (
								<div className="p-8 text-center text-muted-foreground text-sm">Aucun patient trouvé.</div>
							) : (
								<div className="divide-y divide-white/5">
									{filteredPatients.map(patient => (
										<button
											key={patient.id}
											onClick={() => openLifeFile(patient)}
											className={`w-full text-left p-4 hover:bg-secondary/20 transition-colors flex items-center justify-between group ${selectedPatient?.id === patient.id ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
										>
											<div>
												<p className="font-semibold text-foreground">{patient.first_name} {patient.last_name}</p>
												{patient.phone && <p className="text-xs text-muted-foreground mt-1">{patient.phone}</p>}
											</div>
											<ChevronRight className={`h-4 w-4 text-muted-foreground group-hover:text-primary transition-transform ${selectedPatient?.id === patient.id ? 'translate-x-1 text-primary' : ''}`} />
										</button>
									))}
								</div>
							)}
						</CardContent>
					</Card>

					{/* Life File / Dossier (Right Columns) */}
					<Card className="lg:col-span-2 glass-card h-[60vh] lg:h-[calc(100vh-200px)] flex flex-col">
						{selectedPatient ? (
							<>
								<CardHeader className="pb-0 border-b border-white/5 bg-secondary/10">
									<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
										<div className="flex justify-between items-start mb-6">
											<div>
												<CardTitle className="text-lg md:text-2xl flex flex-wrap items-center gap-2">
													Dossier : {selectedPatient.first_name} {selectedPatient.last_name}
													{treatments.length > 3 && <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">Client Fidèle</Badge>}
												</CardTitle>
												<div className="flex flex-wrap gap-2 md:gap-4 mt-2 text-xs md:text-sm text-muted-foreground">
													{selectedPatient.phone && <span>📞 {selectedPatient.phone}</span>}
													{selectedPatient.email && <span>✉️ {selectedPatient.email}</span>}
													<span>📅 Créé {moment(selectedPatient.created_at).fromNow()}</span>
												</div>
											</div>
											
											{/* Dynamic Right Button based on Tab */}
											{activeTab === 'history' && (
												<Dialog open={isAddTreatmentOpen} onOpenChange={setIsAddTreatmentOpen}>
													<DialogTrigger asChild>
														<Button size="sm"><Plus className="mr-2 h-4 w-4" /> Ajouter Soin</Button>
													</DialogTrigger>
													<DialogContent>
														<DialogHeader>
															<DialogTitle>Nouvelle Séance / Traitement</DialogTitle>
														</DialogHeader>
														<form onSubmit={handleAddTreatment} className="space-y-4">
															{/* Treatment Form Content */}
															<div className="space-y-2">
																<Label>Soin (ex: Botox, Juvederm...)</Label>
																<Input value={newTreatment.treatment_name} onChange={e => setNewTreatment({...newTreatment, treatment_name: e.target.value})} required />
															</div>
															<div className="space-y-2">
																<Label>Quantité Injectée / Détails</Label>
																<Input value={newTreatment.quantity} onChange={e => setNewTreatment({...newTreatment, quantity: e.target.value})} placeholder="ex: 1 Seringue" />
															</div>
															<div className="grid grid-cols-2 gap-4">
																<div className="space-y-2">
																	<Label>Montant Encaissé (DH)</Label>
																	<Input type="number" value={newTreatment.collected_amount} onChange={e => setNewTreatment({...newTreatment, collected_amount: e.target.value})} required />
																</div>
																<div className="space-y-2">
																	<Label>Coût Consommable (DH)</Label>
																	<Input type="number" value={newTreatment.product_cost} onChange={e => setNewTreatment({...newTreatment, product_cost: e.target.value})} required />
																</div>
															</div>
															<div className="space-y-2">
																<Label>Notes Cliniques / Consignes Sécurité</Label>
																<Input value={newTreatment.notes} onChange={e => setNewTreatment({...newTreatment, notes: e.target.value})} placeholder="ex: Revenir dans 6 mois..." />
															</div>
															<Button type="submit" className="w-full" disabled={savingTreatment}>
																{savingTreatment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Enregistrer le Soin'}
															</Button>
														</form>
													</DialogContent>
												</Dialog>
											)}
											{activeTab === 'files' && (
												<div>
													<Label htmlFor="patient-file-upload" className="cursor-pointer inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-primary text-primary-foreground shadow text-sm font-medium transition-colors hover:bg-primary/90">
														{uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
														{uploadingFile ? 'Envoi...' : 'Nouveau Fichier'}
													</Label>
													<Input id="patient-file-upload" type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
												</div>
											)}
										</div>
										<TabsList className="bg-transparent border-none">
											<TabsTrigger value="history" className="data-[state=active]:bg-secondary/40 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">
												Historique (Soins)
											</TabsTrigger>
											<TabsTrigger value="files" className="data-[state=active]:bg-secondary/40 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none bg-transparent">
												Fichiers & Scanners <Badge className="ml-2 bg-secondary/50">{patientFiles.length}</Badge>
											</TabsTrigger>
										</TabsList>
									</Tabs>
								</CardHeader>
								<CardContent className="p-0 overflow-y-auto flex-1 bg-black/20">
									<Tabs value={activeTab} className="h-full">
										{/* History Tab */}
										<TabsContent value="history" className="h-full m-0">
											{loadingTreatments ? (
												<div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
											) : treatments.length === 0 ? (
												<div className="p-12 text-center flex flex-col items-center">
													<FileText className="h-16 w-16 text-white/5 mb-4" />
													<h3 className="text-lg font-medium text-white/40">Dossier Vierge</h3>
													<p className="text-sm text-white/30 mt-1">Ce patient n'a pas encore de soins enregistrés.</p>
												</div>
											) : (
												<div className="p-6 space-y-6">
													<div className="relative border-l-2 border-primary/20 ml-3 space-y-8">
														{treatments.map((treatment, idx) => (
															<div key={treatment.id} className="relative pl-6">
																{/* Timeline Dot */}
																<div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-background border-2 border-primary"></div>
																
																<div className="bg-secondary/30 p-5 rounded-xl border border-white/5 hover:border-primary/20 transition-colors">
																	<div className="flex justify-between items-start mb-2">
																		<div>
																			<h4 className="font-bold text-lg text-foreground flex items-center gap-2">
																				{treatment.treatment_name}
																				{idx === 0 && <Badge className="bg-blue-500/20 text-blue-400 py-0 border-none">Dernier Soin</Badge>}
																			</h4>
																			<p className="text-xs font-medium text-primary/80 uppercase tracking-widest mt-1">
																				{moment(treatment.date).format('LL')} • {moment(treatment.date).fromNow()}
																			</p>
																		</div>
																	</div>
																	
																	<div className="grid grid-cols-2 gap-4 mt-4">
																		{treatment.quantity && (
																			<div className="bg-black/20 p-2 rounded text-sm">
																				<span className="text-muted-foreground block text-xs">Quantité</span>
																				<span className="font-medium text-white">{treatment.quantity}</span>
																			</div>
																		)}
																		{treatment.notes && (
																			<div className="bg-amber-500/5 p-2 rounded text-sm lg:col-span-2 border border-amber-500/10">
																				<span className="text-amber-500/70 block text-xs font-medium flex items-center gap-1"><Activity className="h-3 w-3"/> Sécurité & Notes</span>
																				<span className="text-foreground">{treatment.notes}</span>
																			</div>
																		)}
																	</div>
																</div>
															</div>
														))}
													</div>
												</div>
											)}
										</TabsContent>

										{/* Files Tab */}
										<TabsContent value="files" className="h-full m-0">
											{loadingFiles ? (
												<div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
											) : patientFiles.length === 0 ? (
												<div className="p-12 text-center flex flex-col items-center">
													<ImageIcon className="h-16 w-16 text-white/5 mb-4" />
													<h3 className="text-lg font-medium text-white/40">Aucun Fichier</h3>
													<p className="text-sm text-white/30 mt-1">Téléchargez des photos avant/après, des scans ou des ordonnances.</p>
												</div>
											) : (
												<div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
													{patientFiles.map((file) => {
														const isImage = file.file_type?.startsWith('image/') || file.file_url.match(/\.(jpeg|jpg|gif|png|webp)$/i);
														return (
															<a 
																key={file.id} 
																href={file.file_url} 
																target="_blank" 
																rel="noopener noreferrer"
																className="group relative bg-secondary/30 rounded-xl border border-white/5 overflow-hidden hover:border-primary/50 transition-colors aspect-square flex flex-col"
															>
																{isImage ? (
																	<div className="flex-1 overflow-hidden bg-black/40">
																		<img src={file.file_url} alt={file.file_name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
																	</div>
																) : (
																	<div className="flex-1 flex items-center justify-center bg-black/40">
																		<FileIcon className="h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
																	</div>
																)}
																<div className="p-3 bg-secondary/80 backdrop-blur-md shrink-0">
																	<p className="text-xs font-medium text-foreground truncate" title={file.file_name}>{file.file_name}</p>
																	<p className="text-[10px] text-muted-foreground mt-0.5">{moment(file.created_at).format('ll')}</p>
																</div>
															</a>
														);
													})}
												</div>
											)}
										</TabsContent>
									</Tabs>
								</CardContent>
							</>
						) : (
							<div className="flex-1 flex items-center justify-center text-center p-8">
								<div className="space-y-4 max-w-sm">
									<div className="h-24 w-24 bg-secondary/30 rounded-full flex items-center justify-center mx-auto ring-8 ring-secondary/10">
										<TrendingUp className="h-10 w-10 text-primary/50" />
									</div>
									<h2 className="text-2xl font-bold">Le "Life File"</h2>
									<p className="text-muted-foreground text-sm leading-relaxed">
										Sélectionnez un patient à gauche pour voir son historique de traitements, les produits injectés et garantir une sécurité maximale.
									</p>
								</div>
							</div>
						)}
					</Card>
				</div>
			</div>
		</AppLayout>
	);
}
