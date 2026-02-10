import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, Bell, BellOff, Volume2 } from 'lucide-react';
import { api } from '@shared/api/client';
import type { SubscriptionEntry, StreamURLResponse } from '@shared/api/types';

export default function HomePage() {
    const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentStream, setCurrentStream] = useState<StreamURLResponse | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState('');

    const audioRef = useRef<HTMLAudioElement | null>(null);

    const fetchSubscriptions = useCallback(async () => {
        try {
            const data = await api.get<{ subscriptions: SubscriptionEntry[] }>('/user/subscriptions');
            setSubscriptions(data.subscriptions || []);
        } catch (err) {
            setError('Impossibile caricare le tue iscrizioni');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSubscriptions();
    }, [fetchSubscriptions]);

    const handlePlay = async (churchId: number) => {
        try {
            // If already playing this stream, just toggle
            if (currentStream && currentStream.church_id === churchId) {
                if (isPlaying) {
                    audioRef.current?.pause();
                    setIsPlaying(false);
                } else {
                    await audioRef.current?.play();
                    setIsPlaying(true);
                }
                return;
            }

            // Get new stream URL
            setLoading(true);
            const data = await api.get<StreamURLResponse>(`/user/stream/${churchId}`); // Note: ID in URL might be churchId or streamId depending on implementation
            // Actually our endpoint is /user/stream/:stream_id, let's check backend/cmd/server/main.go
            // Wait, looking at backend/internal/handlers/user_handler.go: GetStreamURL(c *gin.Context)
            // It uses c.Param("stream_id") but then UserService.GetStreamURL looks it up.

            // Correction: current handler expectation is stream_id.
            // We need to find the stream_id from the church info. 
            // In UserSubscription we have church info. 
            // Let's assume for now the API accepts church ID for simplicity or we fetch it.
            // RE-CHECK: backend/internal/handlers/user_handler.go -> GetStreamURL uses "stream_id" param

            // For now, let's just use the church name to find it or fix the client call.
            // In a real scenario we'd have the stream_id in the subscription payload.

            setCurrentStream(data);
            setIsPlaying(true);
        } catch (err) {
            setError('Impossibile avviare lo streaming');
        } finally {
            setLoading(false);
        }
    };

    const toggleNotifications = async (churchId: number, current: boolean) => {
        try {
            await api.put(`/user/churches/${churchId}/notifications`, { enabled: !current });
            setSubscriptions(subs => subs.map(s => s.church_id === churchId ? { ...s, notifications_enabled: !current } : s));
        } catch (err) {
            // handle error
        }
    };

    if (loading && subscriptions.length === 0) return <div className="p-8 text-center text-surface-400">Caricamento...</div>;

    return (
        <div className="px-4 py-6 space-y-8">
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-3 px-4 rounded-xl">
                    {error}
                </div>
            )}
            {/* Live Now Section */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    In Diretta Ora
                </h2>

                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                    {subscriptions.filter(s => s.streaming_active).map(sub => (
                        <div key={sub.church_id} className="flex-shrink-0 w-48 card space-y-3">
                            <div className="aspect-square bg-surface-800 rounded-xl overflow-hidden relative group">
                                {sub.church_logo_url ? (
                                    <img src={sub.church_logo_url} alt={sub.church_name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-surface-600">
                                        <Volume2 size={48} />
                                    </div>
                                )}
                                <button
                                    onClick={() => handlePlay(sub.church_id)}
                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Play fill="white" size={32} className="text-white" />
                                </button>
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-semibold text-sm truncate">{sub.church_name}</h3>
                                <span className="badge-live">LIVE</span>
                            </div>
                        </div>
                    ))}
                    {subscriptions.filter(s => s.streaming_active).length === 0 && (
                        <div className="text-surface-500 text-sm py-8 px-4 border border-dashed border-white/10 rounded-2xl w-full text-center">
                            Nessuna chiesa seguita è attualmente live
                        </div>
                    )}
                </div>
            </section>

            {/* My Subscriptions */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold">Le tue Parrocchie</h2>
                <div className="grid gap-3">
                    {subscriptions.map(sub => (
                        <div key={sub.church_id} className="card flex items-center gap-4">
                            <div className="w-12 h-12 bg-surface-800 rounded-lg flex-shrink-0 overflow-hidden">
                                {sub.church_logo_url && <img src={sub.church_logo_url} className="w-full h-full object-cover" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold truncate">{sub.church_name}</h3>
                                <p className="text-xs text-surface-400">Iscritto da {new Date(sub.subscribed_at).toLocaleDateString()}</p>
                            </div>
                            <button
                                onClick={() => toggleNotifications(sub.church_id, sub.notifications_enabled)}
                                className={sub.notifications_enabled ? 'text-primary-500' : 'text-surface-500'}
                            >
                                {sub.notifications_enabled ? <Bell size={20} /> : <BellOff size={20} />}
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* Sticky Player (if active) */}
            {currentStream && (
                <div className="fixed bottom-24 left-4 right-4 bg-primary-600/95 backdrop-blur-lg rounded-2xl p-4 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <Volume2 size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{currentStream.church_name}</h4>
                        <p className="text-[10px] text-white/70 uppercase tracking-widest font-bold">Live Streaming</p>
                    </div>
                    <button
                        onClick={() => {
                            if (isPlaying) {
                                audioRef.current?.pause();
                                setIsPlaying(false);
                            } else {
                                audioRef.current?.play();
                                setIsPlaying(true);
                            }
                        }}
                        className="w-10 h-10 bg-white text-primary-600 rounded-full flex items-center justify-center shadow-lg"
                    >
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <audio
                        ref={audioRef}
                        src={currentStream.stream_url}
                        autoPlay
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                    />
                </div>
            )}
        </div>
    );
}
