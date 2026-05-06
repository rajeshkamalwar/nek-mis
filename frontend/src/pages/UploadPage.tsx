import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  File,
  FolderOpen,
  Lightbulb,
  Loader2,
  Map,
  Package,
  ShoppingBag,
  ShoppingCart,
  Store,
  Upload,
} from "lucide-react";

import { uploadCsv } from "../api/client";
import { AppShell } from "../components/AppShell";
import { useT } from "../i18n/LangContext";

// ─── Source config ────────────────────────────────────────────────────────────

const SOURCES = [
  {
    value: "walmart",
    label: "Walmart CA",
    Icon: ShoppingCart,
    desc: "Walmart Canada settlement report",
    ring: "ring-blue-500 border-blue-500",
    iconBg: "bg-blue-100 text-blue-600",
    activeBg: "bg-blue-50",
  },
  {
    value: "amazon_usa",
    label: "Amazon USA",
    Icon: Package,
    desc: "Amazon US marketplace settlement",
    ring: "ring-amber-500 border-amber-500",
    iconBg: "bg-amber-100 text-amber-600",
    activeBg: "bg-amber-50",
  },
  {
    value: "amazon_ca",
    label: "Amazon CA",
    Icon: ShoppingBag,
    desc: "Amazon Canada marketplace settlement",
    ring: "ring-orange-500 border-orange-500",
    iconBg: "bg-orange-100 text-orange-600",
    activeBg: "bg-orange-50",
  },
  {
    value: "onbuy",
    label: "OnBuy",
    Icon: Store,
    desc: "OnBuy marketplace payout report",
    ring: "ring-emerald-500 border-emerald-500",
    iconBg: "bg-emerald-100 text-emerald-600",
    activeBg: "bg-emerald-50",
  },
] as const;

type SourceValue = (typeof SOURCES)[number]["value"];

// ─── Step header ──────────────────────────────────────────────────────────────

function StepHeader({ n, label }: { n: number; label: string }) {
  return (
    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2.5">
      <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
        {n}
      </span>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
    </div>
  );
}

// ─── Drop-zone ────────────────────────────────────────────────────────────────

function DropZone({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith(".csv") || dropped.type.includes("csv"))) {
      onChange(dropped);
    }
  }

  return (
    <div
      className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer select-none ${
        dragOver
          ? "border-indigo-400 bg-indigo-50"
          : file
            ? "border-emerald-400 bg-emerald-50"
            : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white"
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
        {file ? (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-emerald-800 text-sm">{file.name}</p>
              <p className="text-xs text-emerald-600 mt-0.5">{(file.size / 1024).toFixed(1)} KB · click to replace</p>
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
              {dragOver
                ? <FolderOpen className="w-6 h-6 text-indigo-500" />
                : <File className="w-6 h-6 text-slate-400" />
              }
            </div>
            <div>
              <p className="font-semibold text-slate-700 text-sm">
                {dragOver ? "Drop it here" : "Drop your CSV here"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">or click to browse · .csv files only</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function UploadPage() {
  const t = useT();
  const [sourceKey, setSourceKey] = useState<SourceValue>(SOURCES[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [duplicateOf, setDuplicateOf] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedSource = SOURCES.find(s => s.value === sourceKey)!;

  async function handleUpload() {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    setRunId(null);
    setTotalRows(null);
    setDuplicateOf(null);
    try {
      const data = await uploadCsv(file, sourceKey);
      setRunId(data.run_id);
      setTotalRows(data.total_rows);
      setDuplicateOf(data.duplicate_of ?? null);
      setMessage({ text: `Successfully imported ${data.total_rows} row(s).`, ok: true });
    } catch (err) {
      setMessage({ text: String(err), ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title={t("page.upload.title")} subtitle={t("page.upload.subtitle")}>
      <div className="max-w-2xl mx-auto p-6 space-y-5">

        {/* Step 1 — Choose marketplace */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <StepHeader n={1} label="Choose marketplace" />
          <div className="p-4 grid grid-cols-2 gap-3">
            {SOURCES.map((s) => {
              const active = sourceKey === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSourceKey(s.value)}
                  className={`flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${
                    active
                      ? `ring-2 ${s.ring} ${s.activeBg}`
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? s.iconBg : "bg-slate-100 text-slate-500"}`}>
                    <s.Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm leading-tight">{s.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{s.desc}</p>
                  </div>
                  {active && <CheckCircle2 className="w-4 h-4 text-current shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2 — Select file */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <StepHeader n={2} label="Select CSV file" />
          <div className="p-4">
            <DropZone file={file} onChange={setFile} />
          </div>
        </div>

        {/* Step 3 — Import */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <StepHeader n={3} label="Import" />
          <div className="p-4 space-y-4">
            {/* Selection summary */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <div className="flex items-center gap-1.5 text-slate-700">
                <selectedSource.Icon className="w-4 h-4 text-slate-500" />
                <span className="font-medium">{selectedSource.label}</span>
              </div>
              {file ? (
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <File className="w-4 h-4" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-xs text-emerald-500">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <span className="flex items-center gap-1.5 text-slate-400 italic text-xs">
                  <File className="w-3.5 h-3.5" /> No file selected
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={!file || busy}
              onClick={handleUpload}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm py-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {busy ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t("upload.btn.uploading")}</>
              ) : (
                <><Upload className="w-4 h-4" /> {t("upload.btn.upload")}</>
              )}
            </button>
          </div>
        </div>

        {/* Result */}
        {message && (
          <div className={`rounded-xl border p-4 space-y-3 ${
            message.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
          }`}>
            <div className="flex items-center gap-2.5">
              {message.ok
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              }
              <p className={`text-sm font-semibold ${message.ok ? "text-emerald-800" : "text-red-800"}`}>
                {message.text}
              </p>
            </div>

            {duplicateOf && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                <span>
                  This file looks identical to a previous upload.{" "}
                  <Link to={`/runs/${duplicateOf}`} className="underline font-semibold">View existing run</Link>
                  {" "}to avoid duplicates in Zoho.
                </span>
              </div>
            )}

            {runId && totalRows != null && message.ok && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Link
                  to={`/runs/${runId}`}
                  className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 transition-colors"
                >
                  <ArrowRight className="w-4 h-4" /> {t("upload.link.openrun")}
                </Link>
                <Link
                  to={`/mapping-studio/${sourceKey}`}
                  className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold py-2.5 transition-colors"
                >
                  <Map className="w-4 h-4" /> {t("upload.link.openstudio")}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" /> Tips
          </p>
          <ul className="text-xs text-slate-500 space-y-2">
            <li className="flex gap-2.5 items-start">
              <File className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
              Make sure the CSV has the standard settlement columns for your marketplace.
            </li>
            <li className="flex gap-2.5 items-start">
              <Map className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
              After upload, open Mapping Studio to connect CSV columns to Zoho accounts.
            </li>
            <li className="flex gap-2.5 items-start">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
              Use the Run Detail page to preview entries before publishing live to Zoho Books.
            </li>
          </ul>
        </div>

      </div>
    </AppShell>
  );
}
