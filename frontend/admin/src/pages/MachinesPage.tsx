import { useState, useEffect } from 'react';
import { api } from '@shared/api/client';
import type { Machine } from '@shared/api/types';
import { Cpu, RefreshCw, CheckCircle, Terminal } from 'lucide-react';

export default function MachinesPage() {
    const [machines, setMachines] = useState<Machine[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMachines = async () => {
        try {
            const data = await api.get<{ machines: Machine[] }>('/admin/machines');
            setMachines(data.machines || []);
        } catch (err) { } finally { setLoading(false); }
    };

    if (loading) return <div className="text-surface-400">Caricamento...</div>;

    useEffect(() => { fetchMachines(); }, []);

    const generateCode = async () => {
        try {
            await api.post('/admin/machines', {});
            fetchMachines();
        } catch (err) { alert(err); }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">Dispositivi ST1</h1>
                    <p className="text-surface-400 mt-1">Gestisci i codici di attivazione dell'hardware locale</p>
                </div>
                <button
                    onClick={generateCode}
                    className="btn-primary flex items-center gap-2"
                >
                    <PlusIcon />
                    Genera Nuovo Codice
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {machines.map(m => (
                    <div key={m.id} className="card bg-surface-900 border-white/5 space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-white/5 rounded-xl">
                                <Cpu size={24} className={m.activated ? 'text-emerald-400' : 'text-amber-400'} />
                            </div>
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${m.activated ? 'bg-emerald-500/10 text-emerald-400' : 'bg-surface-800 text-surface-500'}`}>
                                {m.activated ? 'Attivo' : 'In attesa'}
                            </span>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-1">Activation Code</p>
                            <div className="flex items-center gap-2">
                                <code className="text-2xl font-mono font-bold text-white tracking-widest">{m.machine_id}</code>
                                <button className="p-2 text-surface-500 hover:text-white transition-colors">
                                    <RefreshCw size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs">
                                {m.activated ? (
                                    <>
                                        <CheckCircle size={12} className="text-emerald-400" />
                                        <span className="text-surface-400">Attivato {new Date(m.activated_at!).toLocaleDateString()}</span>
                                    </>
                                ) : (
                                    <>
                                        <Terminal size={12} className="text-surface-600" />
                                        <span className="text-surface-500 italic">Mai collegato</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PlusIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    );
}
