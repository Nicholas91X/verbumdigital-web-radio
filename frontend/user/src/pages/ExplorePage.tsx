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
        <div className="px-5 py-8 space-y-6 pb-32">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight">Esplora</h1>
                <p className="text-surface-500 text-sm font-medium mt-1">Trova la tua parrocchia</p>
            </div>

            {/* Search */}
            <div className="relative group">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500 transition-colors group-focus-within:text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input pl-12 h-14 text-base"
                    placeholder="Cerca per nome..."
                />
            </div>

            {/* Results */}
            {loading ? (
                <Loading />
            ) : churches.length === 0 ? (
                <div className="text-center py-20 bg-surface-900/50 rounded-3xl border border-surface-800">
                    <p className="text-surface-500 font-medium">
                        {search ? `Nessun risultato per "${search}"` : 'Inizia la ricerca'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {churches.map((church) => (
                        <Link
                            key={church.id}
                            to={`/churches/${church.id}`}
                            className="card group flex items-center gap-4 active:scale-[0.98] transition-all"
                        >
                            {/* Avatar */}
                            <div className="w-14 h-14 rounded-2xl bg-surface-800 border border-surface-700 flex items-center justify-center shrink-0 overflow-hidden group-hover:border-primary-500/30">
                                {church.logo_url ? (
                                    <img src={church.logo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <svg className="w-7 h-7 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-lg leading-tight truncate">{church.name}</p>
                                {church.address && (
                                    <p className="text-surface-500 text-xs font-semibold uppercase tracking-widest mt-1.5 truncate">{church.address}</p>
                                )}
                            </div>

                            {/* Live badge */}
                            {church.streaming_active && (
                                <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                    <span className="text-red-500 text-[9px] font-black uppercase tracking-tighter">Live</span>
                                </div>
                            )}

                            {/* Chevron */}
                            <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-surface-600 group-hover:text-primary-500 group-hover:bg-primary-500/10 transition-all">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
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