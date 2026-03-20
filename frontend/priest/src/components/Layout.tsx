import { Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function Layout() {
    const { logout } = useAuth();

    return (
        <div className="min-h-screen flex flex-col bg-surface-950">
            {/* Header */}
            <header className="bg-surface-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-30 pt-safe">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-900/40">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-sm tracking-tight leading-none">VerbumDigital</span>
                        <span className="text-[10px] text-primary-500 font-bold uppercase tracking-widest mt-1">Dashboard Sacerdote</span>
                    </div>
                </div>

                <button
                    onClick={logout}
                    className="text-surface-400 hover:text-white transition-colors text-sm flex items-center gap-1.5"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Esci
                </button>
            </header>

            {/* Content */}
            <main className="flex-1">
                <Outlet />
            </main>
        </div>
    );
}