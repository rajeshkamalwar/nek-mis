import { type NodeProps, Handle, Position } from "@xyflow/react";

export type ZohoNodeData = {
  account_id: string;
  account_name: string;
  account_type: string;
};

export function ZohoAccountNode({ data }: NodeProps) {
  const d = data as ZohoNodeData;
  return (
    <div className="rounded-lg border border-blue-300 bg-blue-50/80 px-3 py-2 text-sm shadow min-w-[160px]">
      <Handle type="target" position={Position.Left} className="!bg-blue-600" />
      <div className="text-xs text-blue-700 font-mono truncate">{d.account_id}</div>
      <div className="font-medium text-slate-900 truncate max-w-[200px]">{d.account_name}</div>
      <div className="text-[10px] text-slate-500">{d.account_type}</div>
    </div>
  );
}
