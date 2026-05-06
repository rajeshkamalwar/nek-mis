import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  LayoutGrid,
  Loader2,
  Package,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
} from "lucide-react";

import { deleteRun, fetchRuns } from "../api/client";
import { AppShell } from "../components/AppShell";
import { useT } from "../i18n/LangContext";

// ─── Source config ────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  walmart: "Walmart CA",
  amazon_usa: "Amazon USA",
  amazon_ca: "Amazon CA",
  onbuy: "OnBuy",
};

type SourceTheme = {
  dot: string;
  pill: string;
  cardBorder: string;
  headerBg: string;
  headerText: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const SOURCE_THEME: Record<string, SourceTheme> = {
  walmart:    { dot: "bg-blue-500",    pill: "bg-blue-600 text-white border-blue-600",     cardBorder: "border-l-blue-500",    headerBg: "bg-blue-600",    headerText: "text-white", Icon: ShoppingCart },
  amazon_usa: { dot: "bg-amber-500",   pill: "bg-amber-500 text-white border-amber-500",   cardBorder: "border-l-amber-500",   headerBg: "bg-amber-500",   headerText: "text-white", Icon: Package },
  amazon_ca:  { dot: "bg-orange-500",  pill: "bg-orange-500 text-white border-orange-500", cardBorder: "border-l-orange-500",  headerBg: "bg-orange-500",  headerText: "text-white", Icon: ShoppingBag },
  onbuy:      { dot: "bg-emerald-600", pill: "bg-emerald-600 text-white border-emerald-600", cardBorder: "border-l-emerald-600", headerBg: "bg-emerald-600", headerText: "text-white", Icon: Store },
};

function theme(key: string): SourceTheme {
  return SOURCE_THEME[key] ?? {
    dot: "bg-slate-400", pill: "bg-slate-700 text-white border-slate-700",
    cardBorder: "border-l-slate-400", headerBg: "bg-slate-700", headerText: "text-white", Icon: LayoutGrid,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatusPill({ status }: { status: string }) {
  const cfg =
    status === "completed" ? "bg-emerald-100 text-emerald-800 ring-emerald-300" :
    status === "failed"    ? "bg-red-100 text-red-800 ring-red-300" :
    status === "running"   ? "bg-blue-100 text-blue-800 ring-blue-300 animate-pulse" :
                             "bg-amber-100 text-amber-800 ring-amber-300";
  const dot =
    status === "completed" ? "bg-emerald-500" :
    status === "failed"    ? "bg-red-500" :
    status === "running"   ? "bg-blue-500" : "bg-amber-500";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${cfg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

// ─── Run card ─────────────────────────────────────────────────────────────────

type Run = { id: string; source_key: string; status: string; zoho_status?: string | null; total_rows: number; processed_rows: number; started_at?: string | null; profile_id?: string | null; published_at?: string | null };

function RunCard({ run, onDelete, deleteDisabled, t }: { run: Run; onDelete: () => void; deleteDisabled: boolean; t: (k: string) => string }) {
  const th = theme(run.source_key);
  const pct = run.total_rows > 0 ? Math.round((run.processed_rows / run.total_rows) * 100) : 0;
  const isComplete = run.status === "completed";
  const isFailed = run.status === "failed";

  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${th.cardBorder} shadow-sm hover:shadow-md transition-shadow`}>
      <div className="p-4">
        {/* Top row: status + time */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusPill status={run.status} />
            {run.zoho_status && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ring-inset ${
                run.zoho_status === "published" ? "bg-teal-100 text-teal-800 ring-teal-300" :
                run.zoho_status === "failed" ? "bg-red-100 text-red-800 ring-red-300" :
                run.zoho_status === "partial" ? "bg-orange-100 text-orange-800 ring-orange-300" :
                "bg-slate-100 text-slate-600 ring-slate-300"
              }`}>
                Zoho: {run.zoho_status}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400 font-mono whitespace-nowrap mt-0.5" title={run.started_at ?? ""}>
            {timeAgo(run.started_at)}
          </span>
        </div>

        {/* Rows progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Rows processed</span>
            <span className="text-xs font-semibold tabular-nums text-slate-700">
              {run.processed_rows} <span className="text-slate-400 font-normal">/ {run.total_rows}</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isComplete ? "bg-emerald-500" : isFailed ? "bg-red-400" : "bg-amber-400"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-right text-[10px] text-slate-400 mt-0.5">{pct}%</p>
        </div>

        {/* Run ID + profile */}
        <div className="text-[10px] text-slate-400 font-mono truncate mb-3">
          {run.id.slice(0, 16)}…
          {run.profile_id && (
            <span className="ml-2 text-indigo-400">profile attached</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <Link
            to={`/runs/${run.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg px-3 py-1.5 transition-colors"
          >
            {t("runs.action.view")} <ChevronRight className="w-3 h-3" />
          </Link>
          <button
            type="button"
            disabled={deleteDisabled}
            onClick={onDelete}
            className="flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg px-2 py-1.5 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ runs }: { runs: Run[] }) {
  const total = runs.length;
  const completed = runs.filter(r => r.status === "completed").length;
  const pending = runs.filter(r => r.status !== "completed" && r.status !== "failed").length;
  const failed = runs.filter(r => r.status === "failed").length;
  const totalRows = runs.reduce((s, r) => s + r.total_rows, 0);
  const processedRows = runs.reduce((s, r) => s + r.processed_rows, 0);

  const stat = (label: string, value: string | number, accent: string) => (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</span>
      <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-white rounded-xl border border-slate-200 px-6 py-4 shadow-sm">
      {stat("Total Runs", total, "text-slate-900")}
      {stat("Completed", completed, "text-emerald-600")}
      {stat("Pending", pending, "text-amber-600")}
      {stat("Failed", failed, "text-red-500")}
      {stat("Rows Processed", `${processedRows.toLocaleString()} / ${totalRows.toLocaleString()}`, "text-indigo-600")}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RunsListPage() {
  const t = useT();
  const qc = useQueryClient();
  const [deleteErr, setDeleteErr] = useState("");
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [activeZohoStatus, setActiveZohoStatus] = useState<string | null>(null);
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(() => new Set());

  const { data: runs = [], isLoading, error } = useQuery({
    queryKey: ["pipelineRuns"],
    queryFn: () => fetchRuns(100),
  });

  const delMut = useMutation({
    mutationFn: deleteRun,
    onSuccess: () => {
      setDeleteErr("");
      void qc.invalidateQueries({ queryKey: ["pipelineRuns"] });
    },
    onError: (e) => setDeleteErr(String(e)),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Run[]>();
    for (const r of runs) {
      if (!map.has(r.source_key)) map.set(r.source_key, []);
      map.get(r.source_key)!.push(r);
    }
    return Array.from(map.entries()).sort(([, a], [, b]) => {
      const at = a[0]?.started_at ?? "";
      const bt = b[0]?.started_at ?? "";
      return bt.localeCompare(at);
    });
  }, [runs]);

  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      if (activeZohoStatus === "published") return r.zoho_status === "published";
      if (activeZohoStatus === "partial") return r.zoho_status === "partial";
      if (activeZohoStatus === "failed") return r.zoho_status === "failed";
      if (activeZohoStatus === "unpublished") return !r.zoho_status;
      return true;
    });
  }, [runs, activeZohoStatus]);

  const filteredGroups = useMemo(() => {
    const base = activeSource ? filteredRuns.filter((r) => r.source_key === activeSource) : filteredRuns;
    const map = new Map<string, Run[]>();
    for (const r of base) {
      if (!map.has(r.source_key)) map.set(r.source_key, []);
      map.get(r.source_key)!.push(r);
    }
    return Array.from(map.entries()).sort(([, a], [, b]) => {
      const at = a[0]?.started_at ?? "";
      const bt = b[0]?.started_at ?? "";
      return bt.localeCompare(at);
    });
  }, [filteredRuns, activeSource]);

  function toggleCollapse(key: string) {
    setCollapsedSources((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <AppShell title={t("page.runs.title")} subtitle={t("page.runs.subtitle")}>
      <div className="p-4 max-w-6xl mx-auto space-y-5">
        {isLoading && (
          <div className="flex items-center gap-3 text-slate-500 text-sm py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            {t("common.loading")}
          </div>
        )}
        {error && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 border border-red-200">{String(error)}</p>}
        {deleteErr && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 border border-red-200">{deleteErr}</p>}

        {/* Empty state */}
        {!isLoading && !error && runs.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <div className="flex justify-center">
              <FolderOpen className="w-16 h-16 text-slate-300" />
            </div>
            <p className="text-slate-500 text-sm">{t("runs.noruns")}</p>
            <Link
              to="/upload"
              className="inline-flex items-center gap-1.5 mt-2 bg-slate-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-slate-700 transition-colors"
            >
              {t("runs.uploadcsv")} <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {runs.length > 0 && (
          <>
            {/* Summary strip */}
            <SummaryStrip runs={runs} />

            {/* Source filter tabs */}
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={() => setActiveSource(null)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  activeSource === null
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-white text-slate-600 border-slate-300 hover:border-slate-600"
                }`}
              >
                All sources ({runs.length})
              </button>
              {grouped.map(([key, groupRuns]) => {
                const th = theme(key);
                const active = activeSource === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveSource(active ? null : key)}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      active ? th.pill + " shadow-sm" : "bg-white text-slate-600 border-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${th.dot}`} />
                    {SOURCE_LABELS[key] ?? key}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? "bg-white/25" : "bg-slate-100 text-slate-500"}`}>
                      {groupRuns.length}
                    </span>
                  </button>
                );
              })}

              {/* Upload shortcut */}
              <Link
                to="/upload"
                className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> New upload
              </Link>
            </div>

            {/* Zoho publish status filter */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-slate-500 font-medium">Zoho status:</span>
              {([null, "published", "partial", "failed", "unpublished"] as const).map((s) => (
                <button
                  key={s ?? "all"}
                  type="button"
                  onClick={() => setActiveZohoStatus(s)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    activeZohoStatus === s
                      ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-500"
                  }`}
                >
                  {s === null ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {/* Groups */}
            <div className="space-y-6">
              {filteredGroups.map(([sourceKey, sourceRuns]) => {
                const th = theme(sourceKey);
                const collapsed = collapsedSources.has(sourceKey);
                const completed = sourceRuns.filter(r => r.status === "completed").length;
                const totalRows = sourceRuns.reduce((s, r) => s + r.total_rows, 0);

                return (
                  <div key={sourceKey}>
                    {/* Section header */}
                    <button
                      type="button"
                      onClick={() => toggleCollapse(sourceKey)}
                      className="w-full flex items-center gap-3 mb-3 group"
                    >
                      <div className={`w-8 h-8 rounded-lg ${th.headerBg} flex items-center justify-center shadow-sm`}>
                        <th.Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="font-bold text-slate-900 text-sm">{SOURCE_LABELS[sourceKey] ?? sourceKey}</span>
                        <span className="text-xs text-slate-500">
                          {sourceRuns.length} run{sourceRuns.length !== 1 ? "s" : ""}
                          {" · "}
                          {completed} completed
                          {" · "}
                          {totalRows.toLocaleString()} rows
                        </span>
                      </div>
                      <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
                        {collapsed
                          ? <ChevronRight className="w-4 h-4" />
                          : <ChevronDown className="w-4 h-4" />
                        }
                      </span>
                    </button>

                    {/* Horizontal rule */}
                    <div className={`h-0.5 rounded-full ${th.headerBg} opacity-30 mb-4`} />

                    {/* Cards grid */}
                    {!collapsed && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {sourceRuns.map((r) => (
                          <RunCard
                            key={r.id}
                            run={r}
                            t={t}
                            deleteDisabled={delMut.isPending}
                            onDelete={() => {
                              if (!confirm(t("runs.confirm.delete"))) return;
                              delMut.mutate(r.id);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
