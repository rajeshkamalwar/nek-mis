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
import { useT } from "../i18n/LangContext";

// ─── Step card ────────────────────────────────────────────────────────────────

type StepDef = {
  n: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  titleKey: string;
  detailKey: string;
  link: string;
  linkLabelKey: string;
};

const STEPS: StepDef[] = [
  { n: 1, icon: Upload,      color: "bg-indigo-600",  titleKey: "help.step1.title", detailKey: "help.step1.detail", link: "/upload",                    linkLabelKey: "nav.upload" },
  { n: 2, icon: Map,         color: "bg-violet-600",  titleKey: "help.step2.title", detailKey: "help.step2.detail", link: "/mapping-studio/walmart",    linkLabelKey: "nav.studio" },
  { n: 3, icon: PlayCircle,  color: "bg-amber-500",   titleKey: "help.step3.title", detailKey: "help.step3.detail", link: "/runs",                       linkLabelKey: "nav.runs" },
  { n: 4, icon: Send,        color: "bg-emerald-600", titleKey: "help.step4.title", detailKey: "help.step4.detail", link: "/runs",                       linkLabelKey: "detail.section.publish" },
];

type SourceDef = {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  descKey: string;
  color: string;
};

const SOURCES: SourceDef[] = [
  { Icon: ShoppingCart, label: "Walmart CA",  descKey: "help.walmart.desc",    color: "text-blue-600 bg-blue-50" },
  { Icon: Package,      label: "Amazon USA",  descKey: "help.amazon_usa.desc", color: "text-amber-600 bg-amber-50" },
  { Icon: ShoppingBag,  label: "Amazon CA",   descKey: "help.amazon_ca.desc",  color: "text-orange-600 bg-orange-50" },
  { Icon: Store,        label: "OnBuy",       descKey: "help.onbuy.desc",      color: "text-emerald-600 bg-emerald-50" },
];

const TIP_KEYS = ["help.tip1", "help.tip2", "help.tip3", "help.tip4", "help.tip5"];

const FAQ_KEYS = [
  { q: "help.faq1.q", a: "help.faq1.a" },
  { q: "help.faq2.q", a: "help.faq2.a" },
  { q: "help.faq3.q", a: "help.faq3.a" },
  { q: "help.faq4.q", a: "help.faq4.a" },
  { q: "help.faq5.q", a: "help.faq5.a" },
  { q: "help.faq6.q", a: "help.faq6.a" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HelpPage() {
  const t = useT();

  return (
    <AppShell title={t("page.help.title")} subtitle={t("page.help.subtitle")}>
      <div className="max-w-5xl mx-auto p-6 space-y-8">

        {/* Intro banner */}
        <div className="bg-indigo-600 rounded-2xl p-6 flex gap-4 items-start text-white shadow-md">
          <BookOpen className="w-8 h-8 shrink-0 mt-0.5 opacity-90" />
          <div>
            <h2 className="font-bold text-lg leading-tight">{t("help.intro.heading")}</h2>
            <p className="text-indigo-200 text-sm mt-1 leading-relaxed">{t("help.intro.body")}</p>
          </div>
        </div>

        {/* 4-step cards */}
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-indigo-500" /> {t("help.section.steps")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.n} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className={`${s.color} px-5 py-4 flex items-center gap-3`}>
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <span className="text-white font-bold text-sm">{s.n}</span>
                    </div>
                    <Icon className="w-5 h-5 text-white shrink-0" />
                    <h3 className="text-white font-semibold text-sm leading-tight">{t(s.titleKey)}</h3>
                  </div>
                  <div className="p-5 flex-1 flex flex-col gap-3">
                    <p className="text-slate-500 text-xs leading-relaxed">{t(s.detailKey)}</p>
                    <div className="mt-auto pt-2">
                      <Link to={s.link} className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                        {t(s.linkLabelKey)} <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Flow diagram */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400" /> {t("help.section.flow")}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {[
              { label: "CSV", bg: "bg-slate-100 text-slate-700" },
              null,
              { label: t("nav.upload"), bg: "bg-indigo-100 text-indigo-700" },
              null,
              { label: "Run", bg: "bg-slate-100 text-slate-700" },
              null,
              { label: t("nav.studio"), bg: "bg-violet-100 text-violet-700" },
              null,
              { label: "Profile", bg: "bg-slate-100 text-slate-700" },
              null,
              { label: "Dry Run", bg: "bg-amber-100 text-amber-700" },
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
            <FileSpreadsheet className="w-4 h-4 text-indigo-500" /> {t("help.section.sources")}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {SOURCES.map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 shadow-sm">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                  <s.Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{s.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{t(s.descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-amber-900 flex items-center gap-2">
            <Info className="w-4 h-4" /> {t("help.section.tips")}
          </h2>
          <ul className="space-y-2.5">
            {TIP_KEYS.map((key) => (
              <li key={key} className="flex gap-2.5 items-start text-xs text-amber-800">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-indigo-500" /> {t("help.section.faq")}
          </h2>
          <div className="space-y-4">
            {FAQ_KEYS.map((f) => (
              <div key={f.q} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <div className="flex gap-2.5 mb-1.5">
                  <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-slate-800">{t(f.q)}</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed pl-6">{t(f.a)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-4">
          {[
            { to: "/upload",                  Icon: Upload,      labelKey: "nav.upload",    color: "text-indigo-600" },
            { to: "/mapping-studio/walmart",  Icon: Map,         labelKey: "nav.studio",    color: "text-violet-600" },
            { to: "/runs",                    Icon: PlayCircle,  labelKey: "nav.runs",      color: "text-amber-600" },
            { to: "/settings",               Icon: Settings,    labelKey: "nav.settings",  color: "text-slate-600" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col items-center gap-2 hover:border-indigo-300 hover:shadow-md transition-all group"
            >
              <item.Icon className={`w-6 h-6 ${item.color} group-hover:scale-110 transition-transform`} />
              <span className="text-xs font-semibold text-slate-700">{t(item.labelKey)}</span>
            </Link>
          ))}
        </div>

      </div>
    </AppShell>
  );
}
