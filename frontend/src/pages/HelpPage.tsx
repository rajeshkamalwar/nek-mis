import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  GitMerge,
  HelpCircle,
  Info,
  Map,
  Package,
  PlayCircle,
  Send,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  Upload,
} from "lucide-react";
import { AppShell } from "../components/AppShell";

// ─── Data ─────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: 1,
    icon: Upload,
    color: "bg-indigo-600",
    title: "Upload your settlement CSV",
    summary: "Import the marketplace payout report into the system.",
    detail: "Go to the Upload page, select your marketplace (Walmart CA, Amazon USA, Amazon CA, or OnBuy), then drag-and-drop or browse for your CSV file. Click Import. The system reads every row and creates a Run.",
    link: "/upload",
    linkLabel: "Go to Upload",
  },
  {
    n: 2,
    icon: Map,
    color: "bg-violet-600",
    title: "Map columns in Mapping Studio",
    summary: "Connect CSV data fields to your Zoho Books accounts.",
    detail: "Open Mapping Studio for your marketplace. You will see a canvas with CSV column nodes on the left. Drag a line from a column node to a Zoho account node on the right to create a mapping rule. Set the document kind (Invoice, Journal, Payment, Credit Note), sign hint, and optional formula or condition. Save when done.",
    link: "/mapping-studio/walmart",
    linkLabel: "Open Mapping Studio",
  },
  {
    n: 3,
    icon: PlayCircle,
    color: "bg-amber-500",
    title: "Preview the entries (Dry Run)",
    summary: "See exactly what will be posted before sending anything to Zoho.",
    detail: "Open your Run from the Runs page. The preview loads automatically — it shows a Ledger Summary (totals by account) and a per-row card view of every journal/invoice/payment entry. Verify the debits and credits balance before publishing.",
    link: "/runs",
    linkLabel: "Go to Runs",
  },
  {
    n: 4,
    icon: Send,
    color: "bg-emerald-600",
    title: "Publish to Zoho Books",
    summary: "Send the verified entries live to your Zoho Books organisation.",
    detail: "On the Run Detail page, click Publish. The system creates the documents in Zoho Books in the background via Celery. You can watch the progress bar. Once complete the run status turns green (Completed).",
    link: "/runs",
    linkLabel: "View Runs",
  },
];

const SOURCES = [
  { Icon: ShoppingCart, label: "Walmart CA",   desc: "Walmart Canada settlement report",       color: "text-blue-600 bg-blue-50" },
  { Icon: Package,      label: "Amazon USA",   desc: "Amazon US marketplace settlement",        color: "text-amber-600 bg-amber-50" },
  { Icon: ShoppingBag,  label: "Amazon CA",    desc: "Amazon Canada marketplace settlement",    color: "text-orange-600 bg-orange-50" },
  { Icon: Store,        label: "OnBuy",        desc: "OnBuy marketplace payout report",         color: "text-emerald-600 bg-emerald-50" },
];

