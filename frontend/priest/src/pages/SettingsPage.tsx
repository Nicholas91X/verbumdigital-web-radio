import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@shared/api/client";
import type { Church, DonationPreset } from "@shared/api/types";
import Modal from "@/components/Modal";

export default function SettingsPage() {
  const { churchId } = useParams();
  const [church, setChurch] = useState<Church | null>(null);
  const [presets, setPresets] = useState<DonationPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [churchesRes, presetsRes] = await Promise.all([
        api.get<{ churches: Church[] }>("/priest/churches"),
        api.get<{ presets: DonationPreset[] }>(`/priest/churches/${churchId}/donation-presets`),
      ]);
      const found = churchesRes.churches.find((c) => c.id === parseInt(churchId || "0"));
      if (found) setChurch(found);
      setPresets(presetsRes.presets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore caricamento impostazioni");
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (presetId: number) => {
    if (!confirm("Sei sicuro di voler eliminare questo importo?")) return;
    try {
      await api.delete(`/priest/donation-presets/${presetId}`);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore eliminazione");
    }
  };

  const handleSetDefault = async (presetId: number) => {
    try {
      await api.post(`/priest/donation-presets/${presetId}/set-default`);
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore impostazione predefinito");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error || !church) {
    return (
      <div className="px-5 py-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4 text-red-400 font-medium">
          {error || "Chiesa non trovata"}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-8 space-y-8 pb-32">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          to="/"
          className="mt-1 w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center shrink-0 border border-white/5 active:scale-95 transition-transform"
        >
          <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white mb-1">
            Impostazioni
          </h1>
          <p className="text-surface-500 text-sm font-medium">
            {church.name}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Importi Donazione</h2>
            {church.stripe_onboarding_complete && (
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary py-2 px-4 text-xs font-bold"
              >
                Nuovo Importo
              </button>
            )}
          </div>

          {!church.stripe_onboarding_complete ? (
            <div className="card border-amber-500/30 bg-amber-500/5">
              <p className="text-amber-400 text-sm font-medium mb-1">Stripe Non Configurato</p>
              <p className="text-surface-400 text-xs">
                La parrocchia non ha ancora completato l'iscrizione a Stripe.
                Contatta un amministratore di VerbumDigital per abilitare le donazioni.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {presets.length === 0 ? (
                <div className="card text-center py-8">
                  <p className="text-surface-400 text-sm">Nessun importo preimpostato.</p>
                  <p className="text-surface-500 text-xs mt-1">Crea importi come "Offerta Libera" o "10€" per permettere ai fedeli di donare.</p>
                </div>
              ) : (
                presets.map(p => (
                  <div key={p.id} className="card p-4 flex items-center justify-between hover:border-surface-700 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-lg">
                          {p.amounts.map(a => `€${(a / 100).toFixed(2)}`).join(' · ')}
                        </span>
                        {p.is_default && (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            Predefinito
                          </span>
                        )}
                      </div>
                      <p className="text-surface-400 text-sm">{p.name}</p>
                    </div>
                    
                    <div className="flex gap-2">
                      {!p.is_default && (
                        <button
                          onClick={() => handleSetDefault(p.id)}
                          className="btn-ghost px-3 py-1.5 text-[10px] uppercase font-bold text-surface-400 hover:text-white"
                        >
                          Rendi Default
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="btn-ghost px-3 py-1.5 text-[10px] uppercase font-bold text-red-500 hover:text-red-400 hover:bg-red-500/10"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <CreatePresetModal
        open={showCreate}
        churchId={parseInt(churchId || "0")}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          fetchData();
        }}
      />
    </div>
  );
}

function CreatePresetModal({
  open,
  churchId,
  onClose,
  onCreated,
}: {
  open: boolean;
  churchId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [amounts, setAmounts] = useState<string[]>(["", "", ""]);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateAmount = (idx: number, val: string) =>
    setAmounts((prev) => prev.map((a, i) => (i === idx ? val : a)));

  const addAmount = () => {
    if (amounts.length < 4) setAmounts((prev) => [...prev, ""]);
  };

  const removeAmount = (idx: number) => {
    if (amounts.length <= 1) return;
    setAmounts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const filled = amounts.filter((a) => a.trim() !== "");
      if (filled.length === 0) throw new Error("Inserisci almeno un importo");

      const amountsCents = filled.map((a) => Math.round(parseFloat(a) * 100));
      if (amountsCents.some((v) => isNaN(v) || v < 50)) {
        throw new Error("Ogni importo deve essere almeno €0,50");
      }

      await api.post(`/priest/churches/${churchId}/donation-presets`, {
        name,
        amounts: amountsCents,
        is_default: isDefault,
      });
      setName("");
      setAmounts(["", "", ""]);
      setIsDefault(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione preset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuovo Preset Donazione">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm text-surface-300 font-medium mb-1.5">Nome preset</label>
          <input
            type="text"
            required
            placeholder="es. Offerta Santa Messa"
            className="input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-surface-300 font-medium">
              Importi (€) — da 1 a 4 opzioni
            </label>
            {amounts.length < 4 && (
              <button
                type="button"
                onClick={addAmount}
                className="text-xs font-bold text-primary-400 hover:text-primary-300 transition-colors"
              >
                + Aggiungi
              </button>
            )}
          </div>
          <div className="space-y-2">
            {amounts.map((val, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 font-bold text-sm">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.50"
                    placeholder="0.00"
                    className="input w-full pl-7"
                    value={val}
                    onChange={(e) => updateAmount(idx, e.target.value)}
                  />
                </div>
                {amounts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAmount(idx)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-surface-500 text-xs mt-2">
            Lascia vuoti gli importi che non vuoi usare.
          </p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer py-2">
          <div className="relative flex items-center justify-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            <div className="w-10 h-6 bg-surface-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
          </div>
          <span className="text-sm font-medium text-surface-200">
            Imposta come preset predefinito
          </span>
        </label>

        <div className="flex gap-3 justify-end pt-4">
          <button type="button" onClick={onClose} className="btn-ghost">
            Annulla
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
