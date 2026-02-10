import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { api } from '@shared/api/client';
import type { Machine } from '@shared/api/types';
import Modal from '@/components/Modal';

export default function MachinesPage() {
    const [machines, setMachines] = useState<Machine[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    const fetchMachines = useCallback(async () => {
        try {
            const data = await api.get<{ machines: Machine[] }>('/admin/machines');
            setMachines(data.machines || []);
        } catch {
            // handled by empty state
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMachines();
    }, [fetchMachines]);

    const toggleActivation = async (machine: Machine) => {
        const endpoint = machine.activated
            ? `/admin/machines/${machine.id}/deactivate`
            : `/admin/machines/${machine.id}/activate`;
        try {
            await api.put(endpoint);
            fetchMachines();
        } catch {
            // could show toast
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Macchine</h1>
                    <p className="text-surface-400 text-sm mt-0.5">Schede ST1 registrate nel sistema</p>
                </div>
                <button onClick={() => setShowCreate(true)} className="btn-primary">
                    + Nuova Macchina
                </button>
            </div>

            {/* Table */}
            {loading ? (
                <Loading />
            ) : machines.length === 0 ? (
                <EmptyState message="Nessuna macchina registrata" />
            ) : (
                <div className="card overflow-hidden p-0">
                    <table className="w-full">
                        <thead className="bg-surface-900/50">
                            <tr>
                                <th className="table-header">ID Macchina</th>
                                <th className="table-header">Codice Attivazione</th>
                                <th className="table-header">Chiesa</th>
                                <th className="table-header">Stato</th>
                                <th className="table-header text-right">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-700">
                            {machines.map((m) => (
                                <tr key={m.id}>
                                    <td className="table-cell font-mono font-medium">{m.machine_id}</td>
                                    <td className="table-cell font-mono text-surface-400">{m.activation_code || '—'}</td>
                                    <td className="table-cell text-surface-400">{m.church?.name || '—'}</td>
                                    <td className="table-cell">
                                        {m.activated ? (
                                            <span className="badge-success">Attiva</span>
                                        ) : (
                                            <span className="badge-warning">Inattiva</span>
                                        )}
                                    </td>
                                    <td className="table-cell text-right">
                                        <button
                                            onClick={() => toggleActivation(m)}
                                            className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${m.activated
                                                    ? 'text-red-400 hover:bg-red-500/10'
                                                    : 'text-emerald-400 hover:bg-emerald-500/10'
                                                }`}
                                        >
                                            {m.activated ? 'Disattiva' : 'Attiva'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Modal */}
            <CreateMachineModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={() => {
                    setShowCreate(false);
                    fetchMachines();
                }}
            />
        </div>
    );
}

// ============================================
// Create Machine Modal
// ============================================

function CreateMachineModal({
    open,
    onClose,
    onCreated,
}: {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
}) {
    const [machineId, setMachineId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [created, setCreated] = useState<Machine | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await api.post<{ machine: Machine }>('/admin/machines', {
                machine_id: machineId,
            });
            setCreated(data.machine);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore creazione');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setMachineId('');
        setError('');
        setCreated(null);
        if (created) onCreated();
        else onClose();
    };

    return (
        <Modal open={open} onClose={handleClose} title={created ? 'Macchina Creata' : 'Nuova Macchina'}>
            {created ? (
                <div className="space-y-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-2">
                        <p className="text-sm text-surface-300">
                            <span className="text-surface-500">Machine ID:</span>{' '}
                            <span className="font-mono font-medium">{created.machine_id}</span>
                        </p>
                        <p className="text-sm text-surface-300">
                            <span className="text-surface-500">Codice Attivazione:</span>{' '}
                            <span className="font-mono font-bold text-emerald-400">{created.activation_code}</span>
                        </p>
                    </div>
                    <p className="text-xs text-surface-500">Comunica il codice di attivazione a Svilen per la configurazione del device.</p>
                    <button onClick={handleClose} className="btn-primary w-full">
                        Chiudi
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-surface-300 mb-1.5">
                            Machine ID
                        </label>
                        <input
                            type="text"
                            value={machineId}
                            onChange={(e) => setMachineId(e.target.value)}
                            className="input"
                            placeholder="SMIX-12345"
                            required
                        />
                        <p className="text-xs text-surface-500 mt-1">Identificativo univoco della scheda ST1</p>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={handleClose} className="btn-ghost">
                            Annulla
                        </button>
                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? 'Creazione...' : 'Crea'}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}

// ============================================
// Shared helpers
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