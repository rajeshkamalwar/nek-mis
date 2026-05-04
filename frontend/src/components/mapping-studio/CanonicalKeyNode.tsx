import { type NodeProps, Handle, Position } from "@xyflow/react";

export type KeyNodeData = {
  canonical_key: string;
  label: string;
  is_mapped: boolean;
};

export function CanonicalKeyNode({ data }: NodeProps) {
  const d = data as KeyNodeData;
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm shadow bg-white min-w-[140px] ${
        d.is_mapped ? "border-emerald-400" : "border-slate-300 border-dashed"
      }`}
    >
      <Handle type="source" position={Position.Right} className="!bg-slate-600" />
      <div className="font-mono text-xs text-slate-600">{d.canonical_key}</div>
      <div className="text-slate-800 font-medium truncate max-w-[180px]">{d.label}</div>
      {!d.is_mapped ? <div className="text-[10px] text-slate-400 mt-1">unmapped</div> : null}
    </div>
  );
}
