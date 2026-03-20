import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@shared/api/client";
import type { StreamURLResponse } from "@shared/api/types";

type PlayerState =
  | "loading" // Initial fetch
  | "buffering" // Audio loading / reconnecting
  | "playing" // Audio playing
  | "paused" // User paused
  | "error" // Unrecoverable error
  | "offline" // Church not streaming
  | "waiting"; // Waiting for broadcast to start

const MAX_RETRIES = 5;
const BASE_RETRY_MS = 1500;
const MAX_RETRY_MS = 15000;

export default function ListenPage() {
  const { churchId } = useParams<{ churchId: string }>();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [streamInfo, setStreamInfo] = useState<StreamURLResponse | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>("loading");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [retryIn, setRetryIn] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [pausedAt, setPausedAt] = useState<number | null>(null);

  // ── Fetch stream info ──────────────────────────
  const fetchStream = useCallback(async () => {
    try {
      const data = await api.get<StreamURLResponse>(
        `/user/churches/${churchId}/stream`,
      );
      setStreamInfo(data);
      return data;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Errore caricamento stream",
      );
      setPlayerState("error");
      return null;
    }
  }, [churchId]);

  // ── Start audio playback ───────────────────────
  const startPlayback = useCallback(async (url: string) => {
    const audio = audioRef.current;
    if (!audio) return;

    setPlayerState("buffering");
    audio.src = url;
    audio.load();

    try {
      await audio.play();
      retryCountRef.current = 0;
      setPlayerState("playing");
    } catch {
      // Autoplay blocked — user needs to tap play
      setPlayerState("paused");
    }
  }, []);

  // ── Auto-reconnect with exponential backoff ────
  const scheduleRetry = useCallback(() => {
    if (retryCountRef.current >= MAX_RETRIES) {
      setPlayerState("error");
      setError('Connessione persa. Tocca "Riprova" per riconnetterti.');
      return;
    }

    const delay = Math.min(
      BASE_RETRY_MS * Math.pow(2, retryCountRef.current),
      MAX_RETRY_MS,
    );
    retryCountRef.current++;

    setPlayerState("buffering");
    setRetryIn(Math.ceil(delay / 1000));

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setRetryIn((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    retryTimerRef.current = setTimeout(async () => {
      clearInterval(countdownInterval);
      setRetryIn(0);

      // Re-check if stream is still active before retrying
      const freshData = await fetchStream();
      if (freshData?.streaming_active) {
        startPlayback(freshData.stream_url);
      } else {
        setPlayerState("offline");
      }
    }, delay);
  }, [fetchStream, startPlayback]);

  // ── Audio event handlers ───────────────────────
  const handleAudioError = useCallback(() => {
    if (playerState === "offline" || playerState === "waiting") return;

    const audio = audioRef.current;
    if (!audio) return;

    // Try to reconnect
    if (streamInfo?.stream_url) {
      scheduleRetry();
    } else {
      setPlayerState("error");
      setError("Errore nella riproduzione audio");
    }
  }, [playerState, streamInfo, scheduleRetry]);

  const handleAudioWaiting = useCallback(() => {
    if (playerState === "playing") {
      setPlayerState("buffering");
    }
  }, [playerState]);

  const handleAudioPlaying = useCallback(() => {
    retryCountRef.current = 0;
    setPlayerState("playing");
  }, []);

  // ── Media Session API (lock screen controls) ───
  useEffect(() => {
    if (!("mediaSession" in navigator) || !streamInfo) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: streamInfo.church_name || "Diretta",
      artist: "VerbumDigital Radio",
      album: "Streaming in diretta",
    });

    navigator.mediaSession.setActionHandler("play", () => {
      audioRef.current?.play();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audioRef.current?.pause();
      setPlayerState("paused");
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
    };
  }, [streamInfo]);

  // ── Initial load ───────────────────────────────
  useEffect(() => {
    const init = async () => {
      const data = await fetchStream();
      if (!data) return;

      if (data.streaming_active) {
        startPlayback(data.stream_url);
      } else {
        setPlayerState("waiting");
      }
    };
    init();

    return () => {
      // Cleanup
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [fetchStream, startPlayback]);

  // ── Elapsed time counter ───────────────────────
  useEffect(() => {
    if (playerState !== "playing") return;

    const updateElapsed = () => {
      if (streamInfo?.started_at) {
        const start = new Date(streamInfo.started_at).getTime();
        const now = new Date().getTime();
        setElapsed(Math.max(0, Math.floor((now - start) / 1000)));
      } else {
        setElapsed((prev) => prev + 1);
      }
    };

    // Initial update
    if (streamInfo?.started_at) {
      updateElapsed();
    }

    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [playerState, streamInfo?.started_at]);

  // ── Auto-detect when broadcast starts ──────────
  // When offline/waiting, poll to detect stream going live
  useEffect(() => {
    if (playerState !== "waiting" && playerState !== "offline") return;

    const poll = setInterval(async () => {
      try {
        const data = await api.get<StreamURLResponse>(
          `/user/churches/${churchId}/stream`,
        );
        if (data.streaming_active) {
          setStreamInfo(data);
          startPlayback(data.stream_url);
          clearInterval(poll);
        }
      } catch {
        // ignore
      }
    }, 10000);

    return () => clearInterval(poll);
  }, [churchId, playerState, startPlayback]);

  // ── Detect broadcast end while playing ─────────
  useEffect(() => {
    if (
      playerState !== "playing" &&
      playerState !== "paused" &&
      playerState !== "buffering"
    )
      return;

    const poll = setInterval(async () => {
      try {
        const data = await api.get<StreamURLResponse>(
          `/user/churches/${churchId}/stream`,
        );
        if (!data.streaming_active) {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
          }
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
          }
          setStreamInfo(data);
          setPlayerState("offline");
        }
      } catch {
        // ignore poll errors
      }
    }, 15000);

    return () => clearInterval(poll);
  }, [churchId, playerState]);

  // ── Go Live handler ────────────────────────────
  const goLive = useCallback(() => {
    if (!audioRef.current || !streamInfo) return;

    // Force reconnection with timestamp to bypass browser buffer
    const liveUrl = `${streamInfo.stream_url}${streamInfo.stream_url.includes("?") ? "&" : "?"}t=${Date.now()}`;

    audioRef.current.src = liveUrl;
    audioRef.current.load();

    setPlayerState("buffering");
    audioRef.current
      .play()
      .then(() => {
        setPlayerState("playing");
        setIsLive(true);
        setPausedAt(null);
      })
      .catch(() => {
        setPlayerState("paused");
      });
  }, [streamInfo]);

  // ── Play/Pause handler ─────────────────────────
  const handlePlayPause = async () => {
    if (!audioRef.current || !streamInfo) return;

    if (playerState === "playing" || playerState === "buffering") {
      audioRef.current.pause();
      setPlayerState("paused");
      setPausedAt(Date.now());
    } else {
      try {
        // Check if we should be "In Ritardo" (paused > 3s)
        if (pausedAt && Date.now() - pausedAt > 3000) {
          setIsLive(false);
        }

        if (!audioRef.current.src || audioRef.current.src === "") {
          audioRef.current.src = streamInfo.stream_url;
          audioRef.current.load();
        }
        setPlayerState("buffering");
        await audioRef.current.play();
        setPlayerState("playing");
      } catch {
        setError("Impossibile avviare la riproduzione");
        setPlayerState("error");
      }
    }
  };

  // ── Manual retry ───────────────────────────────
  const handleRetry = async () => {
    retryCountRef.current = 0;
    setError("");
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setPlayerState("loading");
    const data = await fetchStream();
    if (data?.streaming_active) {
      startPlayback(data.stream_url);
    } else {
      setPlayerState("waiting");
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-6 py-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] pointer-events-none opacity-20">
        <div
          className={`w-full h-full rounded-full blur-[120px] transition-colors duration-1000 ${
            playerState === "playing"
              ? "bg-primary-600"
              : playerState === "waiting"
                ? "bg-amber-600"
                : "bg-surface-800"
          }`}
        />
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onError={handleAudioError}
        onWaiting={handleAudioWaiting}
        onPlaying={handleAudioPlaying}
        preload="none"
      />

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 text-surface-400 hover:text-white transition-colors flex items-center gap-1.5 z-20 pt-safe"
      >
        <div className="w-8 h-8 rounded-full bg-surface-900 border border-surface-800 flex items-center justify-center">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </div>
        <span className="font-semibold text-xs tracking-wide uppercase">
          Indietro
        </span>
      </button>

      {/* Church name */}
      <div className="text-center mb-12 z-20 w-full px-4">
        <h1 className="text-3xl font-extrabold tracking-tight mb-3 truncate">
          {streamInfo?.church_name || "Caricamento..."}
        </h1>
        <div className="flex flex-col items-center gap-2">
          {(playerState === "playing" ||
            playerState === "buffering" ||
            playerState === "paused") &&
            (isLive ? (
              <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <span className="text-red-500 text-[10px] font-bold uppercase tracking-widest leading-none">
                  In Diretta
                </span>
              </div>
            ) : (
              <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                <span className="text-amber-500 text-[10px] font-bold uppercase tracking-widest leading-none">
                  In Ritardo
                </span>
              </div>
            ))}
          {playerState === "buffering" && (
            <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center gap-2">
              <svg
                className="w-3 h-3 text-amber-500 animate-spin"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-amber-500 text-[10px] font-bold uppercase tracking-widest leading-none">
                {retryIn > 0
                  ? `Riconnessione in ${retryIn}s...`
                  : "Connessione..."}
              </span>
            </div>
          )}
          {playerState === "offline" && (
            <div className="px-3 py-1 bg-surface-800 border border-surface-700 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 bg-surface-600 rounded-full" />
              <span className="text-surface-400 text-[10px] font-bold uppercase tracking-widest leading-none">
                Diretta terminata
              </span>
            </div>
          )}
          {playerState === "waiting" && (
            <div className="px-3 py-1 bg-amber-500/5 border border-amber-500/20 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-amber-500/80 text-[10px] font-bold uppercase tracking-widest leading-none">
                In attesa della diretta...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Visualizer circle */}
      <div className="relative mb-12 z-20 group">
        <div
          className={`w-56 h-56 rounded-full flex items-center justify-center transition-all duration-700 relative ${
            playerState === "playing"
              ? "bg-primary-600/10 ring-[12px] ring-primary-600/20 scale-105"
              : playerState === "buffering"
                ? "bg-amber-600/5 ring-4 ring-amber-500/20 scale-[1.02]"
                : playerState === "waiting"
                  ? "bg-amber-600/5 ring-1 ring-amber-500/10"
                  : "bg-surface-900 ring-1 ring-surface-800"
          }`}
        >
          {/* Pulsing rings for live state */}
          {playerState === "playing" && (
            <>
              <div className="absolute inset-0 rounded-full border-4 border-primary-500/30 animate-[ping_3s_linear_infinite]" />
              <div className="absolute inset-0 rounded-full border border-primary-500/20 animate-[ping_2s_linear_infinite]" />
            </>
          )}

          {/* Buffering ring */}
          {playerState === "buffering" && (
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-500 animate-spin" />
          )}

          {/* Content inside circle */}
          <div className="flex flex-col items-center gap-4">
            {playerState === "loading" ? (
              <svg
                className="w-10 h-10 text-primary-500 animate-spin"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : playerState === "waiting" ? (
              <div className="flex flex-col items-center gap-3">
                <svg
                  className="w-12 h-12 text-amber-500/50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.586 15.536a5 5 0 010-7.072m12.828 0a5 5 0 010 7.072M1.636 18.364a9 9 0 010-12.728m20.728 0a9 9 0 010 12.728"
                  />
                </svg>
                <div className="flex gap-1">
                  <span
                    className="w-1.5 h-1.5 bg-amber-500/40 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-amber-500/40 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-amber-500/40 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            ) : playerState === "offline" ? (
              <svg
                className="w-14 h-14 text-surface-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.586 15.536a5 5 0 010-7.072m12.828 0a5 5 0 010 7.072M1.636 18.364a9 9 0 010-12.728m20.728 0a9 9 0 010 12.728"
                />
                <line
                  x1="4"
                  y1="4"
                  x2="20"
                  y2="20"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            ) : playerState === "error" ? (
              <svg
                className="w-14 h-14 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : playerState === "buffering" ? (
              <div className="flex flex-col items-center gap-2">
                <svg
                  className="w-8 h-8 text-amber-500 animate-spin"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {retryCountRef.current > 0 && (
                  <span className="text-[10px] text-amber-500/60 font-bold uppercase tracking-wider">
                    Tentativo {retryCountRef.current}/{MAX_RETRIES}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-4xl font-black tracking-tight mb-1">
                  {formatTime(elapsed)}
                </span>
                <span className="text-[10px] text-surface-500 uppercase tracking-widest font-bold">
                  Durata
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-xs space-y-4 z-20 mt-4">
        {playerState === "offline" ? (
          <button
            onClick={() => navigate("/")}
            className="btn-outline w-full py-4 text-sm tracking-wide"
          >
            Torna alla Home
          </button>
        ) : playerState === "error" ? (
          <div className="space-y-4">
            <p className="text-red-400 text-xs text-center font-medium bg-red-500/5 py-2 rounded-lg border border-red-500/20 px-3">
              {error}
            </p>
            <button onClick={handleRetry} className="btn-primary w-full py-4">
              Riprova
            </button>
          </div>
        ) : playerState === "waiting" ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-surface-500 text-xs text-center font-medium px-4">
              Resterai connesso automaticamente alla diretta non appena inizia.
            </p>
            <button
              onClick={() => navigate("/")}
              className="btn-ghost w-full py-3 text-sm"
            >
              Torna alla Home
            </button>
          </div>
        ) : playerState !== "loading" ? (
          <div className="flex flex-col items-center gap-8">
            {/* Huge Central Play/Pause Button */}
            <button
              onClick={handlePlayPause}
              className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl relative active:scale-90 ${
                playerState === "playing"
                  ? "bg-white text-surface-950 shadow-white/10"
                  : playerState === "buffering"
                    ? "bg-amber-500 text-white shadow-amber-900/40 animate-pulse"
                    : "bg-primary-600 text-white shadow-primary-900/40 hover:bg-primary-500"
              }`}
            >
              {playerState === "playing" ? (
                <svg
                  className="w-10 h-10"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : playerState === "buffering" ? (
                <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-10 h-10 ml-2"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Audio Legend & Action */}
            <div className="flex flex-col items-center gap-6">
              {!isLive && (
                <button
                  onClick={goLive}
                  className="px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] text-white
                                             bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 
                                             transition-all flex items-center gap-2 shadow-xl ring-1 ring-white/5 active:scale-95"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 5l7 7-7 7M5 5l7 7-7 7"
                    />
                  </svg>
                  Torna Live
                </button>
              )}

              <p className="text-surface-500 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 010-7.072m-2.828 9.9a9 9 0 010 12.728"
                  />
                </svg>
                {playerState === "playing"
                  ? isLive
                    ? "Audio Streaming Attivo"
                    : "Audio Streaming in differita"
                  : playerState === "buffering"
                    ? "Connessione in corso..."
                    : "Audio Streaming Pausato"}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
