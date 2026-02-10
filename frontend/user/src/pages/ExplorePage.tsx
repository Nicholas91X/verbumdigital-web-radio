import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api/client';
import type { Church } from '@shared/api/types';

export default function ExplorePage() {
    const [churches, setChurches] = useState<Church[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchChurches = useCallback(async () => {
        try {
            const query = search ? `?search=${encodeURIComponent(search)}` : '';
            const data = await api.get<{ churches: Church[] }>(`/user/churches${query}`);
            setChurches(data.churches || []);
        } catch {
            //
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => {
        setLoading(true);
        const debounce = setTimeout(fetchChurches, 300);
        return () => clearTimeout(debounce);
    }, [fetchChurches]);

    return (
        <div className="px-4 py-6 space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold">Esplora</h1>
                <p className="text-surface-400 text-sm mt-0.5">Trova la tua parrocchia</p>
            </div>

            {/* Search */}
            <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input pl-10"
                    placeholder="Cerca per nome..."
                />
            </div>

            {/* Results */}
            {loading ? (
                <Loading />
            ) : churches.length === 0 ? (
                <div className="text-center text-surface-400 py-12">
                    {search ? 'Nessun risultato' : 'Nessuna chiesa disponibile'}
                </div>
            ) : (
                <div className="space-y-3">
                    {churches.map((church) => (
                        <Link
                            key={church.id}
                            to={`/churches/${church.id}`}
                            className="card flex items-center gap-4 hover:border-surface-600 transition-colors"
                        >
                            {/* Avatar */}
                            <div className="w-12 h-12 rounded-xl bg-surface-700 flex items-center justify-center shrink-0 overflow-hidden">
                                {church.logo_url ? (
                                    <img src={church.logo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <svg className="w-6 h-6 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{church.name}</p>
                                {church.address && (
                                    <p className="text-surface-500 text-sm truncate mt-0.5">{church.address}</p>
                                )}
                            </div>

                            {/* Live badge */}
                            {church.streaming_active && (
                                <span className="badge-live shrink-0">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5 animate-pulse" />
                                    LIVE
                                </span>
                            )}

                            {/* Chevron */}
                            <svg className="w-4 h-4 text-surface-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
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