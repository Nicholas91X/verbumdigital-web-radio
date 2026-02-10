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
        <div className="px-4 py-6 space-y-6">
            {/* Greeting */}
            <div>
                <h1 className="text-xl font-bold">Ciao, {user?.name || 'Benvenuto'}</h1>
                {liveCount > 0 ? (
                    <p className="text-red-400 text-sm mt-0.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                        {liveCount} {liveCount === 1 ? 'chiesa in diretta' : 'chiese in diretta'}
                    </p>
                ) : (
                    <p className="text-surface-400 text-sm mt-0.5">Le tue parrocchie</p>
                )}
            </div>

            {/* Content */}
            {loading ? (
                <Loading />
            ) : subscriptions.length === 0 ? (
                <div className="card text-center py-12 space-y-3">
                    <svg className="w-12 h-12 text-surface-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-surface-400">Non segui ancora nessuna parrocchia</p>
                    <Link to="/explore" className="btn-primary inline-block">
                        Esplora le chiese
                    </Link>
                </div>
            ) : (
                <div className="space-y-3">
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
            className={`card flex items-center gap-4 transition-colors ${sub.streaming_active
                    ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
                    : 'hover:border-surface-600'
                }`}
        >
            {/* Church avatar */}
            <div className="w-12 h-12 rounded-xl bg-surface-700 flex items-center justify-center shrink-0 overflow-hidden">
                {sub.church_logo_url ? (
                    <img src={sub.church_logo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                    <svg className="w-6 h-6 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{sub.church_name}</p>
                {sub.streaming_active ? (
                    <p className="text-red-400 text-sm flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                        In diretta — tocca per ascoltare
                    </p>
                ) : (
                    <p className="text-surface-500 text-sm mt-0.5">Offline</p>
                )}
            </div>

            {/* Play indicator */}
            {sub.streaming_active && (
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </div>
            )}
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