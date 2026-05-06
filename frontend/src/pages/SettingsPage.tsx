import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  fetchCoa,
  fetchZohoSettings,
  type ZohoSettingsDTO,
  type ZohoTestResultDTO,
  saveZohoSettings,
  testZohoConnection,
} from "../api/client";
import { AppShell, useLastSourceKey } from "../components/AppShell";
import { useT } from "../i18n/LangContext";

const TEST_CACHE_KEY = "zoho_books_settings_test_v1";
const DEFAULT_API_BASE = "https://www.zohoapis.com/books/v3";
const DEFAULT_OAUTH_URL = "https://accounts.zoho.com/oauth/v2/token";

function cacheFingerprint(r: ZohoSettingsDTO): string {
  return [r.organization_id, r.client_id, r.client_secret_configured, r.refresh_token_configured].join("|");
}

function loadCachedTest(fp: string): ZohoTestResultDTO | null {
  try {
    const raw = sessionStorage.getItem(TEST_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as { fingerprint: string; result: ZohoTestResultDTO };
    if (c.fingerprint !== fp) return null;
    return c.result;
  } catch {
    return null;
  }
}

function storeCachedTest(fp: string, result: ZohoTestResultDTO) {
  sessionStorage.setItem(TEST_CACHE_KEY, JSON.stringify({ fingerprint: fp, result }));
}

function clearTestCache() {
  sessionStorage.removeItem(TEST_CACHE_KEY);
}

export function SettingsPage() {
  const t = useT();
  const qc = useQueryClient();
  const studioSourceKey = useLastSourceKey();
  const [orgId, setOrgId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [clearingId, setClearingId] = useState("");
  const [defaultContactId, setDefaultContactId] = useState("");
  const [apiBase, setApiBase] = useState("");
  const [oauthUrl, setOauthUrl] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [testResult, setTestResult] = useState<ZohoTestResultDTO | null>(null);
  const [savedHint, setSavedHint] = useState("");
  const [coaMessage, setCoaMessage] = useState("");
  const [coaLoading, setCoaLoading] = useState(false);

  const { data: remote, isLoading } = useQuery({
    queryKey: ["zohoSettings"],
    queryFn: fetchZohoSettings,
  });

  useEffect(() => {
    if (!remote) return;
    setOrgId(remote.organization_id);
    setClientId(remote.client_id);
    setClearingId(remote.clearing_account_id);
    setDefaultContactId(remote.default_contact_id);
    setApiBase(remote.api_base || DEFAULT_API_BASE);
    setOauthUrl(remote.oauth_url || DEFAULT_OAUTH_URL);
    setClientSecret("");
    setRefreshToken("");
    const cached = loadCachedTest(cacheFingerprint(remote));
    setTestResult(cached);
  }, [remote]);

  const badge = useMemo(() => {
    if (!remote) return { label: t("settings.badge.loading"), className: "bg-slate-100 text-slate-600" };
    if (!remote.client_secret_configured || !remote.refresh_token_configured) {
      return { label: t("settings.badge.notconfigured"), className: "bg-slate-100 text-slate-600" };
    }
    if (testResult?.status === "connected") {
      return { label: t("settings.badge.connected"), className: "bg-emerald-100 text-emerald-800" };
    }
    if (testResult?.status === "failed") {
      return { label: `Failed: ${testResult.message ?? "Unknown error"}`, className: "bg-red-100 text-red-800" };
    }
    if (testResult?.status === "not_configured") {
      return { label: testResult.message ?? t("settings.badge.notconfigured"), className: "bg-slate-100 text-slate-600" };
    }
    return { label: t("settings.badge.clicktest"), className: "bg-slate-100 text-slate-600" };
  }, [remote, testResult]);

  const [saveErr, setSaveErr] = useState("");

  const saveMut = useMutation({
    mutationFn: () =>
      saveZohoSettings({
        zoho_organization_id: orgId,
        zoho_client_id: clientId,
        zoho_client_secret: clientSecret.trim() || undefined,
        zoho_refresh_token: refreshToken.trim() || undefined,
        zoho_clearing_account_id: clearingId,
        zoho_default_contact_id: defaultContactId,
        zoho_api_base: apiBase.trim() || undefined,
        zoho_oauth_url: oauthUrl.trim() || undefined,
      }),
    onSuccess: async () => {
      clearTestCache();
      setTestResult(null);
      setSaveErr("");
      setSavedHint(t("settings.saved"));
      window.setTimeout(() => setSavedHint(""), 3000);
      await qc.invalidateQueries({ queryKey: ["zohoSettings"] });
      await qc.invalidateQueries({ queryKey: ["coa"] });
    },
    onError: (e: unknown) => {
      setSaveErr(e instanceof Error ? e.message : "Save failed — check your network connection and try again.");
    },
  });

  const [testing, setTesting] = useState(false);
  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testZohoConnection();
      setTestResult(result);
      const fresh = await qc.fetchQuery({ queryKey: ["zohoSettings"], queryFn: fetchZohoSettings });
      storeCachedTest(cacheFingerprint(fresh), result);
    } catch (e) {
      setTestResult({ status: "failed", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setTesting(false);
    }
  }

  async function handleReloadCoa() {
    setCoaLoading(true);
    setCoaMessage("");
    try {
      const accounts = await fetchCoa();
      qc.setQueryData(["coa"], accounts);
      const isDemo = accounts.length > 0 && accounts[0]?.account_id === "demo_sales";
      if (isDemo) {
        setCoaMessage("Demo accounts (no token configured)");
      } else {
        setCoaMessage(`${accounts.length} accounts loaded`);  // numeric — no translation needed
      }
    } catch (e) {
      setCoaMessage(String(e));
    } finally {
      setCoaLoading(false);
    }
  }

  const orgBanner =
    orgId.trim().length > 0 ? (
      /test|sandbox|dev|staging/i.test(orgId) ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("settings.banner.sandbox").replace("{id}", orgId)}
        </div>
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {t("settings.banner.prod").replace("{id}", orgId)}
        </div>
      )
    ) : null;

  return (
    <AppShell title={t("page.settings.title")} subtitle={t("page.settings.subtitle")}>
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {isLoading ? <p className="text-sm text-slate-600">{t("settings.loading")}</p> : null}

        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">{t("settings.section.zoho")}</h2>
            <span className={`text-xs font-medium px-3 py-1 rounded-full max-w-[min(100%,280px)] truncate ${badge.className}`}>
              {badge.label}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="md:col-span-2 block text-sm font-medium text-slate-700">
              {t("settings.label.orgid")}
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="md:col-span-2 block text-sm font-medium text-slate-700">
              {t("settings.label.clientid")}
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t("settings.label.clientsecret")}
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={remote?.client_secret_configured ? t("settings.placeholder.keep") : ""}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t("settings.label.clearingid")}
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={clearingId}
                onChange={(e) => setClearingId(e.target.value)}
                autoComplete="off"
              />
              <span className="mt-1 block text-xs text-slate-500">{t("settings.hint.clearing")}</span>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t("settings.label.refreshtoken")}
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                placeholder={remote?.refresh_token_configured ? t("settings.placeholder.keep") : ""}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t("settings.label.contactid")}
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={defaultContactId}
                onChange={(e) => setDefaultContactId(e.target.value)}
                autoComplete="off"
              />
              <span className="mt-1 block text-xs text-slate-500">{t("settings.hint.contact")}</span>
            </label>
          </div>

          <div>
            <button
              type="button"
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              {advancedOpen ? t("settings.advanced.open") : t("settings.advanced.closed")}
            </button>
            {advancedOpen ? (
              <div className="mt-3 grid grid-cols-1 gap-4">
                <label className="block text-sm font-medium text-slate-700">
                  {t("settings.label.apibase")}
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={apiBase}
                    onChange={(e) => setApiBase(e.target.value)}
                    placeholder={DEFAULT_API_BASE}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  {t("settings.label.oauthurl")}
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={oauthUrl}
                    onChange={(e) => setOauthUrl(e.target.value)}
                    placeholder={DEFAULT_OAUTH_URL}
                  />
                </label>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="bg-slate-800 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              disabled={saveMut.isPending}
              onClick={() => {
                setSaveErr("");
                if (!orgId.trim() || !clientId.trim()) {
                  setSaveErr("Organisation ID and Client ID are required before saving.");
                  return;
                }
                saveMut.mutate();
              }}
            >
              {saveMut.isPending ? t("settings.btn.saving") : t("settings.btn.save")}
            </button>
            <button
              type="button"
              className="border border-slate-200 bg-white text-slate-700 rounded-lg px-4 py-2 text-sm disabled:opacity-50"
              disabled={testing}
              onClick={handleTest}
            >
              {testing ? t("settings.btn.testing") : t("settings.btn.test")}
            </button>
            {savedHint ? <span className="text-sm text-emerald-700">{savedHint}</span> : null}
          </div>
          {saveErr ? <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{saveErr}</p> : null}
          <p className="text-xs text-slate-500">{t("settings.test.hint")}</p>

          {testResult && (testResult.message || testResult.status === "connected") ? (
            <p
              className={`text-sm rounded-lg px-3 py-2 ${
                testResult.status === "connected"
                  ? "bg-emerald-50 text-emerald-900"
                  : testResult.status === "failed"
                    ? "bg-red-50 text-red-900"
                    : "bg-slate-50 text-slate-800"
              }`}
            >
              {testResult.message ?? testResult.status}
            </p>
          ) : null}

          {orgBanner ? <div className="pt-2">{orgBanner}</div> : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <button
            type="button"
            className="text-sm font-semibold text-slate-900"
            onClick={() => setGuideOpen((v) => !v)}
          >
            {guideOpen ? t("settings.guide.open") : t("settings.guide.closed")}
          </button>
          {guideOpen ? (
            <ol className="list-decimal list-inside text-sm text-slate-700 space-y-2">
              <li>
                Go to{" "}
                <a
                  className="text-blue-700 underline"
                  href="https://api-console.zoho.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Zoho API Console
                </a>{" "}
                → Create Server-based Application → Copy Client ID and Client Secret.
              </li>
              <li>
                Go to{" "}
                <a
                  className="text-blue-700 underline"
                  href="https://accounts.zoho.com/developerconsole"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OAuth Playground
                </a>{" "}
                → Try OAuth → Scope: ZohoBooks.fullaccess.all → Copy the Refresh Token.
              </li>
              <li>
                In{" "}
                <a className="text-blue-700 underline" href="https://books.zoho.com" target="_blank" rel="noopener noreferrer">
                  Zoho Books
                </a>
                , open Settings → Organisation Profile → copy Organisation ID.
              </li>
              <li>Enter values above → Save → Test connection.</li>
            </ol>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">{t("settings.section.coa")}</h2>
          <p className="text-xs text-slate-500">{t("settings.coa.hint")}</p>
          <button
            type="button"
            className="border border-slate-200 bg-white text-slate-700 rounded-lg px-4 py-2 text-sm disabled:opacity-50"
            disabled={coaLoading}
            onClick={handleReloadCoa}
          >
            {coaLoading ? t("settings.coa.btn.loading") : t("settings.coa.btn.reload")}
          </button>
          {coaMessage ? <p className="text-sm text-slate-800">{coaMessage}</p> : null}
        </section>

        <p className="text-xs text-slate-500">
          <Link className="text-blue-700 underline" to={`/mapping-studio/${studioSourceKey}`}>
            {t("settings.link.backstudio")}
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
