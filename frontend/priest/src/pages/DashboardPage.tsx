import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "@shared/api/client";
import type { Church, StreamStatus } from "@shared/api/types";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchChurches = useCallback(async () => {
    try {
      const data = await api.get<{ churches: Church[] }>("/priest/churches");
      setChurches(data.churches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento");
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
        <div className="relative">
          <div className="w-12 h-12 rounded-full absolute border-4 border-solid border-white/10" />
          <div className="w-12 h-12 rounded-full animate-spin absolute border-4 border-solid border-primary-500 border-t-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 py-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4 text-red-400 font-medium">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-8 space-y-8 pb-32">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          Ciao, {user?.name?.split(" ")[0] || "Padre"}
        </h1>
        <p className="text-surface-500 text-sm font-medium mt-1">
          Gestione parrocchie
        </p>
      </div>

      {/* Church list */}
      {churches.length === 0 ? (
        <div className="card text-center py-16 space-y-4 border-dashed border-2 border-surface-800 bg-transparent shadow-none">
          <div className="w-16 h-16 bg-surface-900 rounded-2xl flex items-center justify-center mx-auto border border-surface-800 text-surface-600">
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <p className="text-surface-500 text-sm font-medium">
            Nessuna chiesa assegnata al tuo profilo
          </p>
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
// Premium Church Card
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
        const status = await api.get<StreamStatus>(
          `/priest/churches/${church.id}/stream/status`,
        );
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
    <div
      className={`card group space-y-5 transition-all duration-300 relative overflow-hidden ${isLive ? "border-red-500/40 bg-red-500/[0.03] ring-1 ring-red-500/20" : ""}`}
    >
      {/* Live Indicator overlay */}
      {isLive && (
        <div className="absolute top-0 right-0 px-3 py-1 bg-red-500 text-[10px] font-black uppercase tracking-tighter text-white rounded-bl-xl z-20 shadow-lg">
          Live
        </div>
      )}

      {/* Church info */}
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <h2 className="font-extrabold text-xl tracking-tight truncate pr-16">
            {church.name}
          </h2>
          {church.address && (
            <p className="text-surface-500 text-[10px] uppercase font-bold tracking-widest mt-1.5 truncate">
              {church.address}
            </p>
          )}
        </div>
        {isLive ? (
          <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
          </div>
        ) : (
          <div className="w-10 h-10 bg-surface-800 rounded-full flex items-center justify-center border border-white/5">
            <div className="w-2.5 h-2.5 bg-surface-600 rounded-full" />
          </div>
        )}
      </div>

      {/* Status & Timer Section */}
      <div
        className={`flex items-center justify-between p-4 rounded-2xl ${isLive ? "bg-red-500/5 border border-red-500/10" : "bg-surface-800/50 border border-white/5"}`}
      >
        {/* Connection status */}
        <div className="space-y-1">
          <p
            className={`text-[10px] uppercase font-black tracking-widest ${isLive ? "text-red-500" : "text-surface-500"}`}
          >
            Status
          </p>
          <div className="text-sm font-bold flex items-center gap-2">
            <span>{isLive ? "In trasmissione" : "In attesa"}</span>
          </div>
        </div>

        {/* Streaming time & Donation Toggle */}
        {isLive && streamStatus?.session && (
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] uppercase font-black text-red-500/60 tracking-widest mb-1">
                Durata
              </p>
              <StreamTimer startedAt={streamStatus.session.started_at} />
            </div>

            {church.stripe_onboarding_complete && (
              <div className="h-10 w-px bg-white/5 mx-2 hidden sm:block" />
            )}

            {church.stripe_onboarding_complete && (
              <DonationControl 
                sessionId={streamStatus.session.id} 
                churchId={church.id}
                isActive={streamStatus.session.donation_active || false}
                onUpdate={() => {
                  // The parent fetches status every 10s, but we can trigger immediate refresh if needed
                  // but for now let the next poll catch it
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Read-only reminder */}
      {!isLive && (
        <div className="flex items-start gap-3 px-1">
          <div className="w-5 h-5 bg-surface-800 rounded-lg flex items-center justify-center shrink-0 border border-white/5">
            <svg
              className="w-3 h-3 text-surface-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-surface-500 text-[11px] font-medium leading-relaxed">
            La diretta viene gestita dall'hardware{" "}
            <span className="text-white font-bold">ST1</span>. Qui puoi
            monitorare lo stato in tempo reale.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 flex gap-3">
        <Link
          to={`/churches/${church.id}/sessions`}
          className="btn-ghost flex-1 py-3 text-xs font-black uppercase tracking-widest bg-surface-800/80 hover:bg-surface-800 hover:text-white"
        >
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Storico
        </Link>
        <Link
          to={`/churches/${church.id}/settings`}
          className="btn-ghost px-4 py-3 bg-surface-800/80 hover:bg-surface-800"
        >
          <svg
            className="w-4 h-4 text-surface-500 hover:text-white transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}

// ============================================
// Donation Control Component
// ============================================

interface DonationControlProps {
  sessionId: number;
  churchId: number;
  isActive: boolean;
  onUpdate: () => void;
}

function DonationControl({ sessionId, churchId, isActive, onUpdate }: DonationControlProps) {
  const [loading, setLoading] = useState(false);

  const toggleDonations = async () => {
    setLoading(true);
    try {
      if (isActive) {
        await api.post(`/priest/sessions/${sessionId}/donation/close`, {});
      } else {
        // Fetch presets to see if we have one to use
        const data = await api.get<{ presets: any[] }>(`/priest/churches/${churchId}/donation-presets`);
        const defaultPreset = data.presets?.find(p => p.is_default) || data.presets?.[0];

        if (!defaultPreset) {
          alert("Nessun preset di donazione configurato. Vai nelle impostazioni per crearne uno.");
          setLoading(false);
          return;
        }

        await api.post(`/priest/sessions/${sessionId}/donation/open`, {
          preset_id: defaultPreset.id
        });
      }
      onUpdate();
    } catch (err) {
      alert("Errore durante la modifica delle donazioni");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-right">
      <p className={`text-[10px] uppercase font-black tracking-widest mb-1 ${isActive ? "text-green-500" : "text-surface-500"}`}>
        Donazioni
      </p>
      <button
        onClick={toggleDonations}
        disabled={loading}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-tighter transition-all ${
          isActive 
            ? "bg-green-500/20 text-green-400 border border-green-500/30" 
            : "bg-surface-800 text-surface-400 border border-white/5"
        }`}
      >
        {loading ? (
          <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : (
          <div className={`w-2 h-2 rounded-full ${isActive ? "bg-green-500 animate-pulse" : "bg-surface-600"}`} />
        )}
        {isActive ? "Aperte" : "Chiuse"}
      </button>
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
    <div className="text-xl font-mono text-red-500 font-bold tabular-nums tracking-tighter">
      {formatDuration(elapsed)}
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
