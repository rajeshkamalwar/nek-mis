import { type ReactNode, useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useLang, useT } from "../i18n/LangContext";

const LAST_SOURCE_KEY = "last_source_key";

export function useLastSourceKey(): string {
  const { source_key } = useParams<{ source_key?: string }>();
  if (source_key) {
    try { localStorage.setItem(LAST_SOURCE_KEY, source_key); } catch {}
    return source_key;
  }
  try { return localStorage.getItem(LAST_SOURCE_KEY) || "walmart"; } catch {}
  return "walmart";
}

// ─── Live clock ───────────────────────────────────────────────────────────────

function LiveClock() {
  const { lang } = useLang();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const locale = lang === "hi" ? "hi-IN" : "en-GB";

  const datePart = now.toLocaleDateString(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const timePart = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <div className="hidden md:flex flex-col items-end leading-tight select-none">
      <span className="text-slate-300 text-[11px] font-medium">{datePart}</span>
      <span className="text-slate-400 text-[11px] tabular-nums font-mono">{timePart}</span>
    </div>
  );
}

// ─── Top navigation bar ───────────────────────────────────────────────────────

function TopBar() {
  const { pathname } = useLocation();
  const { source_key } = useParams<{ source_key?: string }>();
  const { lang, toggle } = useLang();
  const t = useT();

  let studioKey = source_key;
  if (!studioKey) {
    try { studioKey = localStorage.getItem(LAST_SOURCE_KEY) || "walmart"; } catch {}
  }

  const navItem = (to: string, label: string, match: (p: string) => boolean) => {
    const active = match(pathname);
    return (
      <Link
        to={to}
        className={`relative text-sm font-medium px-3 py-2 rounded-md transition-colors ${
          active
            ? "text-white bg-white/10"
            : "text-slate-300 hover:text-white hover:bg-white/8"
        }`}
      >
        {label}
        {active && (
          <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-indigo-400 rounded-full" />
        )}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-slate-900 shadow-md">
      <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Left: Brand + clock */}
        <div className="flex items-center gap-4 shrink-0">
          <Link to="/upload" className="flex items-center gap-3 group">
            {/* Logo mark */}
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 group-hover:bg-indigo-500 transition-colors shadow-inner shrink-0">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
                <rect x="10" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.5"/>
                <rect x="2" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.5"/>
                <rect x="10" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
                <line x1="8" y1="5" x2="10" y2="5" stroke="white" strokeWidth="1.5"/>
                <line x1="5" y1="8" x2="5" y2="10" stroke="white" strokeWidth="1.5"/>
                <line x1="13" y1="8" x2="13" y2="10" stroke="white" strokeWidth="1.5"/>
                <line x1="8" y1="13" x2="10" y2="13" stroke="white" strokeWidth="1.5"/>
              </svg>
            </div>
            <div>
              <span className="text-white font-bold text-sm tracking-tight leading-none block">NEK-MIS</span>
              <span className="text-slate-400 text-[10px] leading-none hidden sm:block">{t("nav.brand.tagline")}</span>
            </div>
          </Link>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-700 hidden md:block" />

          {/* Live clock */}
          <LiveClock />
        </div>

        {/* Right: Nav + lang toggle */}
        <div className="flex items-center gap-1">
          <nav className="flex items-center gap-0.5">
            {navItem("/upload", t("nav.upload"), (p) => p.startsWith("/upload") || p === "/")}
            {navItem(`/mapping-studio/${studioKey ?? "walmart"}`, t("nav.studio"), (p) => p.startsWith("/mapping-studio"))}
            {navItem("/runs", t("nav.runs"), (p) => p.startsWith("/runs"))}
            <div className="w-px h-5 bg-slate-700 mx-2" />
            {navItem("/settings", t("nav.settings"), (p) => p.startsWith("/settings"))}
            <Link
              to="/help"
              title="How to use"
              className={`relative flex items-center px-2 py-2 rounded-md transition-colors ${
                pathname.startsWith("/help")
                  ? "text-white bg-white/10"
                  : "text-slate-300 hover:text-white hover:bg-white/8"
              }`}
            >
              <HelpCircle className="w-4 h-4" />
            </Link>
          </nav>

          {/* Language toggle */}
          <div className="w-px h-5 bg-slate-700 mx-2" />
          <button
            type="button"
            onClick={toggle}
            title={lang === "en" ? "Switch to Hindi" : "अंग्रेज़ी पर स्विच करें"}
            className="text-[11px] font-bold px-2.5 py-1 rounded-md border border-slate-600 text-slate-300 hover:text-white hover:border-indigo-400 hover:bg-indigo-600/20 transition-colors tabular-nums tracking-wide"
          >
            {t("nav.lang.switch")}
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Page title strip ─────────────────────────────────────────────────────────

function PageStrip({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3">
      <div className="max-w-screen-2xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold text-slate-900 leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  fullHeight?: boolean;
}

export function AppShell({ title, subtitle, actions, children, fullHeight }: AppShellProps) {
  return (
    <div className={`${fullHeight ? "h-screen" : "min-h-screen"} bg-slate-100 flex flex-col`}>
      <TopBar />
      <PageStrip title={title} subtitle={subtitle} actions={actions} />
      <div className={`${fullHeight ? "flex-1 overflow-hidden min-h-0" : ""}`}>
        {children}
      </div>
    </div>
  );
}
