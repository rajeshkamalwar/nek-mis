import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  applyProfileToRun,
  deleteRun,
  dryRun,
  type DryRunJournalBalancedLineDTO,
  type DryRunPlanDTO,
  type DryRunPlanLineDTO,
  type DryRunResponseDTO,
  fetchProfiles,
  fetchRun,
  publishRun,
  publishRunAsync,
} from "../api/client";
import { AppShell } from "../components/AppShell";
import { useT } from "../i18n/LangContext";

// ─── Helpers ────────────────────────────────────────────────────────────────

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dash(n: number | undefined): string {
  return n ? money(n) : "—";
}

function accountLabel(name: string | null | undefined, id: string | undefined): string {
  if (name?.trim()) return name.trim();
  const s = id ?? "";
  return s.length > 12 ? `…${s.slice(-10)}` : s || "—";
}

// ─── Ledger aggregation ──────────────────────────────────────────────────────

type LedgerRow = {
  account_id: string;
  account_name: string;
  invoice: number;
  cn: number;
  jnl_dr: number;
  jnl_cr: number;
  payment: number;
};

function buildLedger(data: DryRunResponseDTO): LedgerRow[] {
  const map = new Map<string, LedgerRow>();

  function get(id: string, name: string): LedgerRow {
    if (!map.has(id)) {
      map.set(id, { account_id: id, account_name: name, invoice: 0, cn: 0, jnl_dr: 0, jnl_cr: 0, payment: 0 });
    }
    return map.get(id)!;
  }

  for (const row of data.rows) {
    const p = row.plan;
    for (const li of p.invoice_lines ?? []) {
      get(li.account_id ?? "", accountLabel(li.account_name, li.account_id)).invoice += Number(li.amount ?? 0);
    }
    for (const li of p.credit_note_lines ?? []) {
      get(li.account_id ?? "", accountLabel(li.account_name, li.account_id)).cn += Math.abs(Number(li.amount ?? 0));
    }
    const jeRows = (p.journal_entries_balanced ?? p.journal_entries ?? []) as (DryRunJournalBalancedLineDTO & DryRunPlanLineDTO)[];
    for (const je of jeRows) {
      const side = (je.debit_or_credit ?? "debit") as string;
      const r = get(je.account_id ?? "", accountLabel(je.account_name, je.account_id));
      if (side === "debit") r.jnl_dr += Number(je.amount ?? 0);
      else r.jnl_cr += Number(je.amount ?? 0);
    }
    if (p.payment) {
      get(p.payment.account_id ?? "", accountLabel(p.payment.account_name, p.payment.account_id)).payment += Number(p.payment.amount ?? 0);
    }
  }

  return Array.from(map.values()).sort((a, b) => a.account_name.localeCompare(b.account_name));
}

// ─── Summary stats ───────────────────────────────────────────────────────────

function summarizeDryRun(data: DryRunResponseDTO) {
  let invoiceTotal = 0, cnTotal = 0, payTotal = 0, jnlLines = 0, skipped = 0;
  for (const row of data.rows) {
    const p = row.plan;
    const inv = p.invoice_lines?.length ?? 0;
    const je = p.journal_entries?.length ?? 0;
    const cn = p.credit_note_lines?.length ?? 0;
    const pay = p.payment != null ? 1 : 0;
    for (const li of p.invoice_lines ?? []) invoiceTotal += Number(li.amount ?? 0);
    for (const li of p.credit_note_lines ?? []) cnTotal += Math.abs(Number(li.amount ?? 0));
    if (p.payment) payTotal += Number(p.payment.amount ?? 0);
    jnlLines += je;
    if (inv === 0 && je === 0 && cn === 0 && pay === 0) skipped++;
  }
  return { invoiceTotal, cnTotal, payTotal, jnlLines, skipped, rowCount: data.rows.length };
}

// ─── Journal rows normaliser ─────────────────────────────────────────────────

type JRow = {
  account_id?: string;
  account_name?: string | null;
  label: string;
  amount: number;
  side: "debit" | "credit";
  is_clearing?: boolean;
};

