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
        <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-6 py-8">
            {/* Hidden audio element */}
            <audio ref={audioRef} onError={handleAudioError} preload="none" />

            {/* Back button */}
            <button
                onClick={() => navigate(-1)}
                className="absolute top-20 left-4 text-surface-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Indietro
            </button>

            {/* Church name */}
            <div className="text-center mb-10">
                <h1 className="text-2xl font-bold">
                    {streamInfo?.church_name || 'Caricamento...'}
                </h1>
                {playerState === 'playing' && (
                    <p className="text-red-400 text-sm mt-1 flex items-center justify-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                        In diretta
                    </p>
                )}
                {playerState === 'offline' && (
                    <p className="text-surface-400 text-sm mt-1">La trasmissione è terminata</p>
                )}
            </div>

            {/* Visualizer circle */}
            <div className="relative mb-10">
                <div
                    className={`w-48 h-48 rounded-full flex items-center justify-center transition-all duration-500 ${playerState === 'playing'
                            ? 'bg-red-500/20 ring-4 ring-red-500/30 animate-pulse'
                            : playerState === 'offline'
                                ? 'bg-surface-700/50 ring-2 ring-surface-600'
                                : 'bg-surface-700/50 ring-2 ring-surface-600'
                        }`}
                >
                    {/* Inner glow */}
                    {playerState === 'playing' && (
                        <div className="absolute inset-4 rounded-full bg-red-500/10 animate-ping" />
                    )}

                    {/* Icon */}
                    {playerState === 'loading' ? (
                        <svg className="w-12 h-12 text-surface-400 animate-spin" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    ) : playerState === 'offline' ? (
                        <svg className="w-12 h-12 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15.536a5 5 0 010-7.072m12.828 0a5 5 0 010 7.072M1.636 18.364a9 9 0 010-12.728m20.728 0a9 9 0 010 12.728" />
                            <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    ) : playerState === 'error' ? (
                        <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    ) : (
                        <svg className="w-16 h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 010-7.072m-2.828 9.9a9 9 0 010-12.728" />
                        </svg>
                    )}
                </div>
            </div>

            {/* Elapsed time */}
            {(playerState === 'playing' || playerState === 'paused') && (
                <p className="text-surface-400 text-sm font-mono mb-6">
                    {formatTime(elapsed)}
                </p>
            )}

            {/* Error message */}
            {error && playerState === 'error' && (
                <p className="text-red-400 text-sm mb-4 text-center">{error}</p>
            )}

            {/* Controls */}
            <div className="flex items-center gap-6">
                {playerState === 'offline' ? (
                    <button
                        onClick={() => navigate('/')}
                        className="btn-outline"
                    >
                        Torna alla Home
                    </button>
                ) : playerState === 'error' ? (
                    <button
                        onClick={fetchStream}
                        className="btn-primary"
                    >
                        Riprova
                    </button>
                ) : playerState !== 'loading' ? (
                    <button
                        onClick={handlePlayPause}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${playerState === 'playing'
                                ? 'bg-white text-surface-900 hover:bg-surface-200'
                                : 'bg-red-500 text-white hover:bg-red-600'
                            }`}
                    >
                        {playerState === 'playing' ? (
                            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                                <rect x="6" y="4" width="4" height="16" rx="1" />
                                <rect x="14" y="4" width="4" height="16" rx="1" />
                            </svg>
                        ) : (
                            <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        )}
                    </button>
                ) : null}
            </div>
        </div>
    );
}