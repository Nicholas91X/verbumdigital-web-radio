import { useState, useEffect } from 'react';
import { api } from '@shared/api/client';
import type { Church, Machine } from '@shared/api/types';
import { Plus, Edit2, Key as KeyIcon, Check, MapPin } from 'lucide-react';

export default function ChurchesPage() {
    const [churches, setChurches] = useState<Church[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);

    const [formData, setFormData] = useState({ name: '', address: '', logo_url: '', machine_id: '' });

    const fetchAll = async () => {
        try {
            const [ch, mc] = await Promise.all([
                api.get<{ churches: Church[] }>('/admin/churches'),
                api.get<{ machines: Machine[] }>('/admin/machines')
            ]);
            setChurches(ch.churches || []);
            setMachines(mc.machines?.filter(m => m.activated) || []);
        } catch (err) { } finally { setLoading(false); }
    };

    useEffect(() => { fetchAll(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Convert machine_id to number or null
            const payload = {
                ...formData,
                machine_id: formData.machine_id ? parseInt(formData.machine_id) : undefined
            };
            await api.post('/admin/churches', payload);
            setShowModal(false);
            setFormData({ name: '', address: '', logo_url: '', machine_id: '' });
            fetchAll();
        } catch (err) { alert(err); }
    };

    if (loading) return <div>In caricamento...</div>;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Gestione Chiese</h1>
                    <p className="text-surface-400 mt-1">Configura le parrocchie e le loro credenziali di streaming</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus size={20} />
                    Nuova Chiesa
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {churches.map(church => (
                    <div key={church.id} className="card group relative">
                        <div className="flex gap-4">
                            <div className="w-20 h-20 bg-surface-800 rounded-2xl overflow-hidden flex-shrink-0 border border-white/5">
                                {church.logo_url && <img src={church.logo_url} className="w-full h-full object-cover" />}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-lg truncate">{church.name}</h3>
                                    <button className="text-surface-600 hover:text-white transition-colors">
                                        <Edit2 size={16} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-surface-400">
                                    <MapPin size={12} />
                                    <span className="truncate">{church.address}</span>
                                </div>
                                <div className="pt-2 flex flex-wrap gap-2">
                                    {church.machine ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md text-[10px] font-bold border border-emerald-500/20">
                                            <Check size={10} />
                                            ST1: {church.machine.machine_id}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-md text-[10px] font-bold border border-amber-500/20">
                                            Hardware mancante
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Credentials Reveal (Simulated for admin) */}
                        {church.streaming_credential && (
                            <div className="mt-4 pt-4 border-t border-white/5 bg-white/5 -mx-5 -mb-5 p-5 rounded-b-2xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-surface-500 uppercase flex items-center gap-1">
                                        <KeyIcon size={10} /> Streaming Credentials
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    <CredentialRow label="ID Stream" value={church.streaming_credential.stream_id} />
                                    <CredentialRow label="Mount Point" value={`/${church.streaming_credential.stream_id}.mp3`} />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-surface-900 border border-white/10 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95">
                        <h2 className="text-2xl font-bold mb-6">Aggiungi Parrocchia</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-surface-400">Nome</label>
                                <input className="input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Es. San Giovanni" required />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-surface-400">Indirizzo</label>
                                <input className="input" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Via Roma 1, Milano" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-surface-400">Logo URL</label>
                                <input className="input" value={formData.logo_url} onChange={e => setFormData({ ...formData, logo_url: e.target.value })} placeholder="https://..." />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-surface-400">Hardware ST1 (Opzionale)</label>
                                <select className="input" value={formData.machine_id} onChange={e => setFormData({ ...formData, machine_id: e.target.value })}>
                                    <option value="">Nessuno</option>
                                    {machines.map(m => (
                                        <option key={m.id} value={m.id}>{m.machine_id}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Annulla</button>
                                <button type="submit" className="btn-primary flex-1">Salva Chiesa</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function CredentialRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-surface-500">{label}</span>
            <code className="bg-black/20 px-1.5 py-0.5 rounded font-mono text-primary-400">{value}</code>
        </div>
    );
}
