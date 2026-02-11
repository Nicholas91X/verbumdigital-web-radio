import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { api } from '@shared/api/client';
import type { Church, Machine, StreamingCredential } from '@shared/api/types';
import Modal from '@/components/Modal';

export default function ChurchesPage() {
    const [churches, setChurches] = useState<Church[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editChurch, setEditChurch] = useState<Church | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const [cRes, mRes] = await Promise.all([
                api.get<{ churches: Church[] }>('/admin/churches'),
                api.get<{ machines: Machine[] }>('/admin/machines'),
            ]);
            setChurches(cRes.churches || []);
            setMachines(mRes.machines || []);
        } catch {
            //
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Machines not yet assigned to a church
    const availableMachines = machines.filter(
        (m) => !churches.some((c) => c.machine_id === m.id) || m.id === editChurch?.machine_id
    );

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Chiese</h1>
                    <p className="text-surface-400 text-sm mt-0.5">Parrocchie registrate con credenziali streaming</p>
                </div>
                <button onClick={() => setShowCreate(true)} className="btn-primary">
                    + Nuova Chiesa
                </button>
            </div>

            {loading ? (
                <Loading />
            ) : churches.length === 0 ? (
                <EmptyState message="Nessuna chiesa registrata" />
            ) : (
                <div className="space-y-4">
                    {/* Desktop Table */}
                    <div className="hidden lg:block card overflow-hidden p-0">
                        <table className="w-full">
                            <thead className="bg-surface-900/50">
                                <tr>
                                    <th className="table-header">Nome</th>
                                    <th className="table-header">Macchina</th>
                                    <th className="table-header">Stream ID</th>
                                    <th className="table-header text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {churches.map((c) => (
                                    <tr key={c.id}>
                                        <td className="table-cell">
                                            <div className="font-bold text-white">{c.name}</div>
                                            {c.address && <div className="text-xs text-surface-500 font-medium">{c.address}</div>}
                                        </td>
                                        <td className="table-cell font-mono text-surface-400 text-xs">
                                            {c.machine?.machine_id || '—'}
                                        </td>
                                        <td className="table-cell font-mono text-xs text-surface-400">
                                            {c.streaming_credential?.stream_id || '—'}
                                        </td>
                                        <td className="table-cell text-right">
                                            <button
                                                onClick={() => setEditChurch(c)}
                                                className="text-xs font-bold text-primary-500 hover:text-primary-400 uppercase tracking-widest"
                                            >
                                                Modifica
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="lg:hidden space-y-4">
                        {churches.map((c) => (
                            <div key={c.id} className="card p-5 space-y-4 active:scale-100">
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0">
                                        <h3 className="font-extrabold text-white text-lg truncate pr-2">{c.name}</h3>
                                        <p className="text-surface-500 text-[10px] font-bold uppercase tracking-widest mt-1 truncate">
                                            {c.address || 'Nessun indirizzo'}
                                        </p>
                                    </div>
                                    {c.streaming_active ? (
                                        <div className="badge-live">Live</div>
                                    ) : (
                                        <div className="badge-offline">Offline</div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4 py-2 border-y border-white/5">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">Hardware</span>
                                        <p className="text-xs font-mono text-surface-300 truncate">
                                            {c.machine?.machine_id || 'Non assegnato'}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">Stream ID</span>
                                        <p className="text-xs font-mono text-surface-300 truncate">
                                            {c.streaming_credential?.stream_id || 'Mancante'}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setEditChurch(c)}
                                    className="btn-ghost w-full py-3 text-xs font-bold uppercase tracking-widest"
                                >
                                    Modifica Dettagli
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Modal */}
            <CreateChurchModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={() => { setShowCreate(false); fetchData(); }}
                availableMachines={availableMachines}
            />

            {/* Edit Modal */}
            {editChurch && (
                <EditChurchModal
                    open={true}
                    church={editChurch}
                    onClose={() => setEditChurch(null)}
                    onSaved={() => { setEditChurch(null); fetchData(); }}
                    availableMachines={availableMachines}
                />
            )}
        </div>
    );
}

// ============================================
// Create Church Modal
// ============================================

function CreateChurchModal({
    open, onClose, onCreated, availableMachines,
}: {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
    availableMachines: Machine[];
}) {
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [machineId, setMachineId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [created, setCreated] = useState<{ church: Church; streaming_credentials: StreamingCredential } | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const body: Record<string, unknown> = { name };
            if (address) body.address = address;
            if (logoUrl) body.logo_url = logoUrl;
            if (machineId) body.machine_id = parseInt(machineId);

            const data = await api.post<{ church: Church; streaming_credentials: StreamingCredential }>(
                '/admin/churches',
                body
            );
            setCreated(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore creazione');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setName(''); setAddress(''); setLogoUrl(''); setMachineId('');
        setError(''); setCreated(null);
        if (created) onCreated(); else onClose();
    };

    return (
        <Modal open={open} onClose={handleClose} title={created ? 'Chiesa Creata' : 'Nuova Chiesa'}>
            {created ? (
                <div className="space-y-4">
                    <p className="text-surface-300 text-sm">
                        <span className="font-medium">{created.church.name}</span> creata con successo.
                    </p>
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-2">
                        <p className="text-xs text-surface-500 uppercase tracking-wider">Credenziali Streaming (auto-generate)</p>
                        <p className="text-sm">
                            <span className="text-surface-500">Stream ID:</span>{' '}
                            <span className="font-mono font-medium text-emerald-400">{created.streaming_credentials.stream_id}</span>
                        </p>
                        <p className="text-sm">
                            <span className="text-surface-500">Stream Key:</span>{' '}
                            <span className="font-mono text-xs text-surface-300 break-all">{created.streaming_credentials.stream_key}</span>
                        </p>
                    </div>
                    <p className="text-xs text-surface-500">
                        Queste credenziali sono permanenti. L'URL Icecast sarà: <span className="font-mono">
                            vdserv.com:8000/{created.streaming_credentials.stream_id}.mp3</span>
                    </p>
                    <button onClick={handleClose} className="btn-primary w-full">Chiudi</button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <ErrorBanner message={error} />}
                    <div>
                        <label className="block text-sm font-medium text-surface-300 mb-1.5">Nome *</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Parrocchia San Pietro" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-surface-300 mb-1.5">Indirizzo</label>
                        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="input" placeholder="Via Roma 1, Milano" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-surface-300 mb-1.5">Logo URL</label>
                        <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="input" placeholder="https://..." />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-surface-300 mb-1.5">Macchina ST1</label>
                        <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="input">
                            <option value="">Nessuna (assegna dopo)</option>
                            {availableMachines.map((m) => (
                                <option key={m.id} value={m.id}>{m.machine_id}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={handleClose} className="btn-ghost">Annulla</button>
                        <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Creazione...' : 'Crea'}</button>
                    </div>
                </form>
            )}
        </Modal>
    );
}

// ============================================
// Edit Church Modal
// ============================================

function EditChurchModal({
    open, church, onClose, onSaved, availableMachines,
}: {
    open: boolean;
    church: Church;
    onClose: () => void;
    onSaved: () => void;
    availableMachines: Machine[];
}) {
    const [name, setName] = useState(church.name);
    const [address, setAddress] = useState(church.address || '');
    const [logoUrl, setLogoUrl] = useState(church.logo_url || '');
    const [machineId, setMachineId] = useState(church.machine_id?.toString() || '');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const body: Record<string, unknown> = { name, address, logo_url: logoUrl };
            if (machineId) body.machine_id = parseInt(machineId);

            await api.put(`/admin/churches/${church.id}`, body);
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore aggiornamento');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title={`Modifica — ${church.name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <ErrorBanner message={error} />}
                <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Nome *</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Indirizzo</label>
                    <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Logo URL</label>
                    <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="input" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Macchina ST1</label>
                    <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="input">
                        <option value="">Nessuna</option>
                        {availableMachines.map((m) => (
                            <option key={m.id} value={m.id}>{m.machine_id}</option>
                        ))}
                    </select>
                </div>

                {/* Stream credentials (read only) */}
                {church.streaming_credential && (
                    <div className="bg-surface-900/50 rounded-lg p-3 space-y-1">
                        <p className="text-xs text-surface-500 uppercase tracking-wider">Credenziali Streaming</p>
                        <p className="text-xs font-mono text-surface-400">
                            Stream ID: {church.streaming_credential.stream_id}
                        </p>
                        <p className="text-xs font-mono text-surface-400 break-all">
                            Stream Key: {church.streaming_credential.stream_key}
                        </p>
                    </div>
                )}

                <div className="flex gap-3 justify-end">
                    <button type="button" onClick={onClose} className="btn-ghost">Annulla</button>
                    <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvataggio...' : 'Salva'}</button>
                </div>
            </form>
        </Modal>
    );
}

// ============================================
// Shared
// ============================================

function ErrorBanner({ message }: { message: string }) {
    return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
            {message}
        </div>
    );
}

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