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
        <div className="p-4 sm:p-6 space-y-6 pb-24">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Chiese</h1>
                    <p className="text-surface-400 text-sm mt-0.5">Parrocchie registrate con credenziali streaming</p>
                </div>
            </div>

            {/* List of Churches as Mobile-first Cards */}
            {loading ? (
                <Loading />
            ) : churches.length === 0 ? (
                <EmptyState message="Nessuna chiesa registrata" />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {churches.map((c) => (
                        <div key={c.id} className="card-glass flex flex-col justify-between p-5 relative overflow-hidden group">
                           {/* Live Ambient Glow */}
                           {c.streaming_active && (
                               <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 blur-2xl rounded-full" />
                           )}
                           
                           <div>
                               <div className="flex justify-between items-start mb-4 relative z-10">
                                   <div>
                                       <h3 className="font-bold text-lg text-white leading-tight">{c.name}</h3>
                                       {c.address && <p className="text-xs text-surface-400 mt-1 flex items-center gap-1">
                                           <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                           </svg>
                                           {c.address}
                                       </p>}
                                   </div>
                                   {c.streaming_active ? (
                                       <span className="badge-live text-[10px] px-2 py-0.5">
                                           <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1 animate-pulse" /> LIVE
                                       </span>
                                   ) : (
                                       <span className="badge-offline text-[10px] px-2 py-0.5">Offline</span>
                                   )}
                               </div>

                               <div className="space-y-2 text-sm relative z-10">
                                   <div className="flex items-center justify-between py-1 border-b border-surface-700/50">
                                       <span className="text-surface-400">ST1 Macchina</span>
                                       <span className="font-mono text-emerald-400 font-medium text-xs bg-emerald-500/10 px-2 py-0.5 rounded">
                                           {c.machine?.machine_id || 'Nessuna'}
                                       </span>
                                   </div>
                                    <div className="flex items-center justify-between py-1 border-b border-surface-700/50">
                                       <span className="text-surface-400">Stream ID</span>
                                       <span className="font-mono text-slate-300 font-medium text-xs">
                                           {c.streaming_credential?.stream_id || 'N/A'}
                                       </span>
                                   </div>
                                   <div className="flex flex-col py-1 border-b border-surface-700/50">
                                        <span className="text-surface-400 mb-1">Sacerdoti Assegnati</span>
                                        <div className="flex flex-wrap gap-1">
                                            {c.priests && c.priests.length > 0 ? (
                                                c.priests.map((p) => (
                                                    <span key={p.id} className="text-xs bg-surface-700 text-surface-200 px-2 py-0.5 rounded-full border border-surface-600">
                                                        {p.name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-surface-500 italic">Nessuno</span>
                                            )}
                                        </div>
                                   </div>
                               </div>
                           </div>

                           <div className="mt-4 pt-3 flex justify-end relative z-10">
                               <button
                                   onClick={() => setEditChurch(c)}
                                   className="btn-outline text-xs px-4 py-2 hover:bg-white/10"
                               >
                                   <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                   Modifica Parametri
                               </button>
                           </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Floating Action Button for Mobile */}
            <button
                onClick={() => setShowCreate(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(99,102,241,0.5)] hover:scale-105 active:scale-95 transition-all z-40 border border-primary-400/30"
                aria-label="Nuova Chiesa"
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
            </button>

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