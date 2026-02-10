import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@shared/api/client';
import type { StreamingSession } from '@shared/api/types';

export default function SessionsPage() {
    const { churchId } = useParams<{ churchId: string }>();
    const [sessions, setSessions] = useState<StreamingSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const data = await api.get<{ sessions: StreamingSession[] }>(
                    `/priest/churches/${churchId}/sessions?limit=30`
                );
                setSessions(data.sessions || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Errore caricamento');
            } finally {
                setLoading(false);
            }
        };
        fetchSessions();
    }, [churchId]);

    return (
        <div className="px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link to="/" className="text-surface-400 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <div>
                    <h1 className="text-xl font-bold">Storico Sessioni</h1>
                    <p className="text-surface-400 text-sm">Ultime 30 trasmissioni</p>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                </div>
            ) : error ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400">
                    {error}
                </div>
            ) : sessions.length === 0 ? (
                <div className="card text-center text-surface-400 py-12">
                    Nessuna sessione registrata
                </div>
            ) : (
                <div className="space-y-3">
                    {sessions.map((session) => (
                        <SessionCard key={session.id} session={session} />
                    ))}
                </div>
            )}
        </div>
    );
}

function SessionCard({ session }: { session: StreamingSession }) {
    const startDate = new Date(session.started_at);
    const isLive = !session.ended_at;

    return (
        <div className="card">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    {/* Date */}
                    <div className="text-sm font-medium">
                        {startDate.toLocaleDateString('it-IT', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        })}
                    </div>

                    {/* Time range */}
                    <div className="text-surface-400 text-sm">
                        {startDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        {session.ended_at && (
                            <>
                                {' → '}
                                {new Date(session.ended_at).toLocaleTimeString('it-IT', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </>
                        )}
                    </div>

                    {/* Listeners */}
                    {session.max_listener_count > 0 && (
                        <div className="text-surface-500 text-xs flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Max {session.max_listener_count} ascoltatori
                        </div>
                    )}
                </div>

                <div className="text-right">
                    {isLive ? (
                        <span className="badge-live">
                            <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5 animate-pulse" />
                            LIVE
                        </span>
                    ) : session.duration_seconds ? (
                        <span className="text-surface-300 font-mono text-sm">
                            {formatDuration(session.duration_seconds)}
                        </span>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function formatDuration(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return h > 0 ? `${h}h ${pad(m)}m` : `${m}m ${pad(s)}s`;
}