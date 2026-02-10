import { useState, useEffect } from 'react';
import { api } from '@shared/api/client';
import type { StreamingSession } from '@shared/api/types';

export default function SessionsPage() {
    const [sessions, setSessions] = useState<StreamingSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const data = await api.get<{ sessions: StreamingSession[] }>('/admin/sessions?limit=50');
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
                <div className="card text-surface-400 text-center py-12">Nessuna sessione registrata</div>
            ) : (
                <div className="card overflow-hidden p-0">
                    <table className="w-full">
                        <thead className="bg-surface-900/50">
                            <tr>
                                <th className="table-header">Chiesa</th>
                                <th className="table-header">Sacerdote</th>
                                <th className="table-header">Inizio</th>
                                <th className="table-header">Fine</th>
                                <th className="table-header">Durata</th>
                                <th className="table-header">Ascoltatori</th>
                                <th className="table-header">Stato</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-700">
                            {sessions.map((s) => {
                                const start = new Date(s.started_at);
                                const end = s.ended_at ? new Date(s.ended_at) : null;
                                const isLive = !s.ended_at;

                                return (
                                    <tr key={s.id}>
                                        <td className="table-cell font-medium">
                                            {s.church?.name ?? `#${s.church_id}`}
                                        </td>
                                        <td className="table-cell text-surface-400">
                                            {s.priest?.name ?? '—'}
                                        </td>
                                        <td className="table-cell text-surface-400 text-xs">
                                            {start.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}{' '}
                                            {start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="table-cell text-surface-400 text-xs">
                                            {end
                                                ? end.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                                                : '—'}
                                        </td>
                                        <td className="table-cell font-mono text-surface-400 text-xs">
                                            {s.duration_seconds ? formatDuration(s.duration_seconds) : '—'}
                                        </td>
                                        <td className="table-cell text-surface-400 text-center">
                                            {s.max_listener_count > 0 ? s.max_listener_count : '—'}
                                        </td>
                                        <td className="table-cell">
                                            {isLive ? (
                                                <span className="badge-live">
                                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5 animate-pulse" />
                                                    LIVE
                                                </span>
                                            ) : (
                                                <span className="badge-offline">Conclusa</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
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