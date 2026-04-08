import { useState, useEffect } from 'react';
import { api } from '@shared/api/client';
import type { SessionWithMetrics } from '@shared/api/types';

export default function SessionsPage() {
    const [sessions, setSessions] = useState<SessionWithMetrics[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const data = await api.get<{ sessions: SessionWithMetrics[] }>('/admin/sessions?limit=50');
                setSessions(data.sessions || []);
            } catch {
                //
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Sessioni Streaming</h1>
                <p className="text-surface-400 text-sm mt-0.5">Ultime 50 sessioni di trasmissione</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                </div>
            ) : sessions.length === 0 ? (
                <div className="card text-surface-500 text-sm font-medium text-center py-12 border-dashed border-2 border-white/5 bg-transparent shadow-none">
                    Nessuna sessione registrata
                </div>
            ) : (
                <div className="space-y-4 pb-20">
                    {/* Desktop Table */}
                    <div className="hidden lg:block card overflow-hidden p-0">
                        <table className="w-full">
                            <thead className="bg-surface-900/50">
                                <tr>
                                    <th className="table-header">Chiesa</th>
                                    <th className="table-header">Sacerdote</th>
                                    <th className="table-header">Inizio</th>
                                    <th className="table-header">Fine</th>
                                    <th className="table-header">Durata</th>
                                    <th className="table-header">Ascoltatori</th>
                                    <th className="table-header">Ascolto tot.</th>
                                    <th className="table-header">Banda</th>
                                    <th className="table-header">Stato</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {sessions.map((s) => {
                                    const start = new Date(s.started_at);
                                    const end = s.ended_at ? new Date(s.ended_at) : null;
                                    const isLive = !s.ended_at;

                                    return (
                                        <tr key={s.id}>
                                            <td className="table-cell font-bold text-white">
                                                {s.church?.name ?? `#${s.church_id}`}
                                            </td>
                                            <td className="table-cell text-surface-400 font-medium">
                                                {s.priest?.name ?? '—'}
                                            </td>
                                            <td className="table-cell text-surface-400 text-xs font-mono">
                                                {start.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}{' '}
                                                {start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="table-cell text-surface-400 text-xs font-mono">
                                                {end
                                                    ? end.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                                                    : '—'}
                                            </td>
                                            <td className="table-cell font-mono text-surface-400 text-xs">
                                                {s.duration_seconds ? formatDuration(s.duration_seconds) : '—'}
                                            </td>
                                            <td className="table-cell text-surface-400 text-center font-bold">
                                                {s.listener_count > 0 ? s.listener_count : (s.max_listener_count > 0 ? s.max_listener_count : '—')}
                                            </td>
                                            <td className="table-cell font-mono text-surface-400 text-xs">
                                                {s.total_listen_secs > 0 ? formatDuration(s.total_listen_secs) : '—'}
                                            </td>
                                            <td className="table-cell font-mono text-surface-400 text-xs">
                                                {s.bandwidth_mb > 0 ? `${s.bandwidth_mb.toFixed(1)} MB` : '—'}
                                            </td>
                                            <td className="table-cell">
                                                {isLive ? (
                                                    <span className="badge-live">LIVE</span>
                                                ) : (
                                                    <span className="badge-offline">Fine</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile List */}
                    <div className="lg:hidden space-y-4">
                        {sessions.map((s) => {
                            const start = new Date(s.started_at);
                            const isLive = !s.ended_at;
                            return (
                                <div key={s.id} className="card p-5 space-y-4 active:scale-100">
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0">
                                            <h3 className="font-extrabold text-white text-lg truncate pr-2">
                                                {s.church?.name || `Chiesa #${s.church_id}`}
                                            </h3>
                                            <p className="text-surface-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                                                {s.priest?.name || 'Sistema'}
                                            </p>
                                        </div>
                                        {isLive ? (
                                            <div className="badge-live">Live</div>
                                        ) : (
                                            <div className="badge-offline">Finito</div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 py-3 border-y border-white/5">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">Inizio</span>
                                            <p className="text-xs font-mono text-surface-300">
                                                {start.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}{' '}
                                                {start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">Durata / Ascoltatori</span>
                                            <p className="text-xs font-mono text-surface-300">
                                                {s.duration_seconds ? formatDuration(s.duration_seconds) : '—'} / {s.listener_count > 0 ? s.listener_count : s.max_listener_count} usr
                                            </p>
                                        </div>
                                    </div>
                                    {(s.total_listen_secs > 0 || s.bandwidth_mb > 0) && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">Ascolto totale</span>
                                                <p className="text-xs font-mono text-surface-300">
                                                    {s.total_listen_secs > 0 ? formatDuration(s.total_listen_secs) : '—'}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">Banda</span>
                                                <p className="text-xs font-mono text-surface-300">
                                                    {s.bandwidth_mb > 0 ? `${s.bandwidth_mb.toFixed(1)} MB` : '—'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function formatDuration(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}h ${pad(m)}m` : `${m}m`;
}