import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, st1 } from '@shared/api/client';
import type { Church, StreamStatus, StreamActionResponse, ST1Status } from '@shared/api/types';
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
                        <ChurchCard
                            key={church.id}
                            church={church}
                            onStreamChange={fetchChurches}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================
// Church Card with stream controls
// ============================================

interface ChurchCardProps {
    church: Church;
    onStreamChange: () => void;
}

function ChurchCard({ church, onStreamChange }: ChurchCardProps) {
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState('');
    const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
    const [st1Status, setSt1Status] = useState<ST1Status | null>(null);
    const [st1Error, setSt1Error] = useState('');

    // Fetch detailed stream status
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const status = await api.get<StreamStatus>(`/priest/churches/${church.id}/stream/status`);
                setStreamStatus(status);
            } catch {
                // ignore - church data already has streaming_active
            }
        };
        fetchStatus();
    }, [church.id]);

    // Check ST1 reachability
    useEffect(() => {
        const checkST1 = async () => {
            try {
                const status = await st1.get<ST1Status>('/api/device/st1/status');
                setSt1Status(status);
                setSt1Error('');
            } catch {
                setSt1Error('ST1 non raggiungibile');
            }
        };
        checkST1();
        // Poll every 10s while streaming
        const interval = setInterval(checkST1, 10000);
        return () => clearInterval(interval);
    }, []);

    const isLive = church.streaming_active;

    const handleStart = async () => {
        setActionLoading(true);
        setActionError('');

        try {
            // 1. Create session on backend
            await api.post<StreamActionResponse>(
                `/priest/churches/${church.id}/stream/start`
            );

            // 2. Get credentials from stream status
            const status = await api.get<StreamStatus>(
                `/priest/churches/${church.id}/stream/status`
            );

            if (!status.stream_id || !status.stream_key) {
                throw new Error('Credenziali streaming non disponibili');
            }

            // 3. Configure ST1 with stream URL
            // PRODUCTION:
            // const streamUrl = `icecast://source:${status.stream_key}@vdserv.com:8000/${status.stream_id}.mp3`;

            // LOCAL TESTING (with docker-compose + mock-st1 --live):
            const streamUrl = `icecast://source:${status.stream_key}@localhost:8000/${status.stream_id}.mp3`;

            await st1.post('/api/device/st1/setup', { stream_url: streamUrl });

            // 4. Start streaming on ST1
            await st1.post('/api/device/st1/play');

            setStreamStatus(status);
            onStreamChange();
        } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Errore avvio stream');
            // If backend session was created but ST1 failed, try to clean up
            try {
                await api.post(`/priest/churches/${church.id}/stream/stop`);
            } catch {
                // cleanup failed, user will need to retry
            }
            onStreamChange();
        } finally {
            setActionLoading(false);
        }
    };

    const handleStop = async () => {
        setActionLoading(true);
        setActionError('');

        try {
            // 1. Stop ST1
            try {
                await st1.post('/api/device/st1/stop');
            } catch {
                // ST1 might be unreachable, continue with backend stop
            }

            // 2. Close session on backend
            await api.post<StreamActionResponse>(
                `/priest/churches/${church.id}/stream/stop`
            );

            setStreamStatus(null);
            onStreamChange();
        } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Errore stop stream');
        } finally {
            setActionLoading(false);
        }
    };

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
                {/* ST1 status */}
                <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-surface-500 tracking-widest">Hardware Status</p>
                    {st1Error ? (
                        <div className="text-sm text-amber-500 font-bold flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            Offline
                        </div>
                    ) : st1Status ? (
                        <div className="text-sm font-bold flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${st1Status.state === 'streaming' ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`} />
                            <span className="capitalize">{st1Status.state}</span>
                        </div>
                    ) : <span className="text-surface-600 italic">Verifica...</span>}
                </div>

                {/* Streaming time (from session) */}
                {isLive && streamStatus?.session && (
                    <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-red-500/60 tracking-widest mb-1">Durata Diretta</p>
                        <StreamTimer startedAt={streamStatus.session.started_at} />
                    </div>
                )}
            </div>

            {/* Error */}
            {actionError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs font-semibold">
                    {actionError}
                </div>
            )}

            {/* MAIN ACTIONS - HUGE BUTTONS */}
            <div className="pt-2">
                {isLive ? (
                    <button
                        onClick={handleStop}
                        disabled={actionLoading}
                        className="btn-danger w-full py-6 rounded-2xl shadow-2xl shadow-red-900/40 relative group"
                    >
                        {actionLoading ? (
                            <Spinner />
                        ) : (
                            <>
                                <div className="absolute inset-0 bg-red-400/10 rounded-2xl opacity-0 group-active:opacity-100 transition-opacity" />
                                <svg className="w-8 h-8 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                    <rect x="6" y="6" width="12" height="12" rx="1" />
                                </svg>
                                <span className="text-xl font-black uppercase tracking-tighter">Termina Diretta</span>
                            </>
                        )}
                    </button>
                ) : (
                    <button
                        onClick={handleStart}
                        disabled={actionLoading || !!st1Error}
                        className="btn-primary w-full py-6 rounded-2xl shadow-2xl shadow-primary-900/40 relative group"
                    >
                        {actionLoading ? (
                            <Spinner />
                        ) : (
                            <>
                                <div className="absolute inset-0 bg-primary-400/10 rounded-2xl opacity-0 group-active:opacity-100 transition-opacity" />
                                <svg className="w-8 h-8 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                                <span className="text-xl font-black uppercase tracking-tighter">Avvia Diretta</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Secondary Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
                <Link
                    to={`/churches/${church.id}/sessions`}
                    className="btn-ghost flex-1 py-4 text-xs tracking-tight"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Storico Sessioni
                </Link>
                {isLive && streamStatus && (
                    <a
                        href={`http://vdserv.com:8000/${streamStatus.stream_id}.mp3`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost flex-1 py-4 text-xs tracking-tight bg-surface-900 border border-white/5 active:bg-white/5"
                    >
                        <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 010-7.072m-2.828 9.9a9 9 0 010-12.728" />
                        </svg>
                        Test Audio
                    </a>
                )}
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

function Spinner() {
    return (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}