import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api/client';
import type { SubscriptionEntry } from '@shared/api/types';

export default function SubscriptionsPage() {
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
    }, [fetchSubscriptions]);

    const handleUnsubscribe = async (churchId: number) => {
        try {
            await api.delete(`/user/churches/${churchId}/subscribe`);
            setSubscriptions((prev) => prev.filter((s) => s.church_id !== churchId));
        } catch {
            //
        }
    };

    const handleToggleNotifications = async (churchId: number, currentEnabled: boolean) => {
        try {
            await api.put(`/user/churches/${churchId}/notifications`, {
                enabled: !currentEnabled,
            });
            setSubscriptions((prev) =>
                prev.map((s) =>
                    s.church_id === churchId
                        ? { ...s, notifications_enabled: !currentEnabled }
                        : s
                )
            );
        } catch {
            //
        }
    };

    return (
        <div className="px-4 py-6 space-y-5">
            <div>
                <h1 className="text-xl font-bold">Chiese seguite</h1>
                <p className="text-surface-400 text-sm mt-0.5">
                    {subscriptions.length} {subscriptions.length === 1 ? 'iscrizione' : 'iscrizioni'}
                </p>
            </div>

            {loading ? (
                <Loading />
            ) : subscriptions.length === 0 ? (
                <div className="card text-center py-12 space-y-3">
                    <svg className="w-12 h-12 text-surface-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <p className="text-surface-400">Non segui ancora nessuna parrocchia</p>
                    <Link to="/explore" className="btn-primary inline-block">
                        Esplora le chiese
                    </Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {subscriptions.map((sub) => (
                        <div key={sub.subscription_id} className="card space-y-3">
                            {/* Church info row */}
                            <Link
                                to={`/churches/${sub.church_id}`}
                                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                            >
                                <div className="w-10 h-10 rounded-lg bg-surface-700 flex items-center justify-center shrink-0 overflow-hidden">
                                    {sub.church_logo_url ? (
                                        <img src={sub.church_logo_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <svg className="w-5 h-5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{sub.church_name}</p>
                                    <p className="text-xs text-surface-500">
                                        Seguita dal {new Date(sub.subscribed_at).toLocaleDateString('it-IT')}
                                    </p>
                                </div>
                                {sub.streaming_active && (
                                    <span className="badge-live shrink-0">
                                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5 animate-pulse" />
                                        LIVE
                                    </span>
                                )}
                            </Link>

                            {/* Actions row */}
                            <div className="flex items-center justify-between pt-2 border-t border-surface-700">
                                {/* Notification toggle */}
                                <button
                                    onClick={() =>
                                        handleToggleNotifications(sub.church_id, sub.notifications_enabled)
                                    }
                                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors ${sub.notifications_enabled
                                            ? 'text-primary-400 bg-primary-500/10'
                                            : 'text-surface-500 hover:text-surface-300'
                                        }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                    {sub.notifications_enabled ? 'Notifiche attive' : 'Notifiche off'}
                                </button>

                                {/* Unsubscribe */}
                                <button
                                    onClick={() => handleUnsubscribe(sub.church_id)}
                                    className="text-xs text-red-400 hover:text-red-300 px-2.5 py-1.5 rounded-md hover:bg-red-500/10 transition-colors"
                                >
                                    Rimuovi
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

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