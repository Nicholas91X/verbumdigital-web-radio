import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Lock, User as UserIcon } from 'lucide-react';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login({ email, password });
            navigate('/', { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary-950 via-surface-950 to-surface-950">
            <div className="w-full max-w-md space-y-8 card p-10 bg-surface-900/40 border-white/5 shadow-2xl">
                <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-primary-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-primary-600/20 mb-6">
                        <Lock className="text-white" size={28} />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Accesso Admin</h1>
                    <p className="text-surface-500 text-sm">Pannello di controllo del sistema</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold py-3 px-4 rounded-xl text-center">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <div className="relative">
                            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-600" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input pl-12"
                                placeholder="Admin Email"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-600" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input pl-12"
                                placeholder="Password"
                                required
                            />
                        </div>
                    </div>

                    <button
                        disabled={loading}
                        className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 group"
                    >
                        {loading ? 'Accesso in corso...' : (
                            <>
                                Accedi al Pannello
                            </>
                        )}
                    </button>
                </form>

                <div className="text-center">
                    <p className="text-[10px] text-surface-600 uppercase font-bold tracking-[0.2em]">VerbumDigital Systems v1.0</p>
                </div>
            </div>
        </div>
    );
}
