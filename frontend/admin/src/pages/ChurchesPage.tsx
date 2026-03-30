import { useState, useEffect, useCallback, type FormEvent } from "react";
import { api } from "@shared/api/client";
import type { Church, Machine, StreamingCredential, Donation } from "@shared/api/types";
import Modal from "@/components/Modal";

export default function ChurchesPage() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editChurch, setEditChurch] = useState<Church | null>(null);
  const [donationsChurch, setDonationsChurch] = useState<Church | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Church | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [cRes, mRes] = await Promise.all([
        api.get<{ churches: Church[] }>("/admin/churches"),
        api.get<{ machines: Machine[] }>("/admin/machines"),
      ]);
      setChurches(cRes.churches || []);
      setMachines(mRes.machines || []);
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
      await api.delete(`/admin/churches/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchData();
    } catch {
      //
    } finally {
      setDeleting(false);
    }
  };

  // Machines not yet assigned to a church
  const availableMachines = machines.filter(
    (m) =>
      !churches.some((c) => c.machine_id === m.id) ||
      m.id === editChurch?.machine_id,
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Chiese</h1>
          <p className="text-surface-400 text-sm mt-0.5">
            Parrocchie registrate con credenziali streaming
          </p>
        </div>
      </div>

      {/* List of Churches as Mobile-first Cards */}
      {loading ? (
        <Loading />
      ) : churches.length === 0 ? (
        <EmptyState message="Nessuna chiesa registrata" />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table */}
          <div className="hidden lg:block card overflow-hidden p-0">
            <table className="w-full">
              <thead className="bg-surface-900/50">
                <tr>
                  <th className="table-header">Nome</th>
                  <th className="table-header">Macchina</th>
                  <th className="table-header">Stream ID</th>
                  <th className="table-header text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {churches.map((c) => (
                  <tr key={c.id}>
                    <td className="table-cell">
                      <div className="font-bold text-white">{c.name}</div>
                      {c.address && (
                        <div className="text-xs text-surface-500 font-medium">
                          {c.address}
                        </div>
                      )}
                    </td>
                    <td className="table-cell font-mono text-surface-400 text-xs">
                      {c.machine?.machine_id || "—"}
                    </td>
                    <td className="table-cell font-mono text-xs text-surface-400">
                      {c.streaming_credential?.stream_id || "—"}
                    </td>
                    <td className="table-cell text-right">
                      {c.stripe_onboarding_complete && (
                        <button
                          onClick={() => setDonationsChurch(c)}
                          className="mr-4 text-xs font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-widest"
                        >
                          Donazioni
                        </button>
                      )}
                      <button
                        onClick={() => setEditChurch(c)}
                        className="text-xs font-bold text-primary-500 hover:text-primary-400 uppercase tracking-widest"
                      >
                        Modifica
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="ml-3 text-xs font-bold text-red-500/60 hover:text-red-400 uppercase tracking-widest"
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {churches.map((c) => (
              <div key={c.id} className="card p-5 space-y-4 active:scale-100">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-white text-lg truncate pr-2">
                      {c.name}
                    </h3>
                    <p className="text-surface-500 text-[10px] font-bold uppercase tracking-widest mt-1 truncate">
                      {c.address || "Nessun indirizzo"}
                    </p>
                  </div>
                  {c.streaming_active ? (
                    <div className="badge-live">Live</div>
                  ) : (
                    <div className="badge-offline">Offline</div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 py-2 border-y border-white/5">
                  <div className="space-y-1">
                    <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">
                      Hardware
                    </span>
                    <p className="text-xs font-mono text-surface-300 truncate">
                      {c.machine?.machine_id || "Non assegnato"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">
                      Stream ID
                    </span>
                    <p className="text-xs font-mono text-surface-300 truncate">
                      {c.streaming_credential?.stream_id || "Mancante"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col border-t border-white/5">
                  {c.stripe_onboarding_complete && (
                    <button
                      onClick={() => setDonationsChurch(c)}
                      className="btn-ghost w-full py-3 text-xs text-emerald-500 font-bold uppercase tracking-widest border-b border-white/5"
                    >
                      Storico Donazioni
                    </button>
                  )}
                  <button
                    onClick={() => setEditChurch(c)}
                    className="btn-ghost w-full py-3 text-xs font-bold uppercase tracking-widest"
                  >
                    Modifica Dettagli
                  </button>
                  <button
                    onClick={() => setDeleteTarget(c)}
                    className="btn-ghost w-full py-3 text-xs font-bold uppercase tracking-widest text-red-500/70 hover:bg-red-500/10"
                  >
                    Elimina Chiesa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Action Button for Mobile */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(99,102,241,0.5)] hover:scale-105 active:scale-95 transition-all z-40 border border-primary-400/30"
        aria-label="Nuova Chiesa"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>

      {/* Create Modal */}
      <CreateChurchModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          fetchData();
        }}
        availableMachines={availableMachines}
      />

      {/* Edit Modal */}
      {editChurch && (
        <EditChurchModal
          open={true}
          church={editChurch}
          onClose={() => setEditChurch(null)}
          onSaved={() => {
            setEditChurch(null);
            fetchData();
          }}
          availableMachines={availableMachines}
        />
      )}

      {/* Donations Modal */}
      {donationsChurch && (
        <ChurchDonationsModal
          open={true}
          church={donationsChurch}
          onClose={() => setDonationsChurch(null)}
        />
      )}

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Elimina Chiesa">
        <div className="space-y-4">
          <p className="text-surface-300 text-sm">
            Sei sicuro di voler eliminare la chiesa <span className="font-bold text-white">{deleteTarget?.name}</span>?
            <span className="block mt-2 text-red-400/80 text-xs">
              ⚠ Questa operazione è irreversibile. Verranno eliminati: credenziali streaming, sessioni, donazioni, presets, iscrizioni utenti e assegnazioni sacerdoti.
            </span>
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeleteTarget(null)} className="btn-ghost">Annulla</button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Eliminazione...' : 'Elimina'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================
// Create Church Modal
// ============================================

function CreateChurchModal({
  open,
  onClose,
  onCreated,
  availableMachines,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  availableMachines: Machine[];
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [machineId, setMachineId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{
    church: Church;
    streaming_credentials: StreamingCredential;
  } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body: Record<string, unknown> = { name };
      if (address) body.address = address;
      if (logoUrl) body.logo_url = logoUrl;
      if (machineId) body.machine_id = parseInt(machineId);

      const data = await api.post<{
        church: Church;
        streaming_credentials: StreamingCredential;
      }>("/admin/churches", body);
      setCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName("");
    setAddress("");
    setLogoUrl("");
    setMachineId("");
    setError("");
    setCreated(null);
    if (created) onCreated();
    else onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={created ? "Chiesa Creata" : "Nuova Chiesa"}
    >
      {created ? (
        <div className="space-y-4">
          <p className="text-surface-300 text-sm">
            <span className="font-medium">{created.church.name}</span> creata
            con successo.
          </p>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-2">
            <p className="text-xs text-surface-500 uppercase tracking-wider">
              Credenziali Streaming (auto-generate)
            </p>
            <p className="text-sm">
              <span className="text-surface-500">Stream ID:</span>{" "}
              <span className="font-mono font-medium text-emerald-400">
                {created.streaming_credentials.stream_id}
              </span>
            </p>
            <p className="text-sm">
              <span className="text-surface-500">Stream Key:</span>{" "}
              <span className="font-mono text-xs text-surface-300 break-all">
                {created.streaming_credentials.stream_key}
              </span>
            </p>
          </div>
          <p className="text-xs text-surface-500">
            Queste credenziali sono permanenti. L'URL Icecast sarà:{" "}
            <span className="font-mono">
              vdserv.com:8000/{created.streaming_credentials.stream_id}.mp3
            </span>
          </p>
          <button onClick={handleClose} className="btn-primary w-full">
            Chiudi
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorBanner message={error} />}
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Nome *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Parrocchia San Pietro"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Indirizzo
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input"
              placeholder="Via Roma 1, Milano"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Logo</label>
            <LogoUploader url={logoUrl} onChange={setLogoUrl} uploading={logoUploading} setUploading={setLogoUploading} />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">
              Macchina ST1
            </label>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="input"
            >
              <option value="">Nessuna (assegna dopo)</option>
              {availableMachines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.machine_id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={handleClose} className="btn-ghost">
              Annulla
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Creazione..." : "Crea"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ============================================
// Edit Church Modal
// ============================================

function EditChurchModal({
  open,
  church,
  onClose,
  onSaved,
  availableMachines,
}: {
  open: boolean;
  church: Church;
  onClose: () => void;
  onSaved: () => void;
  availableMachines: Machine[];
}) {
  const [name, setName] = useState(church.name);
  const [address, setAddress] = useState(church.address || "");
  const [logoUrl, setLogoUrl] = useState(church.logo_url || "");
  const [logoUploading, setLogoUploading] = useState(false);
  const [machineId, setMachineId] = useState(
    church.machine_id?.toString() || "",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStripe, setLoadingStripe] = useState(false);

  // Auto-refresh Stripe status when opening modal
  useEffect(() => {
    // Optionally we can fetch status here if we want to be exact,
    // but the church object already has stripe_onboarding_complete
  }, []);

  const handleStripeOnboard = async () => {
    setLoadingStripe(true);
    setError("");
    try {
      const res = await api.post<{ url: string }>(`/admin/churches/${church.id}/stripe/onboard`);
      if (res && res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore inizializzazione Stripe");
    } finally {
      setLoadingStripe(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name,
        address,
        logo_url: logoUrl,
      };
      if (machineId) body.machine_id = parseInt(machineId);

      await api.put(`/admin/churches/${church.id}`, body);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore aggiornamento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Modifica — ${church.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Nome *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Indirizzo
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Logo</label>
          <LogoUploader url={logoUrl} onChange={setLogoUrl} uploading={logoUploading} setUploading={setLogoUploading} />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Macchina ST1
          </label>
          <select
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            className="input"
          >
            <option value="">Nessuna</option>
            {availableMachines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.machine_id}
              </option>
            ))}
          </select>
        </div>

        {/* Stream credentials (read only) */}
        {church.streaming_credential && (
          <div className="bg-surface-900/50 rounded-lg p-3 space-y-1">
            <p className="text-xs text-surface-500 uppercase tracking-wider">
              Credenziali Streaming
            </p>
            <p className="text-xs font-mono text-surface-400">
              Stream ID: {church.streaming_credential.stream_id}
            </p>
            <p className="text-xs font-mono text-surface-400 break-all">
              Stream Key: {church.streaming_credential.stream_key}
            </p>
          </div>
        )}

        {/* Stripe Connect */}
        <div className="bg-surface-900/50 rounded-lg p-3 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs text-surface-500 uppercase tracking-wider">
              Stripe Connect (Donazioni)
            </p>
            {church.stripe_onboarding_complete ? (
              <span className="text-[10px] font-bold text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded-full">Attivo</span>
            ) : (
              <span className="text-[10px] font-bold text-amber-400 uppercase bg-amber-500/10 px-2 py-0.5 rounded-full">Non Attivo</span>
            )}
          </div>
          
          <p className="text-xs text-surface-400">
            {church.stripe_onboarding_complete 
              ? "L'account Stripe della parrocchia è configurato per ricevere donazioni." 
              : "Configura un account Stripe Connect per permettere alla parrocchia di ricevere donazioni direttamente dai fedeli."}
          </p>

          {!church.stripe_onboarding_complete && (
            <button
              type="button"
              onClick={handleStripeOnboard}
              disabled={loadingStripe}
              className="btn-primary w-full text-xs py-2 mt-2 flex justify-center items-center gap-2"
            >
              {loadingStripe ? "Caricamento..." : "Avvia Configurazione Stripe"}
            </button>
          )}
        </div>

        <div className="flex gap-3 justify-end">
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

// ============================================
// Church Donations Modal
// ============================================

function ChurchDonationsModal({
  open,
  church,
  onClose,
}: {
  open: boolean;
  church: Church;
  onClose: () => void;
}) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (open) {
      setLoading(true);
      api
        .get<{ donations: Donation[]; total_amount_cents: number }>(
          `/admin/churches/${church.id}/donations`
        )
        .then((res) => {
          if (!active) return;
          setDonations(res.donations || []);
          setTotalCents(res.total_amount_cents || 0);
        })
        .catch((err) => {
          if (!active) return;
          setError(err instanceof Error ? err.message : "Errore caricamento donazioni");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [open, church.id]);

  return (
    <Modal open={open} onClose={onClose} title={`Donazioni — ${church.name}`}>
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}

        {loading ? (
          <Loading />
        ) : (
          <>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex flex-col items-center justify-center">
              <span className="text-xs text-emerald-400 font-bold uppercase tracking-widest mb-1">
                Totale Ricevuto
              </span>
              <span className="text-3xl font-extrabold text-white">
                €{(totalCents / 100).toFixed(2)}
              </span>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {donations.length === 0 ? (
                <EmptyState message="Nessuna donazione ricevuta finora" />
              ) : (
                donations.map((d) => (
                  <div key={d.id} className="bg-surface-900/50 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-white">{d.user?.name || "Anonimo"}</p>
                      <p className="text-xs text-surface-400">{d.user?.email || d.donor_email || "Nessuna email"}</p>
                      <p className="text-[10px] text-surface-500 mt-1">
                        {new Date(d.created_at).toLocaleString("it-IT", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-400">
                        {d.currency?.toUpperCase() === "EUR" ? "€" : ""}{(d.amount / 100).toFixed(2)}
                      </p>
                      {d.status === "completed" ? (
                        <span className="text-[10px] uppercase font-bold text-emerald-400">Completata</span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-amber-400">{d.status}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <div className="flex justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-primary">
            Chiudi
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================
// Shared
// ============================================

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
      {message}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-12">
      <svg
        className="animate-spin h-8 w-8 text-primary-500"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="card text-surface-400 text-center py-12">{message}</div>
  );
}

// ============================================
// Logo Uploader Component
// ============================================

function LogoUploader({
  url,
  onChange,
  uploading,
  setUploading,
}: {
  url: string;
  onChange: (url: string) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
}) {
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const { url: uploaded } = await api.uploadFile<{ url: string }>("/admin/upload/image", fd);
      onChange(uploaded);
    } catch {
      // keep previous url
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      {url ? (
        <img src={url} alt="Logo" className="w-14 h-14 rounded-xl object-cover border border-surface-700 shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-surface-800 border border-surface-700 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className={`cursor-pointer px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-widest transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""} bg-surface-800 border-surface-700 text-surface-300 hover:text-white hover:border-surface-600`}>
          {uploading ? "Caricamento..." : url ? "Cambia" : "Carica Logo"}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        {url && (
          <button type="button" onClick={() => onChange("")} className="text-[10px] text-surface-500 hover:text-red-400 transition-colors font-bold uppercase tracking-widest text-left">
            Rimuovi
          </button>
        )}
      </div>
    </div>
  );
}
