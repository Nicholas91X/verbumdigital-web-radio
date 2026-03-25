import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@shared/api/client";
import type { Donation } from "@shared/api/types";

export default function DonationsPage() {
  const navigate = useNavigate();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ donations: Donation[] }>("/user/donations")
      .then((data) => setDonations(data.donations || []))
      .catch(() => setDonations([]))
      .finally(() => setLoading(false));
  }, []);

  const formatAmount = (cents: number, currency: string) => {
    const symbol = currency?.toUpperCase() === "EUR" ? "€" : currency;
    return `${symbol}${(cents / 100).toFixed(2).replace(".", ",")}`;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const totalCompleted = donations
    .filter((d) => d.status === "completed")
    .reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="px-5 py-8 pb-32 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-surface-800 border border-white/5 flex items-center justify-center active:scale-95 transition-transform shrink-0"
        >
          <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Le mie donazioni</h1>
          <p className="text-surface-500 text-sm mt-0.5">Storico delle tue offerte</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : donations.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
          <div className="w-20 h-20 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center">
            <svg className="w-10 h-10 text-surface-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-lg">Nessuna donazione ancora</p>
            <p className="text-surface-500 text-sm mt-1 max-w-xs mx-auto">
              Quando una parrocchia apre le donazioni durante una diretta,<br />
              potrai contribuire direttamente dall'app.
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="btn-primary px-6 py-3 text-sm"
          >
            Ascolta le dirette
          </button>
        </div>
      ) : (
        <>
          {/* Total card */}
          <div className="rounded-2xl bg-primary-600/10 border border-primary-500/20 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary-400 mb-1">
                Totale donato
              </p>
              <p className="text-3xl font-black text-white tracking-tight">
                {formatAmount(totalCompleted, "eur")}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
              </svg>
            </div>
          </div>

          {/* List */}
          <div className="space-y-3">
            {donations.map((d) => (
              <div
                key={d.id}
                className="bg-surface-900 border border-surface-800 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-surface-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {d.church?.name ?? "Parrocchia"}
                    </p>
                    <p className="text-xs text-surface-500 mt-0.5">
                      {formatDate(d.created_at)}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-base font-black text-emerald-400">
                    {formatAmount(d.amount, d.currency)}
                  </p>
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest ${
                      d.status === "completed"
                        ? "text-emerald-500"
                        : d.status === "failed"
                          ? "text-red-500"
                          : "text-amber-500"
                    }`}
                  >
                    {d.status === "completed"
                      ? "Completata"
                      : d.status === "failed"
                        ? "Fallita"
                        : "In attesa"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
