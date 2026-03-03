import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { api } from '@shared/api/client';
import type { Priest, Church } from '@shared/api/types';
import Modal from '@/components/Modal';

export default function PriestsPage() {
    const [priests, setPriests] = useState<Priest[]>([]);
    const [churches, setChurches] = useState<Church[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [pRes, cRes] = await Promise.all([
                api.get<{ priests: Priest[] }>('/admin/priests'),
                api.get<{ churches: Church[] }>('/admin/churches'),
            ]);
            setPriests(pRes.priests || []);
            setChurches(cRes.churches || []);
        } catch {
            //
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="p-4 sm:p-6 space-y-6 pb-24">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Sacerdoti</h1>
                    <p className="text-surface-400 text-sm mt-0.5">Gestione account sacerdoti e assegnazioni</p>
                </div>
            </div>

            {loading ? (
                <Loading />
            ) : priests.length === 0 ? (
                <EmptyState message="Nessun sacerdote registrato" />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {priests.map((p) => (
                        <div key={p.id} className="card-glass flex flex-col justify-between p-5 relative overflow-hidden group">
                            <div>
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div>
                                        <h3 className="font-bold text-lg text-white leading-tight flex items-center gap-2">
                                            {p.name}
                                        </h3>
                                        <p className="text-xs text-surface-400 mt-1">{p.email}</p>
                                    </div>
                                    <span className="text-xs text-surface-500 font-mono">
                                        {new Date(p.created_at).toLocaleDateString('it-IT')}
                                    </span>
                                </div>

                                <div className="space-y-2 text-sm relative z-10 border-t border-surface-700/50 pt-3 mt-3">
                                    <p className="text-xs text-surface-500 mb-2 uppercase tracking-wider font-semibold">
                                        Chiese assegnate
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {p.churches && p.churches.length > 0 ? (
                                            p.churches.map((pc) => (
                                                <span key={pc.church_id} className="text-xs bg-primary-500/15 text-primary-400 px-2 py-0.5 rounded-md border border-primary-500/20 shadow-sm">
                                                    {pc.church?.name ?? `Chiesa #${pc.church_id}`}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-surface-500 italic">Nessuna assegnazione</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Floating Action Button for Mobile */}
            <button
                onClick={() => setShowCreate(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(99,102,241,0.5)] hover:scale-105 active:scale-95 transition-all z-40 border border-primary-400/30"
                aria-label="Nuovo Sacerdote"
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
            </button>

            <CreatePriestModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={() => { setShowCreate(false); fetchData(); }}
                churches={churches}
            />
        </div>
    );
}

// ============================================
// Create Priest Modal
// ============================================

function CreatePriestModal({
    open, onClose, onCreated, churches,
}: {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
    churches: Church[];
}) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedChurches, setSelectedChurches] = useState<number[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const toggleChurch = (id: number) => {
        setSelectedChurches((prev) =>
            prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
        );
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('/admin/priests', {
                name,
                email,
                password,
                church_ids: selectedChurches,
            });
            // Reset
            setName(''); setEmail(''); setPassword(''); setSelectedChurches([]);
            onCreated();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore creazione');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setName(''); setEmail(''); setPassword(''); setSelectedChurches([]);
        setError('');
        onClose();
    };

    return (
        <Modal open={open} onClose={handleClose} title="Nuovo Sacerdote">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                        {error}
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Nome *</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Don Mario" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Email *</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="don.mario@email.com" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Password *</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Almeno 6 caratteri" required minLength={6} />
                </div>

                {/* Church selection */}
                {churches.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-surface-300 mb-2">Assegna a chiese</label>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {churches.map((c) => (
                                <label key={c.id} className="flex items-center gap-2.5 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={selectedChurches.includes(c.id)}
                                        onChange={() => toggleChurch(c.id)}
                                        className="w-4 h-4 rounded border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
                                    />
                                    <span className="text-sm text-surface-300 group-hover:text-white transition-colors">
                                        {c.name}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-3 justify-end">
                    <button type="button" onClick={handleClose} className="btn-ghost">Annulla</button>
                    <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Creazione...' : 'Crea'}</button>
                </div>
            </form>
        </Modal>
    );
}

// ============================================
// Shared
// ============================================

function Loading() {
    return (
        <div className="flex justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return <div className="card text-surface-400 text-center py-12">{message}</div>;
}