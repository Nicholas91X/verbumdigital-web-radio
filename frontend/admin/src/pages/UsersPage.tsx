import { useState, useEffect, useCallback } from 'react';
import { api } from '@shared/api/client';
import type { UserWithMetrics } from '@shared/api/types';
import Modal from '@/components/Modal';

export default function UsersPage() {
    const [users, setUsers] = useState<UserWithMetrics[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<UserWithMetrics | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [search, setSearch] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const data = await api.get<{ users: UserWithMetrics[] }>('/admin/users');
            setUsers(data.users || []);
        } catch {
            //
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/users/${deleteTarget.id}`);
            setDeleteTarget(null);
            fetchData();
        } catch {
            //
        } finally {
            setDeleting(false);
        }
    };

    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    const formatCents = (cents: number) => {
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 pb-24">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Utenti</h1>
                    <p className="text-surface-400 text-sm mt-0.5">
                        Gestione utenti e metriche di ascolto
                    </p>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Cerca utente..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input pl-10 w-64"
                    />
                    <svg className="w-4 h-4 text-surface-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                </div>
            ) : filtered.length === 0 ? (
                <div className="card text-surface-500 text-sm font-medium text-center py-12 border-dashed border-2 border-white/5 bg-transparent shadow-none">
                    {search ? 'Nessun utente trovato' : 'Nessun utente registrato'}
                </div>
            ) : (
                <div className="space-y-4 pb-20">
                    {/* Summary */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard label="Utenti totali" value={users.length} />
                        <StatCard label="Iscrizioni totali" value={users.reduce((a, u) => a + u.subscription_count, 0)} />
                        <StatCard label="Donazioni totali" value={formatCents(users.reduce((a, u) => a + u.donation_total, 0))} />
                        <StatCard label="Ore di ascolto" value={Math.round(users.reduce((a, u) => a + u.listening_minutes, 0) / 60)} />
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden lg:block card overflow-hidden p-0">
                        <table className="w-full">
                            <thead className="bg-surface-900/50">
                                <tr>
                                    <th className="table-header">Nome</th>
                                    <th className="table-header">Email</th>
                                    <th className="table-header">Iscrizioni</th>
                                    <th className="table-header">Donazioni</th>
                                    <th className="table-header">Totale donato</th>
                                    <th className="table-header">Ascolto</th>
                                    <th className="table-header">Registrato</th>
                                    <th className="table-header"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filtered.map((u) => (
                                    <tr key={u.id}>
                                        <td className="table-cell font-bold text-white">{u.name}</td>
                                        <td className="table-cell text-surface-400 font-medium">{u.email}</td>
                                        <td className="table-cell text-surface-400 text-center font-bold">{u.subscription_count}</td>
                                        <td className="table-cell text-surface-400 text-center font-bold">{u.donation_count}</td>
                                        <td className="table-cell font-mono text-surface-400 text-xs">
                                            {u.donation_total > 0 ? formatCents(u.donation_total) : '—'}
                                        </td>
                                        <td className="table-cell font-mono text-surface-400 text-xs">
                                            {u.listening_minutes > 0 ? formatMinutes(u.listening_minutes) : '—'}
                                        </td>
                                        <td className="table-cell text-surface-400 text-xs font-mono">
                                            {new Date(u.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="table-cell">
                                            <button
                                                onClick={() => setDeleteTarget(u)}
                                                className="text-red-400 hover:text-red-300 transition-colors"
                                                title="Elimina utente"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile List */}
                    <div className="lg:hidden space-y-4">
                        {filtered.map((u) => (
                            <div key={u.id} className="card p-5 space-y-4 active:scale-100">
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0">
                                        <h3 className="font-extrabold text-white text-lg truncate pr-2">{u.name}</h3>
                                        <p className="text-surface-500 text-[10px] font-bold uppercase tracking-widest mt-1">{u.email}</p>
                                    </div>
                                    <button
                                        onClick={() => setDeleteTarget(u)}
                                        className="text-red-400 hover:text-red-300 transition-colors shrink-0"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 py-3 border-y border-white/5">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">Iscrizioni</span>
                                        <p className="text-xs font-mono text-surface-300">{u.subscription_count}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">Donazioni</span>
                                        <p className="text-xs font-mono text-surface-300">
                                            {u.donation_count > 0 ? `${u.donation_count} (${formatCents(u.donation_total)})` : '—'}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">Ascolto</span>
                                        <p className="text-xs font-mono text-surface-300">
                                            {u.listening_minutes > 0 ? formatMinutes(u.listening_minutes) : '—'}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">Registrato</span>
                                        <p className="text-xs font-mono text-surface-300">
                                            {new Date(u.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Delete confirmation modal */}
            {deleteTarget && (
                <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Elimina Utente">
                    <p className="text-surface-400 text-sm">
                        Eliminare <strong className="text-white">{deleteTarget.name}</strong> ({deleteTarget.email})?
                        Verranno rimossi anche iscrizioni, donazioni e dati di ascolto.
                    </p>
                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
                            Annulla
                        </button>
                        <button onClick={handleDelete} disabled={deleting} className="btn-danger">
                            {deleting ? 'Eliminazione...' : 'Elimina'}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="card p-4 space-y-1">
            <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">{label}</span>
            <p className="text-xl font-black text-white">{value}</p>
        </div>
    );
}

function formatMinutes(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
