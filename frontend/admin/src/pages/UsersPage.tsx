import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@shared/api/client';
import type { UserWithMetrics } from '@shared/api/types';
import Modal from '@/components/Modal';

type SortField = 'name' | 'email' | 'subscriptions' | 'donations' | 'total' | 'listening' | 'date';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'grid';
type UserStatus = 'all' | 'active' | 'inactive';

export default function UsersPage() {
    const [users, setUsers] = useState<UserWithMetrics[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Actions State
    const [deleteTarget, setDeleteTarget] = useState<UserWithMetrics | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserWithMetrics | null>(null);
    
    // Filters State
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<UserStatus>('all');
    const [minSubscriptions, setMinSubscriptions] = useState<string>('');
    const [maxSubscriptions, setMaxSubscriptions] = useState<string>('');
    const [minDonations, setMinDonations] = useState<string>('');
    const [maxDonations, setMaxDonations] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    // Sorting & View State
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [viewMode, setViewMode] = useState<ViewMode>('table');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const fetchData = useCallback(async () => {
        try {
            const data = await api.get<{ users: UserWithMetrics[] }>('/admin/users');
            setUsers(data.users || []);
        } catch {
            //
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/admin/users/${deleteTarget.id}`);
            setDeleteTarget(null);
            if (selectedUser?.id === deleteTarget.id) setSelectedUser(null);
            fetchData();
        } catch {
            //
        } finally {
            setDeleting(false);
        }
    };

    const formatCents = (cents: number) => {
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const resetFilters = () => {
        setSearch('');
        setStatusFilter('all');
        setMinSubscriptions('');
        setMaxSubscriptions('');
        setMinDonations('');
        setMaxDonations('');
    };

    const filteredAndSorted = useMemo(() => {
        let result = users.filter(u => {
            if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
            if (statusFilter === 'active' && u.listening_minutes === 0) return false;
            if (statusFilter === 'inactive' && u.listening_minutes > 0) return false;
            if (minSubscriptions && u.subscription_count < parseInt(minSubscriptions)) return false;
            if (maxSubscriptions && u.subscription_count > parseInt(maxSubscriptions)) return false;
            if (minDonations && u.donation_total < parseFloat(minDonations) * 100) return false;
            if (maxDonations && u.donation_total > parseFloat(maxDonations) * 100) return false;
            return true;
        });

        result.sort((a, b) => {
            let valA: any = a[sortField as keyof UserWithMetrics] ?? 0;
            let valB: any = b[sortField as keyof UserWithMetrics] ?? 0;

            if (sortField === 'date') {
                valA = new Date(a.created_at).getTime();
                valB = new Date(b.created_at).getTime();
            } else if (sortField === 'subscriptions') {
                valA = a.subscription_count;
                valB = b.subscription_count;
            } else if (sortField === 'donations') {
                valA = a.donation_count;
                valB = b.donation_count;
            } else if (sortField === 'total') {
                valA = a.donation_total;
                valB = b.donation_total;
            } else if (sortField === 'listening') {
                valA = a.listening_minutes;
                valB = b.listening_minutes;
            } else if (sortField === 'name' || sortField === 'email') {
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
            }

            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [users, search, statusFilter, minSubscriptions, maxSubscriptions, minDonations, maxDonations, sortField, sortDir]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, statusFilter, minSubscriptions, maxSubscriptions, minDonations, maxDonations, sortField, sortDir]);

    const paginated = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredAndSorted.slice(start, start + itemsPerPage);
    }, [filteredAndSorted, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredAndSorted.length / itemsPerPage);

    const exportCSV = () => {
        if (filteredAndSorted.length === 0) return;
        const headers = ["ID", "Nome", "Email", "Iscrizioni", "Num Donazioni", "Totale Donato (EUR)", "Minuti Ascolto", "Data Registrazione"];
        const rows = filteredAndSorted.map(u => [
            u.id.toString(),
            `"${u.name.replace(/"/g, '""')}"`,
            `"${u.email.replace(/"/g, '""')}"`,
            u.subscription_count.toString(),
            u.donation_count.toString(),
            (u.donation_total / 100).toFixed(2),
            u.listening_minutes.toString(),
            new Date(u.created_at).toISOString()
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `utenti_export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <span className="w-4 h-4 opacity-0 group-hover:opacity-30 transition-opacity">↓</span>;
        return <span className="text-primary-400 font-bold w-4 h-4">{sortDir === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 pb-24">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Utenti</h1>
                    <p className="text-surface-400 text-sm mt-0.5">
                        Gestione utenti e metriche di ascolto
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={exportCSV} className="btn-ghost" title="Esporta in CSV">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="hidden sm:inline">Esporta</span>
                    </button>
                    <div className="hidden lg:flex bg-surface-900 rounded-xl p-1 border border-white/5">
                        <button 
                            onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-surface-800 text-white shadow-sm' : 'text-surface-500 hover:text-white'}`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                        </button>
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-surface-800 text-white shadow-sm' : 'text-surface-500 hover:text-white'}`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                </div>
            ) : (
                <div className="space-y-6 pb-12">
                    {/* SUMMARY STATS */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard 
                            label="Utenti totali" value={users.length} colorClass="text-primary-400 bg-primary-400/10"
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                        />
                        <StatCard 
                            label="Iscrizioni totali" value={users.reduce((a, u) => a + u.subscription_count, 0)} colorClass="text-purple-400 bg-purple-400/10"
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>}
                        />
                        <StatCard 
                            label="Donazioni totali" value={formatCents(users.reduce((a, u) => a + u.donation_total, 0))} colorClass="text-emerald-400 bg-emerald-400/10"
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        />
                        <StatCard 
                            label="Ore di ascolto" value={Math.round(users.reduce((a, u) => a + u.listening_minutes, 0) / 60)} colorClass="text-sky-400 bg-sky-400/10"
                            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
                        />
                    </div>

                    {/* FILTERS AREA */}
                    <div className="card p-4 space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 justify-between">
                            <div className="relative flex-1 max-w-sm">
                                <input
                                    type="text"
                                    placeholder="Cerca per nome o email..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="input pl-10"
                                />
                                <svg className="w-5 h-5 text-surface-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            
                            <button 
                                onClick={() => setShowFilters(!showFilters)} 
                                className={`btn-ghost border ${showFilters ? 'border-primary-500 text-primary-400 bg-primary-500/10' : 'border-white/5 opacity-80'}`}
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                <span className="hidden sm:inline">Filtri Avanzati</span>
                            </button>
                        </div>
                        
                        {showFilters && (
                            <div className="pt-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-surface-500">Stato Utente</label>
                                    <select 
                                        value={statusFilter} 
                                        onChange={(e) => setStatusFilter(e.target.value as UserStatus)} 
                                        className="input"
                                    >
                                        <option value="all">Tutti</option>
                                        <option value="active">Attivi (Con ascolto)</option>
                                        <option value="inactive">Inattivi (Senza ascolto)</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-surface-500">Iscrizioni</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" min="0" placeholder="Min" value={minSubscriptions} onChange={e => setMinSubscriptions(e.target.value)} className="input w-full" />
                                        <span className="text-surface-500">-</span>
                                        <input type="number" min="0" placeholder="Max" value={maxSubscriptions} onChange={e => setMaxSubscriptions(e.target.value)} className="input w-full" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-surface-500">Donazioni Totali (€)</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" min="0" placeholder="Min" value={minDonations} onChange={e => setMinDonations(e.target.value)} className="input w-full" />
                                        <span className="text-surface-500">-</span>
                                        <input type="number" min="0" placeholder="Max" value={maxDonations} onChange={e => setMaxDonations(e.target.value)} className="input w-full" />
                                    </div>
                                </div>
                                {(search || statusFilter !== 'all' || minSubscriptions || maxSubscriptions || minDonations || maxDonations) && (
                                    <div className="lg:col-span-3 flex justify-end">
                                        <button onClick={resetFilters} className="text-surface-400 hover:text-white text-sm font-medium transition-colors">
                                            Rimuovi tutti i filtri
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {filteredAndSorted.length === 0 ? (
                        <div className="card text-surface-500 text-sm font-medium text-center py-12 border-dashed border-2 border-white/5 bg-transparent shadow-none">
                            Nessun utente trovato con questi filtri
                        </div>
                    ) : (
                        <>
                            {/* Sort controls for mobile only */}
                            <div className="lg:hidden flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-surface-500">Ordina per:</span>
                                <select 
                                    className="input py-2 flex-1 text-sm"
                                    value={sortField}
                                    onChange={(e) => setSortField(e.target.value as SortField)}
                                >
                                    <option value="date">Data Registrazione</option>
                                    <option value="name">Nome</option>
                                    <option value="subscriptions">Iscrizioni</option>
                                    <option value="donations">Numero Donazioni</option>
                                    <option value="total">Importo Donato</option>
                                    <option value="listening">Minuti Ascolto</option>
                                </select>
                                <button className="btn-ghost px-3 aspect-square" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
                                    {sortDir === 'asc' ? '↑' : '↓'}
                                </button>
                            </div>

                            {/* DESKTOP TABLE */}
                            {viewMode === 'table' && (
                                <div className="hidden lg:block card p-0 overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-surface-900/50">
                                            <tr>
                                                <th className="table-header cursor-pointer group hover:bg-surface-800 transition-colors" onClick={() => handleSort('name')}>
                                                    <div className="flex items-center gap-2">Nome <SortIcon field="name" /></div>
                                                </th>
                                                <th className="table-header cursor-pointer group hover:bg-surface-800 transition-colors" onClick={() => handleSort('email')}>
                                                    <div className="flex items-center gap-2">Email <SortIcon field="email" /></div>
                                                </th>
                                                <th className="table-header cursor-pointer group hover:bg-surface-800 transition-colors text-center" onClick={() => handleSort('subscriptions')}>
                                                    <div className="flex items-center justify-center gap-2"><SortIcon field="subscriptions" /> Iscr.</div>
                                                </th>
                                                <th className="table-header cursor-pointer group hover:bg-surface-800 transition-colors text-center" onClick={() => handleSort('donations')}>
                                                    <div className="flex items-center justify-center gap-2"><SortIcon field="donations" /> Donaz.</div>
                                                </th>
                                                <th className="table-header cursor-pointer group hover:bg-surface-800 transition-colors text-right" onClick={() => handleSort('total')}>
                                                    <div className="flex items-center justify-end gap-2"><SortIcon field="total" /> Totale</div>
                                                </th>
                                                <th className="table-header cursor-pointer group hover:bg-surface-800 transition-colors text-right" onClick={() => handleSort('listening')}>
                                                    <div className="flex items-center justify-end gap-2"><SortIcon field="listening" /> Ascolto</div>
                                                </th>
                                                <th className="table-header cursor-pointer group hover:bg-surface-800 transition-colors" onClick={() => handleSort('date')}>
                                                    <div className="flex items-center gap-2">Registrato <SortIcon field="date" /></div>
                                                </th>
                                                <th className="table-header"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {paginated.map((u) => (
                                                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setSelectedUser(u)}>
                                                    <td className="table-cell font-bold text-white">{u.name}</td>
                                                    <td className="table-cell text-surface-400 font-medium">{u.email}</td>
                                                    <td className="table-cell text-surface-400 text-center font-bold">
                                                        {u.subscription_count > 0 ? <span className="badge badge-warning">{u.subscription_count}</span> : '—'}
                                                    </td>
                                                    <td className="table-cell text-surface-400 text-center font-bold">
                                                        {u.donation_count > 0 ? <span className="badge badge-success">{u.donation_count}</span> : '—'}
                                                    </td>
                                                    <td className="table-cell font-mono text-surface-400 text-xs text-right">
                                                        {u.donation_total > 0 ? formatCents(u.donation_total) : '—'}
                                                    </td>
                                                    <td className="table-cell font-mono text-surface-400 text-xs text-right">
                                                        {u.listening_minutes > 0 ? formatMinutes(u.listening_minutes) : '—'}
                                                    </td>
                                                    <td className="table-cell text-surface-400 text-xs font-mono">
                                                        {new Date(u.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </td>
                                                    <td className="table-cell text-right" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => setDeleteTarget(u)}
                                                            className="text-surface-600 hover:text-red-400 transition-colors p-2"
                                                            title="Elimina utente"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* MOBILE LIST / DESKTOP GRID VIEW */}
                            <div className={`
                                grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 
                                ${viewMode === 'table' ? 'lg:hidden' : ''}
                            `}>
                                {paginated.map((u) => (
                                    <div key={u.id} className="card p-5 space-y-4 hover:border-white/20 cursor-pointer active:scale-[0.98] transition-all" onClick={() => setSelectedUser(u)}>
                                            <div className="flex justify-between items-start">
                                                <div className="min-w-0 pr-4">
                                                    <h3 className="font-extrabold text-white text-lg truncate">{u.name}</h3>
                                                    <p className="text-surface-500 text-[10px] font-bold uppercase tracking-widest mt-1 truncate">{u.email}</p>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(u); }}
                                                    className="bg-surface-800/50 hover:bg-red-500/10 text-surface-500 hover:text-red-400 transition-colors shrink-0 p-2 rounded-lg"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 py-3 border-y border-white/5">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">Iscrizioni</span>
                                                    <p className="text-xs font-mono text-surface-300">
                                                        {u.subscription_count > 0 ? <span className="badge badge-warning">{u.subscription_count}</span> : '—'}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">Donazioni</span>
                                                    <p className="text-xs font-mono text-surface-300">
                                                        {u.donation_count > 0 ? <span className="badge badge-success">{u.donation_count} ({formatCents(u.donation_total)})</span> : '—'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">Ascolto</span>
                                                    <p className="text-xs font-mono text-surface-300">
                                                        {u.listening_minutes > 0 ? formatMinutes(u.listening_minutes) : '—'}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">Registrato</span>
                                                    <p className="text-xs font-mono text-surface-300">
                                                        {new Date(u.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                ))}
                            </div>

                            {/* PAGINATION */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between border-t border-white/5 pt-6 mt-4">
                                    <button 
                                        className="btn-ghost text-sm" 
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(p => p - 1)}
                                    >
                                        Precedente
                                    </button>
                                    <span className="text-surface-400 text-sm font-medium">Pagina {currentPage} di {totalPages}</span>
                                    <button 
                                        className="btn-ghost text-sm" 
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(p => p + 1)}
                                    >
                                        Successiva
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* User Details Modal */}
            {selectedUser && (
                <Modal open={!!selectedUser} onClose={() => setSelectedUser(null)} title="Dettaglio Utente">
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 border-b border-surface-800 pb-5">
                            <div className="w-16 h-16 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-2xl font-black shrink-0">
                                {selectedUser.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-white text-xl truncate">{selectedUser.name}</h3>
                                <p className="text-surface-400 text-sm font-mono">{selectedUser.email}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-surface-900 border border-white/5 rounded-xl p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-surface-500 mb-1">Registrazione</p>
                                <p className="text-sm text-white font-medium">{new Date(selectedUser.created_at).toLocaleString('it-IT')}</p>
                            </div>
                            <div className="bg-surface-900 border border-white/5 rounded-xl p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-surface-500 mb-1">Ultimo Ascolto</p>
                                <p className="text-sm text-white font-medium">{selectedUser.listening_minutes > 0 ? formatMinutes(selectedUser.listening_minutes) + " totali" : 'Mai ascoltato'}</p>
                            </div>
                        </div>

                        <div className="card bg-surface-900/50 p-0 overflow-hidden divide-y divide-white/5">
                            <div className="p-4 flex justify-between items-center bg-purple-500/5">
                                <span className="text-sm font-bold text-surface-300">Iscrizioni Parrocchie</span>
                                <span className="text-lg font-black text-white">{selectedUser.subscription_count}</span>
                            </div>
                            <div className="p-4 flex justify-between items-center bg-emerald-500/5">
                                <div className="space-y-0.5">
                                    <span className="block text-sm font-bold text-surface-300">Donazioni Effettuate</span>
                                    <span className="block text-xs font-mono text-surface-500">{selectedUser.donation_count} transazioni</span>
                                </div>
                                <span className="text-lg font-black text-emerald-400">{formatCents(selectedUser.donation_total)}</span>
                            </div>
                        </div>

                        <div className="flex justify-endpt-4">
                            <button 
                                onClick={() => {
                                    setDeleteTarget(selectedUser);
                                    // Non chiudo il modale automaticamente per mostrare l'overlay di cancellazione
                                }} 
                                className="w-full btn-danger"
                            >
                                Cortocircuita Profilo (Elimina)
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Delete confirmation modal */}
            {deleteTarget && (
                <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Conferma Eliminazione">
                    <p className="text-surface-400 text-sm">
                        Eliminare definitivamente <strong className="text-white">{deleteTarget.name}</strong> ({deleteTarget.email})?
                        <br/><br/>
                        Verranno rimossi in modo permanente anche tutte le sue iscrizioni, lo storico donazioni (se presente) e i dati di ascolto da lui registrati.
                    </p>
                    <div className="flex justify-end gap-3 mt-8">
                        <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
                            Annulla
                        </button>
                        <button onClick={handleDelete} disabled={deleting} className="btn-danger">
                            {deleting ? 'Eliminazione...' : 'Conferma Eliminazione'}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

function StatCard({ label, value, icon, colorClass = "text-white" }: { label: string; value: string | number, icon?: React.ReactNode, colorClass?: string }) {
    return (
        <div className="card p-5 relative overflow-hidden group">
            <div className="space-y-2 relative z-10">
                <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">{label}</span>
                <p className={`text-2xl font-black ${colorClass.split(' ')[0]}`}>{value}</p>
            </div>
            {icon && (
                <div className={`absolute -right-4 -bottom-4 w-24 h-24 opacity-10 group-hover:-translate-y-1 group-hover:-translate-x-1 transition-transform duration-500 flex items-center justify-center ${colorClass}`}>
                    {icon}
                </div>
            )}
        </div>
    );
}

function formatMinutes(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
