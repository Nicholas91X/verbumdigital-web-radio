import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@shared/api/client';
import type { StreamURLResponse } from '@shared/api/types';

type PlayerState = 'loading' | 'playing' | 'paused' | 'error' | 'offline';

export default function ListenPage() {
    const { churchId } = useParams<{ churchId: string }>();
    const navigate = useNavigate();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const [streamInfo, setStreamInfo] = useState<StreamURLResponse | null>(null);
    const [playerState, setPlayerState] = useState<PlayerState>('loading');
    const [elapsed, setElapsed] = useState(0);
    const [error, setError] = useState('');

    // Fetch stream URL
    const fetchStream = useCallback(async () => {
        try {
            const data = await api.get<StreamURLResponse>(
                `/user/churches/${churchId}/stream`
            );
            setStreamInfo(data);

            if (!data.streaming_active) {
                setPlayerState('offline');
                return;
            }

            // Start playback
            if (audioRef.current) {
                audioRef.current.src = data.stream_url;
                audioRef.current.load();
                try {
                    await audioRef.current.play();
                    setPlayerState('playing');
                } catch {
                    // Autoplay may be blocked — user needs to tap play
                    setPlayerState('paused');
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore caricamento stream');
            setPlayerState('error');
        }
    }, [churchId]);

    useEffect(() => {
        fetchStream();

        return () => {
            // Cleanup audio on unmount
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
        };
    }, [fetchStream]);

    // Elapsed time counter
    useEffect(() => {
        if (playerState !== 'playing') return;
        const interval = setInterval(() => {
            setElapsed((prev) => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [playerState]);

    // Poll stream status to detect end of broadcast
    useEffect(() => {
        if (playerState === 'offline' || playerState === 'error') return;
        const poll = setInterval(async () => {
            try {
                const data = await api.get<StreamURLResponse>(
                    `/user/churches/${churchId}/stream`
                );
                if (!data.streaming_active) {
                    if (audioRef.current) {
                        audioRef.current.pause();
                        audioRef.current.src = '';
                    }
                    setStreamInfo(data);
                    setPlayerState('offline');
                }
            } catch {
                // ignore poll errors
            }
        }, 15000);
        return () => clearInterval(poll);
    }, [churchId, playerState]);

    const handlePlayPause = async () => {
        if (!audioRef.current || !streamInfo) return;

        if (playerState === 'playing') {
            audioRef.current.pause();
            setPlayerState('paused');
        } else {
            try {
                // Reload stream to get fresh audio (Icecast doesn't support seeking)
                if (!audioRef.current.src || audioRef.current.src === '') {
                    audioRef.current.src = streamInfo.stream_url;
                    audioRef.current.load();
                }
                await audioRef.current.play();
                setPlayerState('playing');
            } catch {
                setError('Impossibile avviare la riproduzione');
                setPlayerState('error');
            }
        }
    };

    const handleAudioError = () => {
        if (playerState === 'offline') return; // Expected when stream ends
        setPlayerState('error');
        setError('Errore nella riproduzione audio');
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const pad = (n: number) => n.toString().padStart(2, '0');
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    };

    return (
        <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-6 py-8 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] pointer-events-none opacity-20">
                <div className={`w-full h-full rounded-full blur-[120px] transition-colors duration-1000 ${playerState === 'playing' ? 'bg-primary-600' : 'bg-surface-800'
                    }`} />
            </div>

            {/* Hidden audio element */}
            <audio ref={audioRef} onError={handleAudioError} preload="none" />

            {/* Back button */}
            <button
                onClick={() => navigate(-1)}
                className="absolute top-6 left-6 text-surface-400 hover:text-white transition-colors flex items-center gap-1.5 z-20 pt-safe"
            >
                <div className="w-8 h-8 rounded-full bg-surface-900 border border-surface-800 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </div>
                <span className="font-semibold text-xs tracking-wide uppercase">Indietro</span>
            </button>

            {/* Church name */}
            <div className="text-center mb-12 z-20">
                <h1 className="text-3xl font-extrabold tracking-tight mb-2">
                    {streamInfo?.church_name || 'Caricamento...'}
                </h1>
                <div className="flex flex-col items-center gap-2">
                    {playerState === 'playing' ? (
                        <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                            <span className="text-red-500 text-[10px] font-bold uppercase tracking-widest leading-none">In Diretta</span>
                        </div>
                    ) : playerState === 'offline' ? (
                        <div className="px-3 py-1 bg-surface-800 border border-surface-700 rounded-full flex items-center gap-2">
                            <span className="w-2 h-2 bg-surface-600 rounded-full" />
                            <span className="text-surface-400 text-[10px] font-bold uppercase tracking-widest leading-none">Scollegato</span>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Visualizer circle */}
            <div className="relative mb-12 z-20 group">
                <div
                    className={`w-56 h-56 rounded-full flex items-center justify-center transition-all duration-700 relative ${playerState === 'playing'
                            ? 'bg-primary-600/10 ring-[12px] ring-primary-600/20 scale-105'
                            : 'bg-surface-900 ring-1 ring-surface-800'
                        }`}
                >
                    {/* Pulsing rings for live state */}
                    {playerState === 'playing' && (
                        <>
                            <div className="absolute inset-0 rounded-full border-4 border-primary-500/30 animate-[ping_3s_linear_infinite]" />
                            <div className="absolute inset-0 rounded-full border border-primary-500/20 animate-[ping_2s_linear_infinite]" />
                        </>
                    )}

                    {/* Content inside circle */}
                    <div className="flex flex-col items-center gap-4">
                        {playerState === 'loading' ? (
                            <svg className="w-10 h-10 text-primary-500 animate-spin" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        ) : playerState === 'offline' ? (
                            <svg className="w-14 h-14 text-surface-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15.536a5 5 0 010-7.072m12.828 0a5 5 0 010 7.072M1.636 18.364a9 9 0 010-12.728m20.728 0a9 9 0 010 12.728" />
                                <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                        ) : playerState === 'error' ? (
                            <svg className="w-14 h-14 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <div className="flex flex-col items-center">
                                <span className="text-4xl font-black tracking-tight mb-1">{formatTime(elapsed)}</span>
                                <span className="text-[10px] text-surface-500 uppercase tracking-widest font-bold">Durata</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="w-full max-w-xs space-y-4 z-20 mt-4">
                {playerState === 'offline' ? (
                    <button onClick={() => navigate('/')} className="btn-outline w-full py-4 text-sm tracking-wide">
                        Torna alla Home
                    </button>
                ) : playerState === 'error' ? (
                    <div className="space-y-4">
                        <p className="text-red-400 text-xs text-center font-medium bg-red-500/5 py-2 rounded-lg border border-red-500/20">{error}</p>
                        <button onClick={fetchStream} className="btn-primary w-full py-4">Riprova</button>
                    </div>
                ) : playerState !== 'loading' ? (
                    <div className="flex flex-col items-center gap-8">
                        {/* Huge Central Play/Pause Button */}
                        <button
                            onClick={handlePlayPause}
                            className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl relative active:scale-90 ${playerState === 'playing'
                                    ? 'bg-white text-surface-950 shadow-white/10'
                                    : 'bg-primary-600 text-white shadow-primary-900/40 hover:bg-primary-500'
                                }`}
                        >
                            {playerState === 'playing' ? (
                                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                                    <rect x="6" y="4" width="4" height="16" rx="1" />
                                    <rect x="14" y="4" width="4" height="16" rx="1" />
                                </svg>
                            ) : (
                                <svg className="w-10 h-10 ml-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            )}
                        </button>

                        {/* Audio Legend */}
                        <p className="text-surface-500 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 010-7.072m-2.828 9.9a9 9 0 010-12.728" />
                            </svg>
                            Audio Streaming {playerState === 'playing' ? 'Attivo' : 'Pausato'}
                        </p>
                    </div>
                ) : null}
            </div>
        </div>
    );
}