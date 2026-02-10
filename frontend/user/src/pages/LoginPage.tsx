import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

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
            setError(err instanceof Error ? err.message : 'Errore di login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-12 pb-8">
            <div className="w-full max-w-sm space-y-10">
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-primary-600 rounded-[2rem] mx-auto flex items-center justify-center shadow-xl shadow-primary-600/20 active:scale-95 transition-transform rotate-3">
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-extrabold tracking-tight">Bentornato</h1>
                        <p className="text-surface-400 font-medium">Accedi per ascoltare la tua parrocchia</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-red-400 text-sm font-medium animate-in shake">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-surface-200 ml-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input"
                            placeholder="tua@email.com"
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-surface-200 ml-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button disabled={loading} className="btn-primary w-full py-4 text-lg mt-2">
                        {loading ? 'Accesso in corso...' : 'Accedi'}
                    </button>

                    <p className="text-center text-surface-400 text-sm pt-4">
                        Non hai un account?{' '}
                        <Link to="/register" className="text-primary-400 font-bold hover:underline underline-offset-4">
                            Registrati ora
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
