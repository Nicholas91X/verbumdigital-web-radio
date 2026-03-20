import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api/client';
import type { Machine, Church, Priest, StreamingSession } from '@shared/api/types';

interface Stats {
    machines: number;
    activeMachines: number;
    churches: number;
    liveChurches: number;
    priests: number;
    recentSessions: StreamingSession[];
}

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [machinesRes, churchesRes, priestsRes, sessionsRes] = await Promise.all([
                    api.get<{ machines: Machine[] }>('/admin/machines'),
                    api.get<{ churches: Church[] }>('/admin/churches'),
                    api.get<{ priests: Priest[] }>('/admin/priests'),
                    api.get<{ sessions: StreamingSession[] }>('/admin/sessions?limit=5'),
                ]);

                const machines = machinesRes.machines || [];
                const churches = churchesRes.churches || [];

                setStats({
                    machines: machines.length,
                    activeMachines: machines.filter((m) => m.activated).length,
                    churches: churches.length,
                    liveChurches: churches.filter((c) => c.streaming_active).length,
                    priests: (priestsRes.priests || []).length,
                    recentSessions: sessionsRes.sessions || [],
                });
            } catch {
                // individual errors handled by stat cards showing "—"
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            </div>
        );
    }

    return (
        <div className="px-5 py-8 space-y-8 pb-32">
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
                <p className="text-surface-500 text-sm font-medium mt-1">Sintesi operativa del sistema</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Macchine"
                    value={stats?.machines ?? '—'}
                    sub={`${stats?.activeMachines ?? 0} attive`}
                    to="/machines"
                    color="blue"
                />
                <StatCard
                    label="Chiese"
                    value={stats?.churches ?? '—'}
                    sub={stats?.liveChurches ? `${stats.liveChurches} in streaming` : 'Nessuna live'}
                    to="/churches"
                    color="emerald"
                />
                <StatCard
                    label="Sacerdoti"
                    value={stats?.priests ?? '—'}
                    to="/priests"
                    color="purple"
                />
                <StatCard
                    label="Live Now"
                    value={stats?.liveChurches ?? 0}
                    to="/sessions"
                    color="red"
                    pulse={!!stats?.liveChurches}
                />
            </div>

            {/* Recent sessions */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold tracking-tight">Sessioni recenti</h2>
                    <Link to="/sessions" className="text-primary-500 text-xs font-black uppercase tracking-widest hover:text-primary-400">
                        Vedi tutte
                    </Link>
                </div>

                {stats?.recentSessions.length === 0 ? (
                    <div className="card text-surface-500 text-sm font-medium text-center py-10 border-dashed border-2 border-white/5 bg-transparent shadow-none">
                        Nessuna sessione registrata
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Desktop Table View */}
                        <div className="hidden lg:block card overflow-hidden p-0">
                            <table className="w-full">
                                <thead className="bg-surface-900/50">
                                    <tr>
                                        <th className="table-header">Chiesa</th>
                                        <th className="table-header">Data</th>
                                        <th className="table-header">Durata</th>
                                        <th className="table-header">Stato</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {stats?.recentSessions.map((s) => (
                                        <tr key={s.id}>
                                            <td className="table-cell font-bold text-white">{s.church?.name ?? `Chiesa #${s.church_id}`}</td>
                                            <td className="table-cell text-surface-400 font-medium">
                                                {new Date(s.started_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="table-cell text-surface-400 font-mono">
                                                {s.duration_seconds ? formatDuration(s.duration_seconds) : '—'}
                                            </td>
                                            <td className="table-cell">
                                                {s.ended_at ? (
                                                    <span className="badge-offline">Conclusa</span>
                                                ) : (
                                                    <span className="badge-live">Live</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile List View */}
                        <div className="lg:hidden space-y-3">
                            {stats?.recentSessions.map((s) => (
                                <div key={s.id} className="card p-4 flex items-center gap-4 active:scale-[0.98] transition-all">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white truncate">{s.church?.name || `Chiesa #${s.church_id}`}</p>
                                        <p className="text-surface-500 text-[10px] uppercase font-bold tracking-widest mt-1">
                                            {new Date(s.started_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        {!s.ended_at ? (
                                            <div className="badge-live">Live</div>
                                        ) : (
                                            <p className="text-xs font-mono text-surface-400">
                                                {s.duration_seconds ? formatDuration(s.duration_seconds) : '—'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================
// Helpers
// ============================================

interface StatCardProps {
    label: string;
    value: number | string;
    sub?: string;
    to: string;
    color: string;
    pulse?: boolean;
}

function StatCard({ label, value, sub, to, color, pulse }: StatCardProps) {
    const colorMap: Record<string, string> = {
        blue: 'text-blue-400',
        emerald: 'text-emerald-400',
        purple: 'text-purple-400',
        red: 'text-red-400',
    };

    return (
        <Link to={to} className="card hover:border-surface-600 transition-colors">
            <p className="text-surface-400 text-sm">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${colorMap[color] || 'text-white'}`}>
                {pulse && <span className="inline-block w-2 h-2 bg-red-400 rounded-full mr-2 animate-pulse" />}
                {value}
            </p>
            {sub && <p className="text-surface-500 text-xs mt-1">{sub}</p>}
        </Link>
    );
}

function formatDuration(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}h ${pad(m)}m` : `${m}m`;
}