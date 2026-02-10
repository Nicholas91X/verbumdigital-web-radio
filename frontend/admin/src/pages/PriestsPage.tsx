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
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Sacerdoti</h1>
                    <p className="text-surface-400 text-sm mt-0.5">Gestione account sacerdoti e assegnazioni</p>
                </div>
                <button onClick={() => setShowCreate(true)} className="btn-primary">
                    + Nuovo Sacerdote
                </button>
            </div>

            {loading ? (
                <Loading />
            ) : priests.length === 0 ? (
                <EmptyState message="Nessun sacerdote registrato" />
            ) : (
                <div className="card overflow-hidden p-0">
                    <table className="w-full">
                        <thead className="bg-surface-900/50">
                            <tr>
                                <th className="table-header">Nome</th>
                                <th className="table-header">Email</th>
                                <th className="table-header">Chiese assegnate</th>
                                <th className="table-header">Registrato</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-700">
                            {priests.map((p) => (
                                <tr key={p.id}>
                                    <td className="table-cell font-medium">{p.name}</td>
                                    <td className="table-cell text-surface-400">{p.email}</td>
                                    <td className="table-cell">
                                        {p.churches && p.churches.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {p.churches.map((pc) => (
                                                    <span key={pc.church_id} className="badge bg-primary-500/15 text-primary-400">
                                                        {pc.church?.name ?? `Chiesa #${pc.church_id}`}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-surface-500">Nessuna</span>
                                        )}
                                    </td>
                                    <td className="table-cell text-surface-500 text-xs">
                                        {new Date(p.created_at).toLocaleDateString('it-IT')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

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