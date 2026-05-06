import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import type { MappingRuleDTO } from "../../api/client";
import { updateRulePanel, deleteRule } from "../../api/client";
import { DOCUMENT_KINDS, SIGN_HINTS } from "../../types/mapping";

const CONDITION_OPS = [
  { value: "=", label: "=" },
  { value: "!=", label: "!=" },
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
  { value: "contains", label: "contains" },
] as const;

function conditionChip(field: string, op: string, value: string): string | null {
  if (!field.trim()) return null;
  const v = value ?? "";
  return `${field.trim()} ${op} ${op === "contains" && v ? `"${v}"` : v || "…"}`;
}

export function RuleEditPanel({
  profileId,
  rule,
  accounts,
  canonicalKeys,
  onSaved,
}: {
  profileId: string | null;
  rule: MappingRuleDTO | null;
  accounts: { account_id: string; account_name: string; account_type: string }[];
  canonicalKeys: string[];
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<MappingRuleDTO | null>(null);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [condField, setCondField] = useState("");
  const [condOp, setCondOp] = useState<string>("=");
  const [condValue, setCondValue] = useState("");

  useEffect(() => {
    setDraft(rule);
    setErr(null);
    const ex = rule?.condition_expr;
    if (ex && typeof ex === "object" && !Array.isArray(ex)) {
      const o = ex as Record<string, unknown>;
      setCondField(typeof o.field === "string" ? o.field : "");
      setCondOp(typeof o.op === "string" ? o.op : "=");
      setCondValue(o.value != null ? String(o.value) : "");
    } else {
      setCondField("");
      setCondOp("=");
      setCondValue("");
    }
  }, [rule]);

  const keyOptions = useMemo(() => {
    const s = new Set(canonicalKeys);
    if (condField) s.add(condField);
    return Array.from(s).sort();
  }, [canonicalKeys, condField]);

  if (!profileId || !draft) {
    return (
      <aside className="w-80 shrink-0 border-l border-slate-200 bg-white p-4 text-sm text-slate-500">
        Select a mapping edge to edit the rule, or connect a key to an account.
      </aside>
    );
  }

  const filtered = accounts.filter(
    (a) =>
      !q.trim() ||
      a.account_name.toLowerCase().includes(q.toLowerCase()) ||
      a.account_id.toLowerCase().includes(q.toLowerCase()),
  );

  const chip = conditionChip(condField, condOp, condValue);

  return (
    <aside className="w-80 shrink-0 border-l border-slate-200 bg-white p-4 overflow-y-auto max-h-[min(72vh,720px)]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase text-slate-500">Rule</h3>
        <button
          type="button"
          title="Delete this rule"
          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
          disabled={deleting || saving}
          onClick={async () => {
            if (!profileId || !draft) return;
            if (!confirm(`Delete rule "${draft.canonical_key}"? This cannot be undone.`)) return;
            setDeleting(true);
            setErr(null);
            try {
              await deleteRule(profileId, draft.canonical_key);
              onSaved();
            } catch (ex: unknown) {
              setErr(ex instanceof Error ? ex.message : "Delete failed");
            } finally {
              setDeleting(false);
            }
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
      <p className="font-mono text-sm font-semibold text-slate-900">{draft.canonical_key}</p>

      <label className="mt-3 block text-[10px] font-semibold uppercase text-slate-500">Label</label>
      <input
        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
        value={draft.label}
        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
      />

      <label className="mt-3 block text-[10px] font-semibold uppercase text-slate-500">Document kind</label>
      <select
        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
        value={draft.document_kind}
        onChange={(e) => setDraft({ ...draft, document_kind: e.target.value })}
      >
        {DOCUMENT_KINDS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <label className="mt-3 block text-[10px] font-semibold uppercase text-slate-500">Zoho account</label>
      <input
        className="mt-1 w-full rounded border px-2 py-1 text-xs"
        placeholder="Search…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select
        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
        value={draft.zoho_account_id}
        onChange={(e) => {
          const a = accounts.find((x) => x.account_id === e.target.value);
          setDraft({
            ...draft,
            zoho_account_id: e.target.value,
            zoho_account_name: a?.account_name ?? draft.zoho_account_name,
          });
        }}
      >
        {filtered.slice(0, 200).map((a) => (
          <option key={a.account_id} value={a.account_id}>
            {a.account_name} ({a.account_id})
          </option>
        ))}
      </select>

      <label className="mt-3 block text-[10px] font-semibold uppercase text-slate-500">Sign hint</label>
      <select
        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
        value={draft.sign_hint}
        onChange={(e) => setDraft({ ...draft, sign_hint: e.target.value })}
      >
        {SIGN_HINTS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <label className="mt-3 block text-[10px] font-semibold uppercase text-slate-500">Formula (simpleeval)</label>
      <input
        className="mt-1 w-full rounded border px-2 py-1.5 font-mono text-xs"
        placeholder="abs(value)"
        value={draft.formula_expr ?? ""}
        onChange={(e) => setDraft({ ...draft, formula_expr: e.target.value || null })}
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-semibold uppercase text-slate-500">Tax rate (BTW %)</label>
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            placeholder="0"
            value={draft.tax_rate ?? ""}
            onChange={(e) => setDraft({ ...draft, tax_rate: e.target.value || null })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase text-slate-500">Sort order</label>
          <input
            type="number"
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={draft.sort_order}
            onChange={(e) => setDraft({ ...draft, sort_order: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
      </div>

      <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2 space-y-2">
        <p className="text-[10px] font-semibold uppercase text-slate-500">Condition (optional)</p>
        {chip ? (
          <p className="text-xs font-mono text-slate-700 bg-white rounded px-2 py-1 border border-slate-100">{chip}</p>
        ) : (
          <p className="text-xs text-slate-500">No condition — rule always applies when formula yields a value.</p>
        )}
        <label className="block text-[10px] font-semibold uppercase text-slate-500">Field (canonical key)</label>
        <select
          className="w-full rounded border px-2 py-1.5 text-sm bg-white"
          value={condField}
          onChange={(e) => setCondField(e.target.value)}
        >
          <option value="">— No condition —</option>
          {keyOptions.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-semibold uppercase text-slate-500">Operator</label>
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm bg-white"
              value={condOp}
              onChange={(e) => setCondOp(e.target.value)}
              disabled={!condField.trim()}
            >
              {CONDITION_OPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase text-slate-500">Value</label>
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm bg-white"
              value={condValue}
              onChange={(e) => setCondValue(e.target.value)}
              disabled={!condField.trim()}
              placeholder="0"
            />
          </div>
        </div>
        <button
          type="button"
          className="text-xs text-slate-600 underline"
          onClick={() => {
            setCondField("");
            setCondOp("=");
            setCondValue("");
          }}
        >
          Clear condition
        </button>
      </div>

      {err ? <p className="text-red-600 text-xs mt-2">{err}</p> : null}

      <button
        type="button"
        className="mt-4 w-full rounded bg-blue-600 text-white py-2 text-sm font-medium disabled:opacity-50"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          setErr(null);
          try {
            const toSave: MappingRuleDTO = {
              ...draft,
              condition_expr:
                condField.trim() && condOp
                  ? { field: condField.trim(), op: condOp, value: condValue }
                  : null,
            };
            await updateRulePanel(profileId, toSave);
            onSaved();
          } catch (ex: unknown) {
            setErr(ex instanceof Error ? ex.message : "Save failed");
          } finally {
            setSaving(false);
          }
        }}
      >
        Save rule
      </button>
    </aside>
  );
}