const FAQS = [
  {
    q: "What CSV format is supported?",
    a: "Each marketplace has its own standard settlement report format. Download the settlement report directly from the marketplace seller portal — no reformatting needed.",
  },
  {
    q: "What if I upload the wrong file?",
    a: "Go to the Runs page, find the run, and click the delete (trash) button. Then re-upload the correct file.",
  },
  {
    q: "Can I re-use the same mapping for multiple runs?",
    a: "Yes. Mapping rules are saved as a Profile per marketplace. Every new run for the same marketplace automatically uses the same mapping rules — you only set them up once.",
  },
  {
    q: "What does the sign hint do?",
    a: "It controls whether the value is posted as a debit or credit. 'Positive = Debit' means a positive CSV value becomes a debit entry in Zoho Books.",
  },
  {
    q: "What if Zoho credentials expire?",
    a: "Go to Settings and paste a fresh Refresh Token. The system automatically uses it to get new Access Tokens — you never need to enter an Access Token manually.",
  },
  {
    q: "Can I preview without publishing?",
    a: "Yes. The Dry Run preview on the Run Detail page never writes anything to Zoho Books. Publish is a separate, explicit action.",
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function StepCard({ step }: { step: typeof STEPS[0] }) {
  const Icon = step.icon;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className={`${step.color} px-5 py-4 flex items-center gap-3`}>
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">{step.n}</span>
        </div>
        <Icon className="w-5 h-5 text-white shrink-0" />
        <h3 className="text-white font-semibold text-sm leading-tight">{step.title}</h3>
      </div>
      <div className="p-5 flex-1 flex flex-col gap-3">
        <p className="text-slate-500 text-xs leading-relaxed">{step.detail}</p>
        <div className="mt-auto pt-2">
          <Link
            to={step.link}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {step.linkLabel} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <div className="flex gap-2.5 mb-1.5">
        <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-sm font-semibold text-slate-800">{q}</p>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed pl-6">{a}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HelpPage() {
  return (
    <AppShell title="How to Use NEK-MIS" subtitle="Step-by-step guide to importing and posting marketplace settlements">
      <div className="max-w-5xl mx-auto p-6 space-y-8">

        {/* Intro banner */}
        <div className="bg-indigo-600 rounded-2xl p-6 flex gap-4 items-start text-white shadow-md">
          <BookOpen className="w-8 h-8 shrink-0 mt-0.5 opacity-90" />
          <div>
            <h2 className="font-bold text-lg leading-tight">NEK-MIS — Neksoft Mapping Integration Studio</h2>
            <p className="text-indigo-200 text-sm mt-1 leading-relaxed">
              NEK-MIS automates the process of taking marketplace settlement reports (CSV files) and posting the correct
              accounting entries — invoices, journals, payments, credit notes — directly into your Zoho Books organisation.
              No manual data entry, no spreadsheet copy-paste.
            </p>
          </div>
        </div>

        {/* Workflow overview */}
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-indigo-500" /> How it works — 4 steps
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s) => <StepCard key={s.n} step={s} />)}
          </div>
        </div>

        {/* Flow diagram (text-based) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400" /> The full flow at a glance
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {[
              { label: "Marketplace CSV", bg: "bg-slate-100 text-slate-700" },
              null,
              { label: "Upload Page", bg: "bg-indigo-100 text-indigo-700" },
              null,
              { label: "Run created", bg: "bg-slate-100 text-slate-700" },
              null,
              { label: "Mapping Studio", bg: "bg-violet-100 text-violet-700" },
              null,
              { label: "Profile saved", bg: "bg-slate-100 text-slate-700" },
              null,
              { label: "Dry Run preview", bg: "bg-amber-100 text-amber-700" },
              null,
              { label: "Publish", bg: "bg-emerald-100 text-emerald-700" },
              null,
              { label: "Zoho Books ✓", bg: "bg-emerald-600 text-white" },
            ].map((item, i) =>
              item === null
                ? <ArrowRight key={i} className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                : <span key={i} className={`px-3 py-1.5 rounded-lg ${item.bg}`}>{item.label}</span>
            )}
          </div>
        </div>

        {/* Supported sources */}
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-indigo-500" /> Supported marketplaces
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {SOURCES.map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 shadow-sm">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                  <s.Icon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{s.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-amber-900 flex items-center gap-2">
            <Info className="w-4 h-4" /> Tips for first-time setup
          </h2>
          <ul className="space-y-2.5">
            {[
              "Go to Settings first and test your Zoho Books connection before uploading any file.",
              "Set up mapping rules for a marketplace once — every future upload for that marketplace reuses the same profile automatically.",
              "Always do a Dry Run preview and verify the ledger balances before clicking Publish.",
              "You can delete a run at any time from the Runs page if you uploaded the wrong file — nothing is sent to Zoho until you explicitly publish.",
              "Use the language toggle (EN / हिं) in the top navigation to switch between English and Hindi.",
            ].map((tip, i) => (
              <li key={i} className="flex gap-2.5 items-start text-xs text-amber-800">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-indigo-500" /> Frequently asked questions
          </h2>
          <div className="space-y-4">
            {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-4">
          {[
            { to: "/upload",     Icon: Upload,   label: "Upload CSV",      color: "text-indigo-600" },
            { to: "/mapping-studio/walmart", Icon: Map, label: "Mapping Studio", color: "text-violet-600" },
            { to: "/runs",       Icon: PlayCircle, label: "View Runs",     color: "text-amber-600" },
            { to: "/settings",   Icon: Settings, label: "Settings",        color: "text-slate-600" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col items-center gap-2 hover:border-indigo-300 hover:shadow-md transition-all group"
            >
              <item.Icon className={`w-6 h-6 ${item.color} group-hover:scale-110 transition-transform`} />
              <span className="text-xs font-semibold text-slate-700">{item.label}</span>
            </Link>
          ))}
        </div>

      </div>
    </AppShell>
  );
}
