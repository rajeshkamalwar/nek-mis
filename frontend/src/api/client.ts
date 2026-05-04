import axios from "axios";

/** Browser calls `/api` (Vite proxy → 8020). If the proxy fails, set `VITE_API_URL=http://127.0.0.1:8020` in `frontend/.env.local` and restart Vite. */
function apiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!raw) return "/api";
  return `${raw.replace(/\/+$/, "")}/api`;
}

export const api = axios.create({ baseURL: apiBaseUrl(), timeout: 30_000 });

export type MappingRuleDTO = {
  id: string;
  canonical_key: string;
  label: string;
  zoho_account_id: string;
  zoho_account_name: string;
  document_kind: string;
  formula_expr: string | null;
  tax_rate: string | null;
  sign_hint: string;
  condition_expr: Record<string, unknown> | null;
  sort_order: number;
};

export type ProfileDTO = {
  id: string;
  source_key: string;
  profile_name: string;
  description: string | null;
  is_default: boolean;
  rules: MappingRuleDTO[];
};

export async function fetchProfiles(sourceKey: string) {
  const { data } = await api.get<{ profiles: ProfileDTO[] }>("/mapping-profiles", {
    params: { source_key: sourceKey },
  });
  return data.profiles;
}

export async function fetchCoa() {
  const { data } = await api.get<{ accounts: { account_id: string; account_name: string; account_type: string }[] }>(
    "/zoho/chart-of-accounts",
  );
  return data.accounts;
}

export async function fetchCanonicalKeys(sourceKey: string) {
  const { data } = await api.get<{ canonical_keys: string[] }>(`/connectors/${sourceKey}/canonical-keys`);
  return data.canonical_keys;
}

export async function upsertRule(profileId: string, body: Partial<MappingRuleDTO> & { canonical_key: string; zoho_account_id: string; document_kind: string }) {
  const { data } = await api.post(`/mapping-profiles/${profileId}/rules`, body);
  return data as MappingRuleDTO;
}

export async function updateProfile(profileId: string, body: { profile_name?: string; description?: string; is_default?: boolean }) {
  const { data } = await api.put<ProfileDTO>(`/mapping-profiles/${profileId}`, body);
  return data;
}

export async function deleteProfile(profileId: string) {
  await api.delete(`/mapping-profiles/${profileId}`);
}

export async function updateRulePanel(profileId: string, rule: MappingRuleDTO) {
  return upsertRule(profileId, {
    canonical_key: rule.canonical_key,
    label: rule.label,
    zoho_account_id: rule.zoho_account_id,
    zoho_account_name: rule.zoho_account_name,
    document_kind: rule.document_kind,
    formula_expr: rule.formula_expr,
    tax_rate: rule.tax_rate,
    sign_hint: rule.sign_hint,
    condition_expr: rule.condition_expr,
    sort_order: rule.sort_order,
  });
}

export type DryRunPlanLineDTO = {
  canonical_key?: string;
  label?: string;
  account_id?: string;
  account_name?: string | null;
  amount?: number;
  signed_amount?: number;
  debit_or_credit?: string;
  kind?: string;
};

export type DryRunJournalBalancedLineDTO = {
  account_id: string;
  account_name?: string | null;
  label: string;
  amount: number;
  debit_or_credit: string;
  is_clearing_line?: boolean;
};

export type DryRunPlanDTO = {
  invoice_lines: DryRunPlanLineDTO[];
  journal_entries: DryRunPlanLineDTO[];
  journal_entries_balanced?: DryRunJournalBalancedLineDTO[];
  credit_note_lines: DryRunPlanLineDTO[];
  payment: { amount?: number; account_id?: string; account_name?: string | null } | null;
};

export type DryRunRowDTO = {
  row_id: string;
  order_id?: string | number | boolean | null;
  plan: DryRunPlanDTO;
};

export type DryRunResponseDTO = {
  run_id: string;
  source_key: string;
  rows: DryRunRowDTO[];
};

export async function dryRun(runId: string, maxRows = 50): Promise<DryRunResponseDTO> {
  const { data } = await api.post(`/runs/${runId}/dry-run`, { max_rows: maxRows });
  return data as DryRunResponseDTO;
}

export type PipelineRunDTO = {
  id: string;
  status: string;
  source_key: string;
  total_rows: number;
  processed_rows: number;
  profile_id: string | null;
  started_at: string | null;
};

export async function fetchRuns(limit = 20) {
  const { data } = await api.get<{ runs: PipelineRunDTO[] }>("/runs", { params: { limit } });
  return data.runs;
}

export async function fetchRun(runId: string) {
  const { data } = await api.get<PipelineRunDTO>(`/runs/${runId}`);
  return data;
}

export async function deleteRun(runId: string): Promise<{ ok: boolean; deleted_run_id: string }> {
  const { data } = await api.delete<{ ok: boolean; deleted_run_id: string }>(`/runs/${runId}`);
  return data;
}

export type UploadResultDTO = {
  run_id: string;
  source_key: string;
  total_rows: number;
  profile_id: string | null;
};

export async function uploadCsv(file: File, sourceKey: string) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("source_key", sourceKey);
  const { data } = await api.post<UploadResultDTO>("/upload", fd);
  return data;
}

export async function applyProfileToRun(runId: string, profileId: string) {
  await api.post(`/runs/${runId}/apply-profile`, { profile_id: profileId });
}

export async function publishRun(runId: string) {
  const { data } = await api.post<{ published: number }>(`/runs/${runId}/publish`);
  return data;
}

export async function publishRunAsync(runId: string) {
  const { data } = await api.post<{ queued: boolean; task_id: string; run_id: string }>(`/runs/${runId}/publish-async`);
  return data;
}

export type ZohoSettingsDTO = {
  organization_id: string;
  client_id: string;
  client_secret_configured: boolean;
  refresh_token_configured: boolean;
  clearing_account_id: string;
  default_contact_id: string;
  api_base: string;
  oauth_url: string;
};

export type ZohoTestResultDTO = {
  status: "connected" | "failed" | "not_configured";
  message?: string;
  org_id?: string;
};

export async function fetchZohoSettings(): Promise<ZohoSettingsDTO> {
  const { data } = await api.get<ZohoSettingsDTO>("/settings/zoho");
  return data;
}

export async function saveZohoSettings(
  body: Partial<{
    zoho_organization_id: string;
    zoho_client_id: string;
    zoho_client_secret: string;
    zoho_refresh_token: string;
    zoho_clearing_account_id: string;
    zoho_default_contact_id: string;
    zoho_api_base: string;
    zoho_oauth_url: string;
  }>,
): Promise<{ status: string; updated_keys: string[] }> {
  const { data } = await api.post<{ status: string; updated_keys: string[] }>("/settings/zoho", body);
  return data;
}

export async function testZohoConnection(): Promise<ZohoTestResultDTO> {
  const { data } = await api.post<ZohoTestResultDTO>("/settings/zoho/test");
  return data;
}
