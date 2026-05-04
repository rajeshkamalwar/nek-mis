import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { DOCUMENT_KINDS } from "../../types/mapping";
import {
  ReactFlow,
  Background,
  Controls,
  type Connection,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { CanonicalKeyNode } from "./CanonicalKeyNode";
import { ZohoAccountNode } from "./ZohoAccountNode";
import { MappingEdge } from "./MappingEdge";
import type { ProfileDTO, MappingRuleDTO } from "../../api/client";
import { upsertRule } from "../../api/client";

const nodeTypes = { canonicalKey: CanonicalKeyNode, zohoAccount: ZohoAccountNode };
const edgeTypes = { mapping: MappingEdge };

function slugifyAccountId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

const KEY_X = 40;
const ACCT_X = 560;
const ROW_H = 80;

function buildGraph(
  keys: string[],
  accounts: { account_id: string; account_name: string; account_type: string }[],
  rules: MappingRuleDTO[],
  pinnedAccountIds: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  const ruleByKey = new Map(rules.map((r) => [r.canonical_key, r]));
  const accountById = new Map(accounts.map((a) => [a.account_id, a]));

  // Key nodes — evenly spaced on the left
  const keyNodes: Node[] = keys.map((k, i) => {
    const rule = ruleByKey.get(k);
    return {
      id: `k:${k}`,
      type: "canonicalKey",
      position: { x: KEY_X, y: 40 + i * ROW_H },
      data: { canonical_key: k, label: rule?.label || k, is_mapped: !!rule },
    };
  });

  // Key Y index map for layout calculations
  const keyY = new Map(keys.map((k, i) => [k, 40 + i * ROW_H]));

  // Visible accounts = only mapped accounts + pinned accounts
  const visibleAccountIds = new Set<string>([
    ...rules.map((r) => r.zoho_account_id),
    ...pinnedAccountIds,
  ]);

  const visibleAccounts: { account_id: string; account_name: string; account_type: string }[] = [];
  const seen = new Set<string>();

  for (const id of visibleAccountIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const fromCoa = accountById.get(id);
    const fromRule = rules.find((r) => r.zoho_account_id === id);
    visibleAccounts.push(
      fromCoa ?? {
        account_id: id,
        account_name: fromRule?.zoho_account_name || id,
        account_type: "—",
      },
    );
  }

  // For each account, compute ideal Y = average Y of all keys that map to it
  const acctYSum = new Map<string, number>();
  const acctYCount = new Map<string, number>();
  for (const r of rules) {
    const ky = keyY.get(r.canonical_key);
    if (ky === undefined) continue;
    acctYSum.set(r.zoho_account_id, (acctYSum.get(r.zoho_account_id) ?? 0) + ky);
    acctYCount.set(r.zoho_account_id, (acctYCount.get(r.zoho_account_id) ?? 0) + 1);
  }

  // Sort accounts by their ideal Y (mapped ones first, pinned-only after)
  visibleAccounts.sort((a, b) => {
    const ay = acctYCount.has(a.account_id)
      ? (acctYSum.get(a.account_id) ?? 0) / (acctYCount.get(a.account_id) ?? 1)
      : Infinity;
    const by = acctYCount.has(b.account_id)
      ? (acctYSum.get(b.account_id) ?? 0) / (acctYCount.get(b.account_id) ?? 1)
      : Infinity;
    return ay - by;
  });

  // Assign Y positions with minimum gap to avoid node overlaps
  const MIN_GAP = 80;
  let lastY = -Infinity;
  const zohoNodes: Node[] = visibleAccounts.map((a) => {
    const idealY = acctYCount.has(a.account_id)
      ? (acctYSum.get(a.account_id) ?? 0) / (acctYCount.get(a.account_id) ?? 1)
      : lastY + MIN_GAP;
    const y = Math.max(idealY, lastY + MIN_GAP);
    lastY = y;
    return {
      id: `a:${slugifyAccountId(a.account_id)}`,
      type: "zohoAccount",
      position: { x: ACCT_X, y },
      data: { account_id: a.account_id, account_name: a.account_name, account_type: a.account_type },
    };
  });

  const edges: Edge[] = rules.map((r) => ({
    id: `e:${r.canonical_key}:${slugifyAccountId(r.zoho_account_id)}`,
    source: `k:${r.canonical_key}`,
    target: `a:${slugifyAccountId(r.zoho_account_id)}`,
    type: "mapping",
    data: {
      rule_id: r.id,
      document_kind: r.document_kind,
      formula_expr: r.formula_expr,
      sign_hint: r.sign_hint,
    },
  }));

  return { nodes: [...keyNodes, ...zohoNodes], edges };
}

function CanvasInner({
  profile,
  keys,
  accounts,
  onRuleSelect,
  onGraphRefresh,
}: {
  profile: ProfileDTO | null;
  keys: string[];
  accounts: { account_id: string; account_name: string; account_type: string }[];
  onRuleSelect: (rule: MappingRuleDTO | null) => void;
  onGraphRefresh: () => void;
}) {
  const rules = profile?.rules ?? [];
  const [accountSearch, setAccountSearch] = useState("");
  const [pinnedAccountIds, setPinnedAccountIds] = useState<Set<string>>(() => new Set());
  const [saveMsg, setSaveMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  type PendingConnection = {
    key: string;
    accountId: string;
    accountName: string | undefined;
    sortOrder: number;
  };
  const [pendingConn, setPendingConn] = useState<PendingConnection | null>(null);
  const [pickKind, setPickKind] = useState("invoice_line");

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(keys, accounts, rules, pinnedAccountIds),
    [keys, accounts, rules, pinnedAccountIds],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const { nodes: n, edges: e } = buildGraph(keys, accounts, rules, pinnedAccountIds);
    setNodes(n);
    setEdges(e);
  }, [keys, accounts, rules, pinnedAccountIds, setNodes, setEdges]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!profile || !c.source || !c.target) return;
      const key = c.source.startsWith("k:") ? c.source.slice(2) : "";
      const acctPart = c.target.startsWith("a:") ? c.target.slice(2) : "";
      const account = accounts.find((a) => slugifyAccountId(a.account_id) === acctPart);
      const ruleMatch = rules.find((r) => slugifyAccountId(r.zoho_account_id) === acctPart);
      const accountId = account?.account_id ?? ruleMatch?.zoho_account_id;
      if (!key || !accountId) return;
      const targetNode = nodes.find((n) => n.id === c.target);
      const nd = targetNode?.data as { account_name?: string } | undefined;
      const accountName = account?.account_name ?? nd?.account_name ?? ruleMatch?.zoho_account_name;
      setPickKind("invoice_line");
      setPendingConn({ key, accountId, accountName, sortOrder: rules.length });
    },
    [profile, accounts, rules, nodes],
  );

  const saveWithKind = useCallback(
    async (kind: string) => {
      if (!profile || !pendingConn) return;
      setPendingConn(null);
      try {
        await upsertRule(profile.id, {
          canonical_key: pendingConn.key,
          label: pendingConn.key,
          zoho_account_id: pendingConn.accountId,
          zoho_account_name: pendingConn.accountName,
          document_kind: kind,
          sign_hint: "auto",
          sort_order: pendingConn.sortOrder,
        });
        setErrMsg("");
        setSaveMsg("Rule saved");
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setSaveMsg(""), 2000);
        onGraphRefresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save rule";
        setErrMsg(msg);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setErrMsg(""), 4000);
      }
    },
    [profile, pendingConn, onGraphRefresh],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const rk = edge.source.startsWith("k:") ? edge.source.slice(2) : "";
      const rule = rules.find((r) => r.canonical_key === rk);
      onRuleSelect(rule ?? null);
    },
    [rules, onRuleSelect],
  );

  const mappedAccountIds = useMemo(() => new Set(rules.map((r) => r.zoho_account_id)), [rules]);

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    return accounts.filter((a) => !q || a.account_name.toLowerCase().includes(q) || a.account_type.toLowerCase().includes(q));
  }, [accounts, accountSearch]);

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, typeof filteredAccounts> = {};
    for (const a of filteredAccounts) {
      const t = a.account_type || "Other";
      if (!groups[t]) groups[t] = [];
      groups[t].push(a);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredAccounts]);

  const [panelOpen, setPanelOpen] = useState(true);
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(() => new Set());

  function toggleType(t: string) {
    setCollapsedTypes((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  }

  return (
    <div className="relative flex-1 min-h-[500px] h-[calc(100vh-180px)] w-full min-w-0 flex border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">

      {/* Accounts side panel */}
      <div className={`flex flex-col border-r border-slate-200 bg-white transition-all duration-200 ${panelOpen ? "w-56 min-w-[14rem]" : "w-8 min-w-[2rem]"}`}>
        <button
          type="button"
          className="flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase text-slate-500 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 shrink-0"
          onClick={() => setPanelOpen((v) => !v)}
          title={panelOpen ? "Collapse accounts" : "Expand accounts"}
        >
          {panelOpen ? (
            <>
              <span>Accounts</span>
              <span className="text-slate-400">◀</span>
            </>
          ) : (
            <span className="rotate-90 inline-block text-slate-400 mx-auto">▶</span>
          )}
        </button>

        {panelOpen && (
          <>
            <div className="px-2 py-1.5 border-b border-slate-100 shrink-0">
              <input
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                placeholder="Search accounts…"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto flex-1 text-xs">
              {groupedAccounts.map(([type, accts]) => (
                <div key={type}>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-2 py-1 bg-slate-50 hover:bg-slate-100 text-[10px] font-semibold uppercase text-slate-500 border-b border-slate-100"
                    onClick={() => toggleType(type)}
                  >
                    <span className="truncate">{type}</span>
                    {collapsedTypes.has(type) ? <ChevronRight className="w-3 h-3 text-slate-400 ml-1 shrink-0" /> : <ChevronDown className="w-3 h-3 text-slate-400 ml-1 shrink-0" />}
                  </button>
                  {!collapsedTypes.has(type) && accts.map((a) => {
                    const isMapped = mappedAccountIds.has(a.account_id);
                    const isPinned = pinnedAccountIds.has(a.account_id);
                    return (
                      <div
                        key={a.account_id}
                        className={`flex items-center justify-between gap-1 px-2 py-1 border-b border-slate-50 ${isMapped ? "bg-emerald-50" : ""}`}
                      >
                        <span className={`truncate flex-1 leading-snug ${isMapped ? "text-emerald-800 font-medium" : "text-slate-700"}`} title={a.account_name}>
                          {isMapped && <Check className="inline w-3 h-3 mr-1 text-emerald-500 shrink-0" />}
                          {a.account_name}
                        </span>
                        {!isMapped && (
                          isPinned ? (
                            <button
                              type="button"
                              title="Remove from canvas"
                              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] border border-slate-300 text-slate-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                              onClick={() => setPinnedAccountIds((prev) => {
                                const next = new Set(prev);
                                next.delete(a.account_id);
                                return next;
                              })}
                            >
                              × off
                            </button>
                          ) : (
                            <button
                              type="button"
                              title="Add to canvas"
                              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] border border-blue-300 text-blue-600 hover:bg-blue-50"
                              onClick={() => setPinnedAccountIds((prev) => new Set([...prev, a.account_id]))}
                            >
                              + canvas
                            </button>
                          )
                        )}
                        {isMapped && (
                          <span
                            title="Remove the mapping rule to take this off the canvas"
                            className="shrink-0 text-[9px] text-slate-400 cursor-help"
                          >
                            mapped
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {filteredAccounts.length === 0 && (
                <p className="p-3 text-slate-400 text-center">No accounts match</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Canvas area */}
      <div className="relative flex-1 min-w-0 overflow-hidden">

      {pendingConn ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20">
          <div className="w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <p className="text-xs font-bold uppercase text-slate-500 mb-1">New rule</p>
            <p className="text-sm text-slate-800 mb-3">
              <span className="font-mono font-semibold">{pendingConn.key}</span>
              {" → "}
              <span className="font-medium">{pendingConn.accountName ?? pendingConn.accountId}</span>
            </p>
            <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
              Document kind
            </label>
            <select
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm mb-4"
              value={pickKind}
              onChange={(e) => setPickKind(e.target.value)}
            >
              {DOCUMENT_KINDS.filter((d) => d.value !== "skip").map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                onClick={() => setPendingConn(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
                onClick={() => saveWithKind(pickKind)}
              >
                Save rule
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {saveMsg ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-emerald-700 px-4 py-2 text-xs text-white shadow-lg">
          {saveMsg}
        </div>
      ) : null}
      {errMsg ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 max-w-sm rounded-full bg-red-700 px-4 py-2 text-xs text-white shadow-lg text-center">
          {errMsg}
        </div>
      ) : null}

      <ReactFlow
        className="h-full w-full"
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background />
        <Controls />
      </ReactFlow>
      </div>{/* end canvas area */}
    </div>
  );
}

export function MappingCanvas({
  sourceKey: _sourceKey,
  ...rest
}: {
  sourceKey: string;
  profile: ProfileDTO | null;
  keys: string[];
  accounts: { account_id: string; account_name: string; account_type: string }[];
  onRuleSelect: (rule: MappingRuleDTO | null) => void;
  onGraphRefresh: () => void;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...rest} />
    </ReactFlowProvider>
  );
}
