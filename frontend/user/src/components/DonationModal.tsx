import { useState } from 'react';
import { api } from '@shared/api/client';
import Modal from './Modal';
import type { DonationPreset } from '@shared/api/types';

interface DonationModalProps {
    open: boolean;
    onClose: () => void;
    sessionId: number;
    preset: DonationPreset;
}

export default function DonationModal({ open, onClose, sessionId, preset }: DonationModalProps) {
    const [loading, setLoading] = useState(false);
    const [customAmount, setCustomAmount] = useState<string>('');
    const [isCustom, setIsCustom] = useState(false);

    // Handle donation
    const handleDonate = async (amountCents: number) => {
        setLoading(true);
        try {
            const data = await api.post<{ checkout_url: string }>(`/sessions/${sessionId}/donation/checkout`, {
                amount: amountCents
            });
            window.location.href = data.checkout_url;
        } catch (err) {
            alert("Errore durante la creazione della sessione di pagamento");
        } finally {
            setLoading(false);
        }
    };

    const handleCustomSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(customAmount.replace(',', '.'));
        if (isNaN(amount) || amount < 0.5) {
            alert("Inserisci un importo valido (minimo 0.50 €)");
            return;
        }
        handleDonate(Math.round(amount * 100));
    };

    return (
        <Modal open={open} onClose={onClose} title="Sostieni la tua parrocchia">
            <div className="space-y-6">
                <p className="text-surface-400 text-sm font-medium leading-relaxed">
                    Il tuo contributo supporta direttamente le attività della parrocchia: <span className="text-white font-black">{preset.name}</span>.
                </p>

                <div className="grid grid-cols-2 gap-3">
                    {preset.amounts.map((amountCents) => (
                        <button
                            key={amountCents}
                            onClick={() => handleDonate(amountCents)}
                            disabled={loading}
                            className="group relative overflow-hidden p-5 bg-primary-600 rounded-3xl text-white shadow-xl shadow-primary-900/40 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] uppercase font-black tracking-widest opacity-60 mb-1">Dona</span>
                                <span className="text-2xl font-black">€ {(amountCents / 100).toFixed(2).replace('.', ',')}</span>
                            </div>
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        </button>
                    ))}

                    <button
                        onClick={() => setIsCustom(!isCustom)}
                        disabled={loading}
                        className="col-span-2 py-4 bg-surface-800 text-surface-300 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/5 active:scale-95 transition-all"
                    >
                        {isCustom ? "Annulla" : "Altro importo"}
                    </button>
                </div>

                {isCustom && (
                    <form onSubmit={handleCustomSubmit} className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                        <div className="relative">
                            <input
                                type="text"
                                value={customAmount}
                                onChange={(e) => setCustomAmount(e.target.value)}
                                placeholder="0,00"
                                className="w-full bg-surface-950 border border-white/10 rounded-2xl py-4 px-6 text-xl font-black text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all placeholder:text-surface-700"
                                autoFocus
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-surface-500 font-black">€</div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !customAmount}
                            className="btn-primary w-full py-4 text-sm font-black uppercase tracking-widest shadow-lg shadow-primary-900/40"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
                            ) : (
                                "Conferma"
                            )}
                        </button>
                    </form>
                )}

                <p className="text-[9px] text-surface-600 text-center uppercase font-bold tracking-widest leading-normal">
                    Pagamento sicuro tramite <span className="text-surface-400">Stripe</span>.<br />
                    I fondi vanno direttamente all'account della parrocchia.
                </p>
            </div>
        </Modal>
    );
}
