import { Outlet, NavLink } from 'react-router-dom';
import { Home, Search, BookMarked, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Layout() {
    const { logout } = useAuth();

    return (
        <div className="min-h-screen flex flex-col pb-20">
            {/* Header */}
            <header className="bg-surface-950/80 backdrop-blur-md border-b border-white/5 px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                    </div>
                    <span className="font-bold tracking-tight">VerbumDigital</span>
                </div>
                <button
                    onClick={logout}
                    className="p-2 text-surface-400 hover:text-white transition-colors"
                >
                    <UserIcon size={20} />
                </button>
            </header>

            {/* Content */}
            <main className="flex-1">
                <Outlet />
            </main>

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 bg-surface-900/90 backdrop-blur-xl border-t border-white/5 px-6 py-3 flex justify-between items-center z-20">
                <NavLink to="/" className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-primary-500' : 'text-surface-400 hover:text-white'}`}>
                    <Home size={22} />
                    <span className="text-[10px] font-medium uppercase tracking-wider">Home</span>
                </NavLink>

                <NavLink to="/search" className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-primary-500' : 'text-surface-400 hover:text-white'}`}>
                    <Search size={22} />
                    <span className="text-[10px] font-medium uppercase tracking-wider">Cerca</span>
                </NavLink>

                <NavLink to="/library" className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-primary-500' : 'text-surface-400 hover:text-white'}`}>
                    <BookMarked size={22} />
                    <span className="text-[10px] font-medium uppercase tracking-wider">Chiese</span>
                </NavLink>
            </nav>
        </div>
    );
}
