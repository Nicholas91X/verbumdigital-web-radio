import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api/client';
import type { Church, StreamStatus } from '@shared/api/types';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
    const { user } = useAuth();
    const [churches, setChurches] = useState<Church[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchChurches = useCallback(async () => {
        try {
            const data = await api.get<{ churches: Church[] }>('/priest/churches');
            setChurches(data.churches || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore caricamento');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchChurches();
        // Poll every 15s for live status updates
        const interval = setInterval(fetchChurches, 15000);
        return () => clearInterval(interval);
    }, [fetchChurches]);

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

    if (error) {
        return (
            <div className="px-4 py-8">
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 py-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold">Ciao, {user?.name || 'Padre'}</h1>
                <p className="text-surface-400 text-sm mt-0.5">Le tue chiese</p>
            </div>

            {/* Church list */}
            {churches.length === 0 ? (
                <div className="card text-center text-surface-400 py-12">
                    Nessuna chiesa assegnata
                </div>
            ) : (
                <div className="space-y-4">
                    {churches.map((church) => (
                        <ChurchCard key={church.id} church={church} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================
// Church Card — read-only monitoring
// ============================================

interface ChurchCardProps {
    church: Church;
}

function ChurchCard({ church }: ChurchCardProps) {
    const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);

    // Poll stream status for live timer
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const status = await api.get<StreamStatus>(`/priest/churches/${church.id}/stream/status`);
                setStreamStatus(status);
            } catch {
                // ignore — church data already has streaming_active
            }
        };
        fetchStatus();
        const interval = setInterval(fetchStatus, 10000);
        return () => clearInterval(interval);
    }, [church.id]);

    const isLive = streamStatus?.streaming_active ?? church.streaming_active;

    return (
        <div className="card space-y-5 overflow-hidden active:scale-100 relative">
            {/* Church info */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 -mx-5 px-5">
                <div className="min-w-0">
                    <h2 className="font-extrabold text-xl tracking-tight truncate pr-4">{church.name}</h2>
                    {church.address && (
                        <p className="text-surface-500 text-[10px] uppercase font-bold tracking-widest mt-1 truncate">{church.address}</p>
                    )}
                </div>
                {isLive ? (
                    <div className="badge-live animate-pulse">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2" />
                        LIVE
                    </div>
                ) : (
                    <div className="badge-offline">STBY</div>
                )}
            </div>

            {/* Status & Timer Section */}
            <div className="flex items-center justify-between py-2">
                {/* Connection status */}
                <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-surface-500 tracking-widest">Stato</p>
                    {isLive ? (
                        <div className="text-sm font-bold flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span>In diretta</span>
                        </div>
                    ) : (
                        <div className="text-sm font-bold flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-surface-600" />
                            <span className="text-surface-400">In attesa</span>
                        </div>
                    )}
                </div>

                {/* Streaming time (from session) */}
                {isLive && streamStatus?.session && (
                    <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-red-500/60 tracking-widest mb-1">Durata Diretta</p>
                        <StreamTimer startedAt={streamStatus.session.started_at} />
                    </div>
                )}
            </div>

            {/* Info banner */}
            {!isLive && (
                <div className="bg-surface-800/50 border border-white/5 rounded-xl px-4 py-3 text-surface-400 text-xs">
                    La diretta viene gestita direttamente dall'hardware ST1. Qui puoi monitorare lo stato in tempo reale.
                </div>
            )}

            {/* Secondary Actions */}
            <div className="pt-2">
                <Link
                    to={`/churches/${church.id}/sessions`}
                    className="btn-ghost w-full py-4 text-xs tracking-tight"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Storico Sessioni
                </Link>
            </div>
        </div>
    );
}

// ============================================
// Helpers
// ============================================

function StreamTimer({ startedAt }: { startedAt: string }) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const start = new Date(startedAt).getTime();
        const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [startedAt]);

    return (
        <div className="text-2xl font-mono text-red-400 tabular-nums">
            {formatDuration(elapsed)}
        </div>
    );
}

function formatDuration(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}