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
            //
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
        <div className="px-5 py-8 space-y-8 pb-32">
            {/* Header / Greeting */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">Ciao, {user?.name?.split(' ')[0] || 'Benvenuto'}</h1>
                    <p className="text-surface-500 text-sm font-medium mt-1">
                        {liveCount > 0
                            ? `${liveCount} ${liveCount === 1 ? 'chiesa trasmette' : 'chiese trasmettono'} ora`
                            : 'Esplora le tue parrocchie'}
                    </p>
                </div>
                {liveCount > 0 && (
                    <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
                        <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                    </div>
                )}
            </div>

            {/* Content */}
            {loading ? (
                <Loading />
            ) : subscriptions.length === 0 ? (
                <div className="card text-center py-16 space-y-4 border-dashed border-2 border-surface-800 bg-transparent shadow-none">
                    <div className="w-16 h-16 bg-surface-900 rounded-2xl flex items-center justify-center mx-auto border border-surface-800">
                        <svg className="w-8 h-8 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-white font-bold text-lg">Inizia ad ascoltare</p>
                        <p className="text-surface-500 text-sm">Non segui ancora nessuna parrocchia</p>
                    </div>
                    <Link to="/explore" className="btn-primary w-full max-w-[200px] mx-auto">
                        Esplora ora
                    </Link>
                </div>
            ) : (
                <div className="space-y-4 pt-2">
                    {/* Live churches first */}
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
// Subscription Card
// ============================================

function SubscriptionCard({ subscription: sub }: { subscription: SubscriptionEntry }) {
    return (
        <Link
            to={sub.streaming_active ? `/listen/${sub.church_id}` : `/churches/${sub.church_id}`}
            className={`card group flex items-center gap-4 transition-all duration-300 relative overflow-hidden ${sub.streaming_active
                ? 'border-red-500/40 bg-red-500/[0.03] ring-1 ring-red-500/20'
                : 'hover:border-surface-600'
                }`}
        >
            {/* Live Indicator overlay for active state */}
            {sub.streaming_active && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-red-500 text-[10px] font-black uppercase tracking-tighter text-white rounded-bl-xl z-10 shadow-lg">
                    Live
                </div>
            )}

            {/* Church avatar */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border-2 transition-transform group-active:scale-95 ${sub.streaming_active ? 'border-red-500/30' : 'border-surface-800'
                }`}>
                {sub.church_logo_url ? (
                    <img src={sub.church_logo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-surface-800 flex items-center justify-center">
                        <svg className="w-7 h-7 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 py-1">
                <p className="font-bold text-lg leading-tight truncate pr-10">{sub.church_name}</p>
                {sub.streaming_active ? (
                    <div className="flex items-center gap-2 mt-1.5 translate-y-[-1px]">
                        <div className="flex items-center gap-1 text-red-500 text-[11px] font-bold uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                            <span>In onda</span>
                        </div>
                    </div>
                ) : (
                    <p className="text-surface-500 text-xs font-semibold uppercase tracking-widest mt-1.5">Offline</p>
                )}
            </div>

            {/* Action Arrow */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${sub.streaming_active ? 'bg-red-500 text-white' : 'bg-surface-800 text-surface-600'
                }`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </div>
        </Link>
    );
}

// ============================================
// Loading
// ============================================

function Loading() {
    return (
        <div className="flex justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
        </div>
    );
}