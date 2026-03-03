import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api/client';
import type { SubscriptionEntry } from '@shared/api/types';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
    const { user } = useAuth();
    const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSubscriptions = useCallback(async () => {
        try {
            const data = await api.get<{ subscriptions: SubscriptionEntry[] }>('/user/subscriptions');
            setSubscriptions(data.subscriptions || []);
        } catch {
            // Error handled silently
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubscriptions();
        // Poll every 30s for live status changes
        const interval = setInterval(fetchSubscriptions, 30000);
        return () => clearInterval(interval);
    }, [fetchSubscriptions]);

    const liveCount = subscriptions.filter((s) => s.streaming_active).length;

    return (
        <div className="px-4 py-8 max-w-lg mx-auto space-y-8 pb-24">
            {/* Elegant Header */}
            <header className="space-y-1">
                <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                    Ciao, {user?.name?.split(' ')[0] || 'Benvenuto'}
                </h1>
                {liveCount > 0 ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 backdrop-blur-md mt-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                        <span className="text-red-400 text-sm font-semibold tracking-wide uppercase">
                            {liveCount} {liveCount === 1 ? 'diretta attiva' : 'dirette attive'}
                        </span>
                    </div>
                ) : (
                    <p className="text-slate-400 text-base font-medium">Le tue parrocchie</p>
                )}
            </header>

            {/* Content Area */}
            {loading ? (
                <Loading />
            ) : subscriptions.length === 0 ? (
                <div className="card-glass text-center py-16 space-y-5 flex flex-col items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-2 shadow-inner border border-white/10">
                        <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white mb-2">Nessuna parrocchia</h3>
                        <p className="text-slate-400 text-sm max-w-[250px] mx-auto leading-relaxed">
                            Cerca e segui la tua parrocchia per ricevere notifiche quando va in onda.
                        </p>
                    </div>
                    <Link to="/explore" className="btn-primary w-full max-w-[200px] mt-4 shadow-xl">
                        Esplora
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Sort handling: Live ones first */}
                    {subscriptions
                        .sort((a, b) => (b.streaming_active ? 1 : 0) - (a.streaming_active ? 1 : 0))
                        .map((sub) => (
                            <SubscriptionCard key={sub.subscription_id} subscription={sub} />
                        ))}
                </div>
            )}
        </div>
    );
}

// ============================================
// Premium Subscription Card
// ============================================

function SubscriptionCard({ subscription: sub }: { subscription: SubscriptionEntry }) {
    const isLive = sub.streaming_active;

    return (
        <Link
            to={isLive ? `/listen/${sub.church_id}` : `/churches/${sub.church_id}`}
            className={`block relative overflow-hidden rounded-3xl transition-all duration-300 active:scale-[0.98]
                ${isLive
                    ? 'bg-gradient-to-br from-red-950/40 to-slate-900 border border-red-500/30 shadow-[0_8px_32px_0_rgba(239,68,68,0.15)]'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
        >
            {/* Live Glow Effect */}
            {isLive && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[40px] rounded-full pointer-events-none" />
            )}

            <div className="p-4 flex items-center gap-5 relative z-10">
                {/* Artwork / Avatar */}
                <div className={`w-20 h-20 shrink-0 rounded-2xl overflow-hidden flex items-center justify-center relative shadow-lg
                    ${isLive ? 'border-2 border-red-500/50' : 'border border-white/10 bg-slate-800'}
                `}>
                    {sub.church_logo_url ? (
                        <img src={sub.church_logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    )}
                    
                    {/* Live indicator embedded in artwork */}
                    {isLive && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                            <div className="w-8 h-8 rounded-full bg-red-500/80 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.8)] backdrop-blur-md">
                                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            </div>
                        </div>
                    )}
                </div>

                {/* Text Info */}
                <div className="flex-1 min-w-0 py-1">
                    <h3 className={`font-bold text-lg truncate mb-1 ${isLive ? 'text-white' : 'text-slate-200'}`}>
                        {sub.church_name}
                    </h3>
                    
                    {isLive ? (
                        <p className="text-red-400 text-sm font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                            In diretta ora
                        </p>
                    ) : (
                        <p className="text-slate-500 text-sm font-medium">
                            Tocca per i dettagli
                        </p>
                    )}
                </div>
            </div>
        </Link>
    );
}

// ============================================
// Loading
// ============================================

function Loading() {
    return (
        <div className="flex justify-center py-20">
            <div className="relative">
                <div className="w-12 h-12 rounded-full absolute border-4 border-solid border-white/10" />
                <div className="w-12 h-12 rounded-full animate-spin absolute border-4 border-solid border-primary-500 border-t-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
            </div>
        </div>
    );
}