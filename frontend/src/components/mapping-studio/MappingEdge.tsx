import { type EdgeProps, BaseEdge, getBezierPath, EdgeLabelRenderer } from "@xyflow/react";

export type MappingEdgeData = {
  rule_id: string;
  document_kind: string;
  formula_expr: string | null;
  sign_hint: string;
};

export function MappingEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const d = (data || {}) as MappingEdgeData;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isSkip = d.document_kind === "skip";
  const hasFormula = !!(d.formula_expr && d.formula_expr.trim());
  const stroke = isSkip ? "#ef4444" : hasFormula ? "#d97706" : "#059669";
  const dash = hasFormula ? "8 4" : undefined;

  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke, strokeWidth: selected ? 3 : 2, strokeDasharray: dash }} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="text-[10px] rounded bg-white/90 border px-1 max-w-[120px] truncate shadow-sm"
        >
          {hasFormula ? d.formula_expr : d.document_kind}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