function normaliseJournalRows(plan: DryRunPlanDTO): JRow[] {
  const balanced = plan.journal_entries_balanced;
  if (balanced?.length) {
    return balanced.map((r: DryRunJournalBalancedLineDTO) => ({
      account_id: r.account_id,
      account_name: r.account_name,
      label: r.label,
      amount: Number(r.amount ?? 0),
      side: (r.debit_or_credit ?? "debit") as "debit" | "credit",
      is_clearing: r.is_clearing_line,
    }));
  }
  return (plan.journal_entries ?? []).map((r: DryRunPlanLineDTO) => ({
    account_id: r.account_id,
    account_name: r.account_name,
    label: String(r.label ?? r.canonical_key ?? ""),
    amount: Number(r.amount ?? 0),
    side: (r.debit_or_credit ?? "debit") as "debit" | "credit",
  }));
}

// ─── Document card for one CSV row ──────────────────────────────────────────

const TH = "px-3 py-2 text-left text-[11px] font-semibold text-slate-500 border-b border-slate-200 bg-slate-50 uppercase tracking-wide";
const TD = "px-3 py-2 border-b border-slate-100 text-slate-800 text-xs";

function RowDocCard({
  row,
  idx,
  defaultOpen,
}: {
  row: DryRunResponseDTO["rows"][number];
  idx: number;
  defaultOpen: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);
  const plan = row.plan;
  const inv = plan.invoice_lines ?? [];
  const cn = plan.credit_note_lines ?? [];
  const pay = plan.payment;
  const jRows = useMemo(() => normaliseJournalRows(plan), [plan]);
  const balanced = !!plan.journal_entries_balanced?.length;
  const oid = row.order_id != null && row.order_id !== "" ? String(row.order_id) : null;
  const isEmpty = inv.length === 0 && cn.length === 0 && jRows.length === 0 && !pay;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Card header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-slate-700">Row {idx + 1}</span>
          {oid && (
            <span className="rounded bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-medium">
              {t("card.label.order")} {oid}
            </span>
          )}
          <span className="font-mono text-[11px] text-slate-400">{row.row_id.slice(0, 8)}…</span>
          {/* Mini badges */}
          {inv.length > 0 && (
            <span className="rounded bg-blue-600 text-white px-1.5 py-0.5 text-[10px] font-medium">{inv.length} inv</span>
          )}
          {cn.length > 0 && (
            <span className="rounded bg-violet-600 text-white px-1.5 py-0.5 text-[10px] font-medium">{cn.length} CN</span>
          )}
          {jRows.length > 0 && (
            <span className="rounded bg-amber-600 text-white px-1.5 py-0.5 text-[10px] font-medium">{jRows.length} jnl</span>
          )}
          {pay && (
            <span className="rounded bg-emerald-700 text-white px-1.5 py-0.5 text-[10px] font-medium">pmt</span>
          )}
          {isEmpty && (
            <span className="rounded bg-slate-300 text-slate-600 px-1.5 py-0.5 text-[10px]">{t("detail.pill.skipped")}</span>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Invoice */}
          {inv.length > 0 && (
            <div className="rounded-lg border border-blue-200 overflow-hidden">
              <div className="bg-blue-600 text-white text-[11px] font-semibold uppercase tracking-wide px-3 py-1.5 flex items-center justify-between">
                <span>{t("card.section.invoice")}</span>
                <span className="tabular-nums">{t("card.col.total")} {money(inv.reduce((s, l) => s + Number(l.amount ?? 0), 0))}</span>
              </div>
              <table className="min-w-full border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>{t("card.col.description")}</th>
                    <th className={TH}>{t("card.col.account")}</th>
                    <th className={`${TH} text-right`}>{t("card.col.qty")}</th>
                    <th className={`${TH} text-right`}>{t("card.col.rate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.map((li, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className={TD}>{li.label ?? li.canonical_key ?? "—"}</td>
                      <td className={TD}>{accountLabel(li.account_name, li.account_id)}</td>
                      <td className={`${TD} text-right tabular-nums`}>1</td>
                      <td className={`${TD} text-right tabular-nums font-medium`}>{money(Number(li.amount ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Credit note */}
          {cn.length > 0 && (
            <div className="rounded-lg border border-violet-200 overflow-hidden">
              <div className="bg-violet-600 text-white text-[11px] font-semibold uppercase tracking-wide px-3 py-1.5 flex items-center justify-between">
                <span>{t("card.section.cn")}</span>
                <span className="tabular-nums">{t("card.col.total")} {money(cn.reduce((s, l) => s + Math.abs(Number(l.amount ?? 0)), 0))}</span>
              </div>
              <table className="min-w-full border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>{t("card.col.description")}</th>
                    <th className={TH}>{t("card.col.account")}</th>
                    <th className={`${TH} text-right`}>{t("card.col.qty")}</th>
                    <th className={`${TH} text-right`}>{t("card.col.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {cn.map((li, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className={TD}>{li.label ?? li.canonical_key ?? "—"}</td>
                      <td className={TD}>{accountLabel(li.account_name, li.account_id)}</td>
                      <td className={`${TD} text-right tabular-nums`}>1</td>
                      <td className={`${TD} text-right tabular-nums font-medium`}>{money(Math.abs(Number(li.amount ?? 0)))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Journal */}
          {jRows.length > 0 && (
            <div className="rounded-lg border border-amber-200 overflow-hidden">
              <div className="bg-amber-600 text-white text-[11px] font-semibold uppercase tracking-wide px-3 py-1.5 flex items-center justify-between">
                <span>{balanced ? t("card.section.journalbal") : t("card.section.journal")}</span>
                <span className="tabular-nums text-amber-100 text-[10px]">
                  DR {money(jRows.filter(r => r.side === "debit").reduce((s, r) => s + r.amount, 0))} · CR {money(jRows.filter(r => r.side === "credit").reduce((s, r) => s + r.amount, 0))}
                </span>
              </div>
              <table className="min-w-full border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>{t("card.col.account")}</th>
                    <th className={TH}>{t("card.col.narration")}</th>
                    <th className={`${TH} text-right`}>{t("card.col.debit")}</th>
                    <th className={`${TH} text-right`}>{t("card.col.credit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {jRows.map((jr, i) => (
                    <tr key={i} className={`hover:bg-slate-50 ${jr.is_clearing ? "bg-amber-50/40" : ""}`}>
                      <td className={`${TD} ${jr.is_clearing ? "italic text-slate-500" : ""}`}>
                        {accountLabel(jr.account_name, jr.account_id)}
                      </td>
                      <td className={`${TD} font-mono text-[11px] text-slate-500`}>{jr.label || "—"}</td>
                      <td className={`${TD} text-right tabular-nums ${jr.side === "debit" ? "text-red-600 font-semibold" : "text-slate-300"}`}>
                        {jr.side === "debit" ? money(jr.amount) : "—"}
                      </td>
                      <td className={`${TD} text-right tabular-nums ${jr.side === "credit" ? "text-emerald-700 font-semibold" : "text-slate-300"}`}>
                        {jr.side === "credit" ? money(jr.amount) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Payment */}
          {pay && (
            <div className="rounded-lg border border-emerald-200 overflow-hidden">
              <div className="bg-emerald-700 text-white text-[11px] font-semibold uppercase tracking-wide px-3 py-1.5">
                {t("card.section.payment")}
              </div>
              <div className="px-3 py-2 text-xs text-slate-800 flex flex-wrap gap-4">
                <span><span className="text-slate-500">{t("card.pay.amount")}:</span> <span className="font-semibold tabular-nums">{money(Number(pay.amount ?? 0))}</span></span>
                <span><span className="text-slate-500">{t("card.pay.appliedto")}:</span> {t("card.pay.invoice")}</span>
                {(pay.account_name || pay.account_id) && (
                  <span><span className="text-slate-500">{t("card.pay.account")}:</span> {accountLabel(pay.account_name, pay.account_id)}</span>
                )}
              </div>
            </div>
          )}

          {isEmpty && (
            <p className="text-slate-400 text-xs italic text-center py-2">{t("card.empty")}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ledger table ────────────────────────────────────────────────────────────

function LedgerSummary({ data }: { data: DryRunResponseDTO }) {
  const t = useT();
  const rows = useMemo(() => buildLedger(data), [data]);
  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({ invoice: acc.invoice + r.invoice, cn: acc.cn + r.cn, jnl_dr: acc.jnl_dr + r.jnl_dr, jnl_cr: acc.jnl_cr + r.jnl_cr, payment: acc.payment + r.payment }),
    { invoice: 0, cn: 0, jnl_dr: 0, jnl_cr: 0, payment: 0 }
  ), [rows]);

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-700 text-white text-xs font-semibold uppercase tracking-wide px-4 py-2">
        {t("ledger.title")} — {data.rows.length} row{data.rows.length !== 1 ? "s" : ""}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className={TH + " w-56"}>{t("ledger.col.account")}</th>
              <th className={`${TH} text-right`}>{t("ledger.col.invoice")}</th>
              <th className={`${TH} text-right`}>{t("ledger.col.cn")}</th>
              <th className={`${TH} text-right text-red-600`}>{t("ledger.col.jnldr")}</th>
              <th className={`${TH} text-right text-emerald-700`}>{t("ledger.col.jnlcr")}</th>
              <th className={`${TH} text-right`}>{t("ledger.col.payment")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.account_id} className="hover:bg-slate-50">
                <td className={`${TD} font-medium truncate max-w-[14rem]`} title={r.account_name}>{r.account_name}</td>
                <td className={`${TD} text-right tabular-nums`}>{r.invoice ? money(r.invoice) : <span className="text-slate-300">—</span>}</td>
                <td className={`${TD} text-right tabular-nums`}>{r.cn ? money(r.cn) : <span className="text-slate-300">—</span>}</td>
                <td className={`${TD} text-right tabular-nums ${r.jnl_dr ? "text-red-600" : ""}`}>{r.jnl_dr ? money(r.jnl_dr) : <span className="text-slate-300">—</span>}</td>
                <td className={`${TD} text-right tabular-nums ${r.jnl_cr ? "text-emerald-700" : ""}`}>{r.jnl_cr ? money(r.jnl_cr) : <span className="text-slate-300">—</span>}</td>
                <td className={`${TD} text-right tabular-nums`}>{r.payment ? money(r.payment) : <span className="text-slate-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold text-slate-700">
              <td className={TD}>{t("ledger.row.total")}</td>
              <td className={`${TD} text-right tabular-nums`}>{dash(totals.invoice)}</td>
              <td className={`${TD} text-right tabular-nums`}>{dash(totals.cn)}</td>
              <td className={`${TD} text-right tabular-nums text-red-600`}>{dash(totals.jnl_dr)}</td>
              <td className={`${TD} text-right tabular-nums text-emerald-700`}>{dash(totals.jnl_cr)}</td>
              <td className={`${TD} text-right tabular-nums`}>{dash(totals.payment)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function RunDetailPage() {
  const t = useT();
  const { run_id = "" } = useParams<{ run_id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [dryData, setDryData] = useState<DryRunResponseDTO | null>(null);
  const [dryError, setDryError] = useState("");
  const [dryLoading, setDryLoading] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const [showRawDry, setShowRawDry] = useState(false);

  const [pubOut, setPubOut] = useState("");
  const [profileId, setProfileId] = useState<string>("");
  const [applyMsg, setApplyMsg] = useState<string>("");
  const [deleteErr, setDeleteErr] = useState("");
  const [deleting, setDeleting] = useState(false);

  const { data: run, isLoading, error } = useQuery({
    queryKey: ["pipelineRun", run_id],
    queryFn: () => fetchRun(run_id),
    enabled: !!run_id,
    staleTime: 30_000,
  });

  const sourceKey = run?.source_key ?? "walmart";

  const { data: profiles = [] } = useQuery({
    queryKey: ["mappingProfiles", sourceKey],
    queryFn: () => fetchProfiles(sourceKey),
    enabled: !!run?.source_key,
  });

  const defaultProfile = profiles.find((p) => p.is_default) ?? profiles[0];

  // Auto-load dry-run when run is ready and has a profile
  useEffect(() => {
    if (!run?.id || !run.profile_id || dryData || dryLoading) return;
    void (async () => {
      setDryLoading(true);
      setDryError("");
      try {
        const data = await dryRun(run_id, 50);
        setDryData(data);
      } catch (e) {
        setDryError(String(e));
      } finally {
        setDryLoading(false);
      }
    })();
  }, [run?.id, run?.profile_id]);

  async function handleRefreshDryRun() {
    setDryLoading(true);
    setDryError("");
    setDryData(null);
    try {
      const data = await dryRun(run_id, 50);
      setDryData(data);
      setShowAllRows(false);
    } catch (e) {
      setDryError(String(e));
    } finally {
      setDryLoading(false);
    }
  }

  async function handlePublish() {
    try {
      const data = await publishRun(run_id);
      setPubOut(JSON.stringify(data, null, 2));
    } catch (e) {
      setPubOut(String(e));
    }
  }

  async function handlePublishAsync() {
    try {
      const data = await publishRunAsync(run_id);
      setPubOut(JSON.stringify(data, null, 2));
    } catch (e) {
      setPubOut(String(e));
    }
  }

  async function handleDeleteRun() {
    if (!confirm(t("detail.confirm.delete"))) return;
    setDeleteErr("");
    setDeleting(true);
    try {
      await deleteRun(run_id);
      await qc.invalidateQueries({ queryKey: ["pipelineRuns"] });
      navigate("/runs");
    } catch (e) {
      setDeleteErr(String(e));
    } finally {
      setDeleting(false);
    }
  }

  async function handleApplyProfile() {
    const pid = profileId || defaultProfile?.id;
    if (!pid) return;
    try {
      await applyProfileToRun(run_id, pid);
      setApplyMsg(t("detail.msg.applied"));
      await qc.invalidateQueries({ queryKey: ["pipelineRun", run_id] });
      // Re-run preview with new profile
      void handleRefreshDryRun();
    } catch (e) {
      setApplyMsg(String(e));
    }
  }

  const publishSummary = useMemo(() => {
    if (!pubOut.trim()) return null;
    try {
      const o = JSON.parse(pubOut) as { published?: number };
      if (typeof o.published === "number") return `${t("detail.section.publish")}: ${o.published} row(s).`;
    } catch { /* ignore */ }
    return null;
  }, [pubOut]);

  const drySummary = useMemo(() => (dryData ? summarizeDryRun(dryData) : null), [dryData]);
  const ROW_CAP = 5;
  const allRows = dryData?.rows ?? [];
  const visibleRows = showAllRows ? allRows : allRows.slice(0, ROW_CAP);

  return (
    <AppShell title={t("page.detail.title")} subtitle={run_id}>
      <div className="p-4 max-w-5xl mx-auto space-y-5">
        {isLoading ? <p className="text-sm text-slate-600">{t("common.loading")}</p> : null}
        {error ? <p className="text-sm text-red-700">{String(error)}</p> : null}

        {/* ── 1. Run metadata ── */}
        {run ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm space-y-2">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-700">
              <span><span className="text-slate-400">{t("detail.meta.source")}</span> <span className="font-mono font-medium">{run.source_key}</span></span>
              <span><span className="text-slate-400">{t("detail.meta.status")}</span> <span className={`font-medium ${run.status === "completed" ? "text-emerald-700" : "text-slate-700"}`}>{run.status}</span></span>
              <span><span className="text-slate-400">{t("detail.meta.rows")}</span> <span className="font-medium">{run.total_rows}</span> {t("detail.meta.total")} · <span className="font-medium">{run.processed_rows}</span> {t("detail.meta.processed")}</span>
              <span><span className="text-slate-400">{t("detail.meta.profile")}</span> <span className="font-mono text-xs">{run.profile_id ?? t("detail.meta.none")}</span></span>
            </div>
            <div className="pt-1 flex flex-wrap gap-3 items-center text-xs">
              <Link className="text-blue-700 underline" to={`/mapping-studio/${run.source_key}`}>{t("detail.link.openstudio")}</Link>
              <Link className="text-blue-700 underline" to="/upload">{t("detail.link.anotherupload")}</Link>
              <button type="button" className="text-red-600 underline disabled:opacity-50" disabled={deleting} onClick={() => void handleDeleteRun()}>
                {t("detail.btn.deleterun")}
              </button>
            </div>
            {deleteErr ? <p className="text-red-700 text-xs">{deleteErr}</p> : null}
          </div>
        ) : null}

        {/* ── 2. Apply profile ── */}
        {run && profiles.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <h2 className="text-sm font-semibold text-slate-800">{t("detail.section.profile")}</h2>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                value={profileId || defaultProfile?.id || ""}
                onChange={(e) => setProfileId(e.target.value)}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.profile_name}{p.is_default ? " (default)" : ""}
                  </option>
                ))}
              </select>
              <button type="button" className="rounded bg-slate-700 text-white px-3 py-1.5 text-sm" onClick={handleApplyProfile}>
                {t("detail.btn.applyprev")}
              </button>
              {applyMsg ? <span className="text-xs text-slate-600">{applyMsg}</span> : null}
            </div>
          </div>
        ) : null}

        {/* ── 3. Preview (auto-loaded) ── */}
        {run ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                {t("detail.section.preview")}
                {dryLoading && <span className="ml-2 text-xs font-normal text-slate-400 animate-pulse">{t("detail.preview.loading")}</span>}
              </h2>
              <div className="flex gap-2">
                {!run.profile_id && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    {t("detail.preview.noprofile")}
                  </p>
                )}
                <button type="button" className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50" onClick={handleRefreshDryRun} disabled={dryLoading}>
                  {dryLoading ? t("detail.btn.refreshing") : t("detail.btn.refresh")}
                </button>
              </div>
            </div>

            {dryError ? <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{dryError}</p> : null}

            {dryData && drySummary ? (
              <>
                {/* Summary stat pills */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-blue-100 text-blue-800 px-3 py-1 font-medium">
                    {t("detail.pill.invoice")} {money(drySummary.invoiceTotal)}
                  </span>
                  {drySummary.cnTotal > 0 && (
                    <span className="rounded-full bg-violet-100 text-violet-800 px-3 py-1 font-medium">
                      {t("detail.pill.cn")} {money(drySummary.cnTotal)}
                    </span>
                  )}
                  {drySummary.jnlLines > 0 && (
                    <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 font-medium">
                      {drySummary.jnlLines} {drySummary.jnlLines !== 1 ? t("detail.pill.jnllines") : t("detail.pill.jnlline")}
                    </span>
                  )}
                  {drySummary.payTotal > 0 && (
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 font-medium">
                      {t("detail.pill.payment")} {money(drySummary.payTotal)}
                    </span>
                  )}
                  {drySummary.skipped > 0 && (
                    <span className="rounded-full bg-slate-200 text-slate-600 px-3 py-1">
                      {drySummary.skipped} {t("detail.pill.skipped")}
                    </span>
                  )}
                  <span className="rounded-full bg-slate-100 text-slate-500 px-3 py-1">
                    {drySummary.rowCount} {t("detail.pill.rowsmax")}
                  </span>
                </div>

                {/* Consolidated ledger */}
                <LedgerSummary data={dryData} />

                {/* Per-row document cards */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">{t("detail.rows.heading")}</h3>
                    {allRows.length > ROW_CAP && (
                      <button type="button" className="text-xs text-blue-700 underline" onClick={() => setShowAllRows((v) => !v)}>
                        {showAllRows
                          ? `${t("detail.rows.showfirst")} ${ROW_CAP} ${t("detail.rows.only")}`
                          : `${t("detail.rows.showall")} ${allRows.length} ${t("detail.rows.rows")}`}
                      </button>
                    )}
                  </div>
                  {visibleRows.map((row, idx) => (
                    <RowDocCard key={row.row_id} row={row} idx={allRows.indexOf(row)} defaultOpen={idx < ROW_CAP} />
                  ))}
                </div>

                {/* Raw JSON toggle */}
                <div>
                  <button type="button" className="text-xs text-slate-500 underline" onClick={() => setShowRawDry((v) => !v)}>
                    {showRawDry ? t("detail.json.hide") : t("detail.json.show")}
                  </button>
                  {showRawDry && (
                    <pre className="mt-2 text-xs bg-slate-900 text-green-100 p-3 rounded overflow-auto max-h-64">
                      {JSON.stringify(dryData, null, 2)}
                    </pre>
                  )}
                </div>
              </>
            ) : null}

            {!dryLoading && !dryData && !dryError && !run.profile_id ? null : (
              !dryLoading && !dryData && !dryError ? (
                <p className="text-xs text-slate-400 italic">{t("detail.preview.waiting")}</p>
              ) : null
            )}
          </div>
        ) : null}

        {/* ── 4. Publish ── */}
        {run ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-amber-900">{t("detail.section.publish")}</h2>
              <p className="text-xs text-amber-700 mt-0.5">{t("detail.publish.warning")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded bg-amber-700 text-white px-4 py-2 text-sm font-medium hover:bg-amber-800" onClick={handlePublish}>
                {t("detail.btn.publishsync")}
              </button>
              <button type="button" className="rounded border border-amber-600 text-amber-800 bg-white px-4 py-2 text-sm font-medium hover:bg-amber-50" onClick={handlePublishAsync}>
                {t("detail.btn.publishasync")}
              </button>
            </div>
            {publishSummary ? (
              <p className="text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{publishSummary}</p>
            ) : null}
            {pubOut && !publishSummary ? (
              <pre className="text-xs bg-slate-900 text-amber-100 p-3 rounded overflow-auto max-h-48">{pubOut}</pre>
            ) : null}
            {pubOut && publishSummary ? (
              <details className="text-xs">
                <summary className="cursor-pointer text-amber-800 underline">{t("detail.publish.rawresponse")}</summary>
                <pre className="mt-2 text-xs bg-slate-900 text-amber-100 p-3 rounded overflow-auto max-h-40">{pubOut}</pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
