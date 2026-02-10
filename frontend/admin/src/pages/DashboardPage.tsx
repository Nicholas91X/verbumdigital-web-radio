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
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold">Dashboard</h1>

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
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold">Sessioni recenti</h2>
                    <Link to="/sessions" className="text-primary-400 text-sm hover:text-primary-300">
                        Vedi tutte →
                    </Link>
                </div>

                {stats?.recentSessions.length === 0 ? (
                    <div className="card text-surface-400 text-sm text-center py-8">
                        Nessuna sessione registrata
                    </div>
                ) : (
                    <div className="card overflow-hidden p-0">
                        <table className="w-full">
                            <thead className="bg-surface-900/50">
                                <tr>
                                    <th className="table-header">Chiesa</th>
                                    <th className="table-header">Data</th>
                                    <th className="table-header">Durata</th>
                                    <th className="table-header">Stato</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-700">
                                {stats?.recentSessions.map((s) => (
                                    <tr key={s.id}>
                                        <td className="table-cell font-medium">{s.church?.name ?? `Chiesa #${s.church_id}`}</td>
                                        <td className="table-cell text-surface-400">
                                            {new Date(s.started_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="table-cell text-surface-400 font-mono">
                                            {s.duration_seconds ? formatDuration(s.duration_seconds) : '—'}
                                        </td>
                                        <td className="table-cell">
                                            {s.ended_at ? (
                                                <span className="badge-offline">Conclusa</span>
                                            ) : (
                                                <span className="badge-live">
                                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5 animate-pulse" />
                                                    LIVE
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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