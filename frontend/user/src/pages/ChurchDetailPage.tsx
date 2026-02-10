import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '@shared/api/client';
import type { SubscriptionEntry } from '@shared/api/types';

interface ChurchDetail {
    id: number;
    name: string;
    logo_url?: string;
    address?: string;
    streaming_active: boolean;
    subscriber_count: number;
}

export default function ChurchDetailPage() {
    const { churchId } = useParams<{ churchId: string }>();
    const navigate = useNavigate();

    const [church, setChurch] = useState<ChurchDetail | null>(null);
    const [subscription, setSubscription] = useState<SubscriptionEntry | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            // Fetch church detail
            const churchData = await api.get<ChurchDetail>(`/user/churches/${churchId}`);
            setChurch(churchData);

            // Check if subscribed
            const subData = await api.get<{ subscriptions: SubscriptionEntry[] }>('/user/subscriptions');
            const mySub = (subData.subscriptions || []).find(
                (s) => s.church_id === parseInt(churchId || '0')
            );
            setSubscription(mySub || null);
        } catch {
            //
        } finally {
            setLoading(false);
        }
    }, [churchId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSubscribe = async () => {
        setActionLoading(true);
        try {
            await api.post(`/user/churches/${churchId}/subscribe`);
            fetchData();
        } catch {
            //
        } finally {
            setActionLoading(false);
        }
    };

    const handleUnsubscribe = async () => {
        setActionLoading(true);
        try {
            await api.delete(`/user/churches/${churchId}/subscribe`);
            setSubscription(null);
        } catch {
            //
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleNotifications = async () => {
        if (!subscription) return;
        setActionLoading(true);
        try {
            await api.put(`/user/churches/${churchId}/notifications`, {
                enabled: !subscription.notifications_enabled,
            });
            fetchData();
        } catch {
            //
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            </div>
        );
    }

    if (!church) {
        return (
            <div className="px-4 py-8 text-center text-surface-400">
                Chiesa non trovata
            </div>
        );
    }

    const isSubscribed = !!subscription;

    return (
        <div className="px-4 py-6 space-y-6">
            {/* Back */}
            <button onClick={() => navigate(-1)} className="text-surface-400 hover:text-white transition-colors flex items-center gap-1.5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Indietro
            </button>

            {/* Church header */}
            <div className="text-center space-y-3">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-2xl bg-surface-700 flex items-center justify-center mx-auto overflow-hidden">
                    {church.logo_url ? (
                        <img src={church.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <svg className="w-10 h-10 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    )}
                </div>

                <div>
                    <h1 className="text-2xl font-bold">{church.name}</h1>
                    {church.address && (
                        <p className="text-surface-400 text-sm mt-1">{church.address}</p>
                    )}
                </div>

                {/* Stats */}
                <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                        <p className="text-lg font-bold">{church.subscriber_count}</p>
                        <p className="text-xs text-surface-500">Iscritti</p>
                    </div>
                    <div className="w-px h-8 bg-surface-700" />
                    <div className="text-center">
                        {church.streaming_active ? (
                            <>
                                <span className="badge-live">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5 animate-pulse" />
                                    LIVE
                                </span>
                                <p className="text-xs text-surface-500 mt-1">In diretta</p>
                            </>
                        ) : (
                            <>
                                <span className="badge-offline">Offline</span>
                                <p className="text-xs text-surface-500 mt-1">Non in onda</p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
                {/* Listen button (only when live + subscribed) */}
                {church.streaming_active && isSubscribed && (
                    <Link
                        to={`/listen/${church.id}`}
                        className="btn-primary w-full flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-600"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                        Ascolta in diretta
                    </Link>
                )}

                {/* Subscribe / Unsubscribe */}
                {isSubscribed ? (
                    <div className="flex gap-3">
                        <button
                            onClick={handleUnsubscribe}
                            disabled={actionLoading}
                            className="btn-outline flex-1"
                        >
                            Non seguire più
                        </button>
                        <button
                            onClick={handleToggleNotifications}
                            disabled={actionLoading}
                            className={`btn flex items-center justify-center gap-1.5 ${subscription?.notifications_enabled
                                    ? 'bg-primary-600/20 text-primary-400 hover:bg-primary-600/30'
                                    : 'bg-surface-700 text-surface-400 hover:bg-surface-600'
                                }`}
                            title={subscription?.notifications_enabled ? 'Notifiche attive' : 'Notifiche disattivate'}
                        >
                            {subscription?.notifications_enabled ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13.01V11a8 8 0 00-5-7.42M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            )}
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleSubscribe}
                        disabled={actionLoading}
                        className="btn-primary w-full"
                    >
                        {actionLoading ? 'Iscrizione...' : 'Segui questa chiesa'}
                    </button>
                )}
            </div>
        </div>
    );
}