import { useState, useEffect, useCallback, type FormEvent } from "react";
import { api } from "@shared/api/client";
import type { Priest, Church } from "@shared/api/types";
import Modal from "@/components/Modal";

export default function PriestsPage() {
  const [priests, setPriests] = useState<Priest[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editPriest, setEditPriest] = useState<Priest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Priest | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        api.get<{ priests: Priest[] }>("/admin/priests"),
        api.get<{ churches: Church[] }>("/admin/churches"),
      ]);
      setPriests(pRes.priests || []);
      setChurches(cRes.churches || []);
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
      await api.delete(`/admin/priests/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchData();
    } catch {
      //
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sacerdoti</h1>
          <p className="text-surface-400 text-sm mt-0.5">
            Gestione account sacerdoti e assegnazioni
          </p>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : priests.length === 0 ? (
        <EmptyState message="Nessun sacerdote registrato" />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table */}
          <div className="hidden lg:block card overflow-hidden p-0">
            <table className="w-full">
              <thead className="bg-surface-900/50">
                <tr>
                  <th className="table-header">Nome</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Chiese assegnate</th>
                  <th className="table-header">Registrato</th>
                  <th className="table-header text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {priests.map((p) => (
                  <tr key={p.id}>
                    <td className="table-cell font-bold text-white">{p.name}</td>
                    <td className="table-cell text-surface-400 font-medium">{p.email}</td>
                    <td className="table-cell">
                      {p.churches && p.churches.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {p.churches.map((c) => (
                            <span key={c.id} className="badge bg-primary-500/10 text-primary-500 border-primary-500/20">
                              {c.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-surface-500 text-xs font-bold uppercase tracking-widest">Nessuna</span>
                      )}
                    </td>
                    <td className="table-cell text-surface-500 text-xs font-mono">
                      {new Date(p.created_at).toLocaleDateString("it-IT")}
                    </td>
                    <td className="table-cell text-right space-x-3">
                      <button
                        onClick={() => setEditPriest(p)}
                        className="text-xs font-black uppercase tracking-widest text-primary-500 hover:text-primary-400 transition-colors"
                      >
                        Modifica
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="text-xs font-black uppercase tracking-widest text-red-500/60 hover:text-red-400 transition-colors"
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
            {priests.map((p) => (
              <div key={p.id} className="card p-5 space-y-4 active:scale-100">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-white text-lg truncate pr-2">{p.name}</h3>
                    <p className="text-surface-500 text-[10px] font-bold uppercase tracking-widest mt-1 truncate">{p.email}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-surface-800 flex items-center justify-center text-primary-500">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>

                <div className="space-y-2 py-2 border-t border-white/5">
                  <span className="text-[10px] text-surface-500 font-bold uppercase tracking-widest">Parrocchie Gestite</span>
                  <div className="flex flex-wrap gap-2">
                    {p.churches && p.churches.length > 0 ? (
                      p.churches.map((c) => (
                        <span key={c.id} className="px-2.5 py-1 bg-primary-500/10 text-primary-500 border border-primary-500/20 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                          {c.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-surface-600 text-[10px] font-bold uppercase tracking-widest italic">Nessuna Chiesa Assegnata</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-surface-600 font-bold uppercase tracking-widest pt-1 border-t border-white/5">
                  <span>{new Date(p.created_at).toLocaleDateString("it-IT")}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <button onClick={() => setEditPriest(p)} className="btn-ghost w-full py-3 text-xs font-black uppercase tracking-widest text-primary-500">
                    Modifica
                  </button>
                  <button onClick={() => setDeleteTarget(p)} className="btn-ghost w-full py-3 text-xs font-black uppercase tracking-widest text-red-500/70 hover:bg-red-500/10">
                    Elimina
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(99,102,241,0.5)] hover:scale-105 active:scale-95 transition-all z-40 border border-primary-400/30"
        aria-label="Nuovo Sacerdote"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <CreatePriestModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); fetchData(); }}
        churches={churches}
      />

      {editPriest && (
        <EditPriestModal
          priest={editPriest}
          churches={churches}
          onClose={() => setEditPriest(null)}
          onSaved={() => { setEditPriest(null); fetchData(); }}
        />
      )}

      {/* Delete Confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Elimina Sacerdote">
        <div className="space-y-4">
          <p className="text-surface-300 text-sm">
            Sei sicuro di voler eliminare il sacerdote <span className="font-bold text-white">{deleteTarget?.name}</span>?
            Verranno rimosse anche tutte le assegnazioni alle chiese.
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
// Create Priest Modal
// ============================================

function CreatePriestModal({ open, onClose, onCreated, churches }: {
  open: boolean; onClose: () => void; onCreated: () => void; churches: Church[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedChurches, setSelectedChurches] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleChurch = (id: number) =>
    setSelectedChurches((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/admin/priests", { name, email, password, church_ids: selectedChurches });
      setName(""); setEmail(""); setPassword(""); setSelectedChurches([]);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore creazione");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName(""); setEmail(""); setPassword(""); setSelectedChurches([]); setError("");
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Nuovo Sacerdote">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Nome *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Don Mario" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Email *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="don.mario@email.com" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Password *</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Almeno 6 caratteri" required minLength={6} />
        </div>
        {churches.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Assegna a chiese</label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {churches.map((c) => (
                <label key={c.id} className="flex items-center gap-2.5 cursor-pointer group">
                  <input type="checkbox" checked={selectedChurches.includes(c.id)} onChange={() => toggleChurch(c.id)}
                    className="w-4 h-4 rounded border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500" />
                  <span className="text-sm text-surface-300 group-hover:text-white transition-colors">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={handleClose} className="btn-ghost">Annulla</button>
          <button type="submit" disabled={loading} className="btn-primary">{loading ? "Creazione..." : "Crea"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================
// Edit Priest Modal
// ============================================

function EditPriestModal({ priest, churches, onClose, onSaved }: {
  priest: Priest; churches: Church[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(priest.name);
  const [email, setEmail] = useState(priest.email);
  const [password, setPassword] = useState("");
  const [selectedChurches, setSelectedChurches] = useState<number[]>(
    (priest.churches || []).map((c) => c.id)
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleChurch = (id: number) =>
    setSelectedChurches((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.put(`/admin/priests/${priest.id}`, {
        name,
        email,
        password,
        church_ids: selectedChurches,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore aggiornamento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Modifica Sacerdote">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Nome *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">Email *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-300 mb-1.5">
            Nuova Password <span className="text-surface-500 font-normal">(lascia vuota per non cambiare)</span>
          </label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Almeno 6 caratteri" minLength={6} />
        </div>
        {churches.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">Chiese assegnate</label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {churches.map((c) => (
                <label key={c.id} className="flex items-center gap-2.5 cursor-pointer group">
                  <input type="checkbox" checked={selectedChurches.includes(c.id)} onChange={() => toggleChurch(c.id)}
                    className="w-4 h-4 rounded border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500" />
                  <span className="text-sm text-surface-300 group-hover:text-white transition-colors">{c.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-ghost">Annulla</button>
          <button type="submit" disabled={loading} className="btn-primary">{loading ? "Salvataggio..." : "Salva"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================
// Shared
// ============================================

function Loading() {
  return (
    <div className="flex justify-center py-12">
      <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="card text-surface-400 text-center py-12">{message}</div>;
}
