import { useState, useEffect } from 'react';
import { api } from '@shared/api/client';
import type { Priest, Church } from '@shared/api/types';
import { UserPlus, UserCircle, Mail, MapPin, Settings } from 'lucide-react';

export default function PriestsPage() {
    const [priests, setPriests] = useState<Priest[]>([]);
    const [churches, setChurches] = useState<Church[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const [formData, setFormData] = useState({ name: '', email: '', password: '', church_id: '' });

    const fetchData = async () => {
        try {
            const [pr, ch] = await Promise.all([
                api.get<{ priests: Priest[] }>('/admin/priests'),
                api.get<{ churches: Church[] }>('/admin/churches')
            ]);
            setPriests(pr.priests || []);
            setChurches(ch.churches || []);
        } catch (err) { } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/admin/priests', {
                ...formData,
                church_id: formData.church_id ? parseInt(formData.church_id) : undefined
            });
            setShowModal(false);
            setFormData({ name: '', email: '', password: '', church_id: '' });
            fetchData();
        } catch (err) { alert(err); }
    };

    if (loading) return <div>In caricamento...</div>;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Gestione Sacerdoti</h1>
                    <p className="text-surface-400 mt-1">Crea account e assegna chiese ai sacerdoti</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
                    <UserPlus size={20} />
                    Nuovo Sacerdote
                </button>
            </div>

            <div className="bg-surface-900/50 rounded-2xl border border-white/5 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-white/5 text-[10px] uppercase font-bold tracking-widest text-surface-400 border-b border-white/5">
                            <th className="px-6 py-4">Sacerdote</th>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4">Chiese Associate</th>
                            <th className="px-6 py-4 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {priests.map(priest => (
                            <tr key={priest.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center text-primary-400">
                                            <UserCircle size={24} />
                                        </div>
                                        <span className="font-bold">{priest.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-surface-400 text-sm">
                                        <Mail size={14} />
                                        {priest.email}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-2">
                                        {priest.churches?.map(pc => (
                                            <span key={pc.church_id} className="inline-flex items-center gap-1.5 px-2 py-1 bg-surface-800 text-surface-300 rounded-lg text-xs font-medium border border-white/5">
                                                <MapPin size={10} />
                                                {pc.church?.name}
                                            </span>
                                        ))}
                                        {(!priest.churches || priest.churches.length === 0) && (
                                            <span className="text-surface-600 italic text-xs">Nessuna chiesa associata</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="p-2 text-surface-500 hover:text-white transition-colors">
                                        <Settings size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-surface-900 border border-white/10 w-full max-w-md rounded-3xl p-8 shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">Crea Account Sacerdote</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-surface-400">Nome</label>
                                <input className="input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Don Mario" required />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-surface-400">Email</label>
                                <input className="input" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="mario@parrocchia.it" required />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-surface-400">Password</label>
                                <input className="input" type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" required />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-surface-400">Assegna Chiesa Iniziale</label>
                                <select className="input" value={formData.church_id} onChange={e => setFormData({ ...formData, church_id: e.target.value })}>
                                    <option value="">Nessuna</option>
                                    {churches.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1">Annulla</button>
                                <button type="submit" className="btn-primary flex-1">Crea Account</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
