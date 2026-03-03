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
        <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center px-6 py-8 relative overflow-hidden">
            {/* Dynamic Ambient Background Glow */}
            <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${playerState === 'playing' ? 'opacity-100' : 'opacity-30'}`}>
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vw] max-w-[600px] max-h-[600px] bg-red-500/10 blur-[100px] rounded-full animate-pulse opacity-50 mix-blend-screen" />
            </div>

            {/* Hidden audio element */}
            <audio ref={audioRef} onError={handleAudioError} preload="none" />

            {/* Header / Nav */}
            <header className="w-full flex items-center justify-between relative z-10 mb-8 mt-2">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex flex-col items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-all backdrop-blur-md active:scale-95 shadow-lg"
                >
                    <svg className="w-5 h-5 -ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">IN ONDA DA</span>
                    <span className="text-sm font-semibold text-white drop-shadow-md">
                        {streamInfo?.church_name || 'Caricamento...'}
                    </span>
                </div>
                <div className="w-10 h-10" /> {/* Spacer for centering */}
            </header>

            {/* Main Player Area - Center Vertically */}
            <div className="flex-1 w-full flex flex-col items-center justify-center relative z-10 max-w-sm mx-auto">
                
                {/* Huge Visualizer / Artwork Circle */}
                <div className="relative mb-12 flex justify-center w-full">
                    {/* Outer ripple rings matching music playing */}
                    {playerState === 'playing' && (
                        <>
                            <div className="absolute inset-0 rounded-full border border-red-500/20 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
                            <div className="absolute inset-[-10%] rounded-full border border-red-500/10 animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite_1s]" />
                        </>
                    )}

                    <div
                        className={`w-64 h-64 sm:w-72 sm:h-72 rounded-[40px] flex items-center justify-center transition-all duration-700 relative overflow-hidden shadow-2xl backdrop-blur-md
                            ${playerState === 'playing'
                                ? 'bg-gradient-to-br from-red-600/30 to-rose-900/40 border border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.2)]'
                                : playerState === 'offline'
                                    ? 'bg-white/5 border border-white/10 grayscale opacity-70'
                                    : 'bg-white/5 border border-white/10'
                            }`}
                        style={{
                            boxShadow: playerState === 'playing' ? 'inset 0 0 40px rgba(239,68,68,0.2), 0 20px 50px rgba(0,0,0,0.5)' : '0 20px 50px rgba(0,0,0,0.5)'
                        }}
                    >
                        {/* Inner glowing pulse */}
                        {playerState === 'playing' && (
                            <div className="absolute inset-0 bg-gradient-to-t from-red-500/20 to-transparent opacity-50" />
                        )}

                        {/* Status Icon inside artwork */}
                        {playerState === 'loading' ? (
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full border-4 border-white/10 absolute" />
                                <div className="w-16 h-16 rounded-full border-4 border-red-500 border-t-transparent animate-spin" />
                            </div>
                        ) : playerState === 'offline' ? (
                            <div className="flex flex-col items-center gap-3 text-slate-500">
                                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15.536a5 5 0 010-7.072m12.828 0a5 5 0 010 7.072M1.636 18.364a9 9 0 010-12.728m20.728 0a9 9 0 010 12.728" />
                                    <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                                <span className="font-medium text-sm">Fine Trasmissione</span>
                            </div>
                        ) : playerState === 'error' ? (
                            <svg className="w-16 h-16 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <svg className="w-20 h-20 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 010-7.072m-2.828 9.9a9 9 0 010-12.728" />
                            </svg>
                        )}
                    </div>
                </div>

                {/* Track Info */}
                <div className="text-center mb-10 w-full space-y-2">
                    <h2 className="text-2xl font-bold text-white truncate px-4">
                        {streamInfo?.church_name || 'Radio Parrocchiale'}
                    </h2>
                    
                    <div className="h-6 flex items-center justify-center">
                        {playerState === 'playing' ? (
                            <p className="inline-flex items-center justify-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-sm font-medium">
                                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                Trasmissione Live
                            </p>
                        ) : playerState === 'offline' ? (
                            <p className="text-slate-400 text-sm font-medium">La diretta è offline</p>
                        ) : playerState === 'error' && error ? (
                            <p className="text-red-400 text-sm font-medium">{error}</p>
                        ) : null}
                    </div>
                </div>

                {/* Playback Controls Area */}
                <div className="w-full flex flex-col items-center gap-8 pb-4">
                    {/* Elapsed Time Timer */}
                    <div className="w-full flex justify-between items-center text-xs font-mono font-medium text-slate-400 px-2 opacity-80">
                        <span>{formatTime(elapsed)}</span>
                        <span>LIVE</span>
                    </div>

                    {/* Main Controls Row */}
                    <div className="flex items-center justify-center gap-8">
                        {playerState === 'offline' ? (
                            <button onClick={() => navigate('/')} className="btn-outline px-8 py-3.5 rounded-full ring-2 ring-white/10 hover:ring-white/20">
                                Torna alla Home
                            </button>
                        ) : playerState === 'error' ? (
                            <button onClick={fetchStream} className="btn-primary px-8 py-3.5 rounded-full">
                                Riprova Connessione
                            </button>
                        ) : playerState !== 'loading' ? (
                            <button
                                onClick={handlePlayPause}
                                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 shadow-2xl
                                    ${playerState === 'playing'
                                        ? 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-xl border border-white/20'
                                        : 'bg-gradient-to-b from-red-500 to-red-600 text-white hover:from-red-400 hover:to-red-500 shadow-[0_10px_30px_rgba(239,68,68,0.4)] border border-red-400/30'
                                    }`}
                            >
                                {playerState === 'playing' ? (
                                    <svg className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-0.5" viewBox="0 0 24 24">
                                        <rect x="6" y="4" width="4" height="16" rx="1.5" />
                                        <rect x="14" y="4" width="4" height="16" rx="1.5" />
                                    </svg>
                                ) : (
                                    <svg className="w-10 h-10 sm:w-12 sm:h-12 fill-current ml-2" viewBox="0 0 24 24">
                                        <path d="M7 4.5v15a1 1 0 001.524.852l12-7.5a1 1 0 000-1.704l-12-7.5A1 1 0 007 4.5z" />
                                    </svg>
                                )}
                            </button>
                        ) : (
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/5 border border-white/10 animate-pulse" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}