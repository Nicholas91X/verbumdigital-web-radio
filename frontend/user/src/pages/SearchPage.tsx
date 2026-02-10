import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { api } from '@shared/api/client';
import type { Church } from '@shared/api/types';

export default function SearchPage() {
    const [search, setSearch] = useState('');
    const [churches, setChurches] = useState<Church[]>([]);
    const [loading, setLoading] = useState(false);
    const [subscribedIds, setSubscribedIds] = useState<Set<number>>(new Set());

    const fetchChurches = useCallback(async (query: string) => {
        setLoading(true);
        try {
            const data = await api.get<{ churches: Church[] }>(`/user/churches?search=${query}`);
            setChurches(data.churches || []);

            // Check current subscriptions to show who is already followed
            const subsData = await api.get<{ subscriptions: any[] }>('/user/subscriptions');
            setSubscribedIds(new Set(subsData.subscriptions.map(s => s.church_id)));
        } catch (err) {
            // handle error
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchChurches(search);
        }, 300);
        return () => clearTimeout(timer);
    }, [search, fetchChurches]);

    const handleSubscribe = async (churchId: number) => {
        try {
            await api.post(`/user/churches/${churchId}/subscribe`);
            setSubscribedIds(prev => new Set([...prev, churchId]));
        } catch (err) {
            // handle error
        }
    };

    return (
        <div className="px-4 py-6 space-y-6">
            <h1 className="text-2xl font-bold">Cerca Parrocchie</h1>

            {/* Search Input */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 group-focus-within:text-primary-500 transition-colors" size={20} />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cerca per nome o città..."
                    className="input pl-12 py-4 text-base"
                />
            </div>

            {/* Results */}
            <div className="grid gap-4">
                {churches.map(church => (
                    <div key={church.id} className="card flex items-center gap-4">
                        <div className="w-16 h-16 bg-surface-800 rounded-2xl overflow-hidden flex-shrink-0">
                            {church.logo_url && <img src={church.logo_url} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg truncate">{church.name}</h3>
                            <p className="text-sm text-surface-400 truncate">{church.address || 'Località non specificata'}</p>
                        </div>

                        {subscribedIds.has(church.id) ? (
                            <div className="p-3 text-primary-500 bg-primary-500/10 rounded-xl">
                                <Check size={20} />
                            </div>
                        ) : (
                            <button
                                onClick={() => handleSubscribe(church.id)}
                                className="p-3 bg-surface-800 hover:bg-surface-700 text-white rounded-xl transition-colors"
                            >
                                <Plus size={20} />
                            </button>
                        )}
                    </div>
                ))}

                {!loading && churches.length === 0 && search && (
                    <div className="text-center py-20 text-surface-500 italic">
                        Nessun risultato trovato per "{search}"
                    </div>
                )}
            </div>
        </div>
    );
}
