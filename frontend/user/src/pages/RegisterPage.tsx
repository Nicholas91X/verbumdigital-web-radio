import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await register({ name, email, password });
            navigate('/', { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore registrazione');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 pt-12 pb-8">
            <div className="w-full max-w-sm space-y-10">
                <div className="text-center space-y-4">
                    <h1 className="text-3xl font-extrabold tracking-tight">Crea Account</h1>
                    <p className="text-surface-400 font-medium">Unisciti alla comunità di VerbumDigital</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-red-400 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-surface-200 ml-1">Nome Completo</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="input"
                            placeholder="Mario Rossi"
                            required
                        />
                    </div>

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
                            placeholder="Almeno 6 caratteri"
                            required
                            minLength={6}
                        />
                    </div>

                    <button disabled={loading} className="btn-primary w-full py-4 text-lg mt-2">
                        {loading ? 'Creazione in corso...' : 'Registrati'}
                    </button>

                    <p className="text-center text-surface-400 text-sm pt-4">
                        Hai già un account?{' '}
                        <Link to="/login" className="text-primary-400 font-bold hover:underline underline-offset-4">
                            Accedi
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
