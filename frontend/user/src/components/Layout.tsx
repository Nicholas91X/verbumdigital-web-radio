import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function Layout() {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen flex flex-col pb-16">
            {/* Header */}
            <header className="bg-surface-800 border-b border-surface-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 010-7.072m-2.828 9.9a9 9 0 010-12.728" />
                        </svg>
                    </div>
                    <span className="font-semibold text-sm">VerbumDigital</span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-surface-400 text-xs hidden sm:block">{user?.name}</span>
                    <button
                        onClick={logout}
                        className="text-surface-400 hover:text-white transition-colors"
                        title="Esci"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1">
                <Outlet />
            </main>

            {/* Bottom Tab Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-surface-800 border-t border-surface-700 flex z-10 safe-area-bottom">
                <TabLink to="/" icon={<HomeIcon />} label="Home" end />
                <TabLink to="/explore" icon={<ExploreIcon />} label="Esplora" />
                <TabLink to="/subscriptions" icon={<HeartIcon />} label="Seguiti" />
            </nav>
        </div>
    );
}

// ============================================
// Tab link component
// ============================================

function TabLink({
    to,
    icon,
    label,
    end,
}: {
    to: string;
    icon: React.ReactNode;
    label: string;
    end?: boolean;
}) {
    return (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${isActive ? 'text-primary-400' : 'text-surface-500'
                }`
            }
        >
            {icon}
            <span>{label}</span>
        </NavLink>
    );
}

// ============================================
// Tab icons
// ============================================

function HomeIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
    );
}

function ExploreIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
    );
}

function HeartIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
    );
}