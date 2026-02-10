import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Church, Cpu, Users, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Layout() {
    const { logout, user } = useAuth();

    return (
        <div className="min-h-screen flex bg-surface-950">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 bg-surface-900/50 backdrop-blur-xl flex flex-col sticky top-0 h-screen">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                        <Cpu size={18} className="text-white" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">VD Admin</span>
                </div>

                <nav className="flex-1 px-4 py-4 space-y-1">
                    <SidebarLink to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
                    <SidebarLink to="/churches" icon={<Church size={20} />} label="Chiese" />
                    <SidebarLink to="/machines" icon={<Cpu size={20} />} label="Macchine ST1" />
                    <SidebarLink to="/priests" icon={<Users size={20} />} label="Sacerdoti" />
                </nav>

                <div className="p-4 border-t border-white/5 space-y-4">
                    <div className="px-2 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold ring-2 ring-primary-500/20">
                            {user?.username?.[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{user?.username}</p>
                            <p className="text-[10px] text-surface-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-surface-400 hover:text-red-400 transition-colors text-sm font-medium rounded-lg hover:bg-red-500/5"
                    >
                        <LogOut size={18} />
                        Esci
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="max-w-6xl mx-auto p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

function SidebarLink({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${isActive ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20' : 'text-surface-400 hover:text-white hover:bg-white/5'}`}
        >
            {icon}
            {label}
        </NavLink>
    );
}
