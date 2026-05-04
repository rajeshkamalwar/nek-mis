import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { T, type Lang } from "./translations";

const STORAGE_KEY = "app_lang";

function readLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "en" || v === "hi") return v;
  } catch { /* ignore */ }
  return "en";
}

interface LangCtx {
  lang: Lang;
  toggle: () => void;
}

const LangContext = createContext<LangCtx>({ lang: "en", toggle: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readLang);

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next: Lang = prev === "en" ? "hi" : "en";
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return <LangContext.Provider value={{ lang, toggle }}>{children}</LangContext.Provider>;
}

export function useLang(): LangCtx {
  return useContext(LangContext);
}

/** Returns a translation function t(key) → string */
export function useT(): (key: string) => string {
  const { lang } = useLang();
  return useCallback(
    (key: string) => T[lang][key] ?? T["en"][key] ?? key,
    [lang],
  );
}
