import { useState, useEffect } from 'react';
import { api } from '@shared/api/client';
import type { StreamingSession } from '@shared/api/types';
import { Activity, Church, Users, Cpu } from 'lucide-react';

export default function DashboardPage() {
    const [stats, setStats] = useState({ churches: 0, priests: 0, machines: 0, live: 0 });
    const [recentSessions, setRecentSessions] = useState<StreamingSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [chData, prData, mcData, sessData] = await Promise.all([
                    api.get<{ churches: any[] }>('/admin/churches'),
                    api.get<{ priests: any[] }>('/admin/priests'),
                    api.get<{ machines: any[] }>('/admin/machines'),
                    api.get<{ sessions: StreamingSession[] }>('/admin/sessions?limit=10')
                ]);

                setStats({
                    churches: chData.churches?.length || 0,
                    priests: prData.priests?.length || 0,
                    machines: mcData.machines?.length || 0,
                    live: chData.churches?.filter(c => c.streaming_active).length || 0
                });
                setRecentSessions(sessData.sessions || []);
            } catch (err) {
                // handle error
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="text-surface-400">Caricamento...</div>;

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-extrabold tracking-tight">Dashboard Overview</h1>
                <p className="text-surface-400 mt-1">Stato globale del sistema VerbumDigital</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={<Activity className="text-red-400" />} label="Live Ora" value={stats.live} />
                <StatCard icon={<Church className="text-primary-400" />} label="Chiese Totali" value={stats.churches} />
                <StatCard icon={<Users className="text-amber-400" />} label="Sacerdoti" value={stats.priests} />
                <StatCard icon={<Cpu className="text-emerald-400" />} label="Dispositivi ST1" value={stats.machines} />
            </div>

            {/* Recent Sessions */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold">Sessioni Recenti</h2>
                <div className="bg-surface-900/50 rounded-2xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/5 text-[10px] uppercase font-bold tracking-widest text-surface-400 border-b border-white/5">
                                <th className="px-6 py-4">Chiesa</th>
                                <th className="px-6 py-4">Sacerdote</th>
                                <th className="px-6 py-4">Inizio</th>
                                <th className="px-6 py-4">Durata</th>
                                <th className="px-6 py-4">Listener Max</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {recentSessions.map(session => (
                                <tr key={session.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-bold">{session.church?.name}</td>
                                    <td className="px-6 py-4 text-surface-400">{session.priest?.name || 'Sistema'}</td>
                                    <td className="px-6 py-4 text-surface-400">{new Date(session.started_at).toLocaleString('it-IT')}</td>
                                    <td className="px-6 py-4 text-surface-400">{session.duration_seconds ? Math.floor(session.duration_seconds / 60) + ' min' : 'In corso...'}</td>
                                    <td className="px-6 py-4">
                                        <span className="bg-primary-500/10 text-primary-400 px-2 py-0.5 rounded-full text-xs font-bold">
                                            {session.max_listener_count}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: number }) {
    return (
        <div className="card space-y-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                {icon}
            </div>
            <div>
                <p className="text-sm font-medium text-surface-400">{label}</p>
                <p className="text-3xl font-extrabold tabular-nums">{value}</p>
            </div>
        </div>
    );
}
