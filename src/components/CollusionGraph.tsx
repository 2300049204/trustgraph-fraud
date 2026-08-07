import { useMemo, useState } from "react";

import type { GraphEdge, GraphNode } from "@/lib/engine";

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  focusId: string;
  ringId?: string | null;
}

const KIND_FILL: Record<string, string> = {
  seller: "var(--color-node-seller)",
  customer: "var(--color-node-customer)",
  delivery_partner: "var(--color-node-partner)",
  device: "var(--color-node-attr)",
  ip: "var(--color-node-attr)",
  address: "var(--color-node-attr)",
};

const KIND_LABEL: Record<string, string> = {
  seller: "Seller",
  customer: "Buyer",
  delivery_partner: "Delivery partner",
  device: "Device",
  ip: "IP",
  address: "Address",
};

/** Deterministic layout: actors on an outer ring, shared attributes in the centre. */
export function CollusionGraph({ nodes, edges, focusId, ringId }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 760;
  const H = 460;

  const positions = useMemo(() => {
    const actors = nodes.filter((n) => ["seller", "customer", "delivery_partner"].includes(n.kind));
    const attrs = nodes.filter((n) => !["seller", "customer", "delivery_partner"].includes(n.kind));
    const map = new Map<string, { x: number; y: number }>();
    actors.forEach((n, i) => {
      const a = (i / Math.max(1, actors.length)) * Math.PI * 2 - Math.PI / 2;
      map.set(n.id, { x: W / 2 + Math.cos(a) * 250, y: H / 2 + Math.sin(a) * 175 });
    });
    attrs.forEach((n, i) => {
      const a = (i / Math.max(1, attrs.length)) * Math.PI * 2;
      const r = attrs.length === 1 ? 0 : 78;
      map.set(n.id, { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r * 0.75 });
    });
    return map;
  }, [nodes]);

  const active = (id: string) => hover === null || hover === id || edges.some((e) => (e.source === hover && e.target === id) || (e.target === hover && e.source === id));

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Collusion graph</h3>
          {ringId ? (
            <span className="rounded bg-risk-critical-soft px-1.5 py-0.5 text-[11px] font-semibold text-risk-critical">
              Ring {ringId} detected
            </span>
          ) : (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              No ring — direct counterparties shown
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          {["seller", "customer", "delivery_partner", "device"].map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: KIND_FILL[k] }} />
              {KIND_LABEL[k]}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full bg-surface-strong" role="img" aria-label="Collusion graph">
        {edges.map((e, i) => {
          const a = positions.get(e.source);
          const b = positions.get(e.target);
          if (!a || !b) return null;
          const dim = hover !== null && hover !== e.source && hover !== e.target;
          return (
            <g key={i} opacity={dim ? 0.12 : 1}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={e.kind === "shared" ? "var(--color-risk-critical)" : "var(--color-border)"}
                strokeWidth={e.kind === "shared" ? 1.4 : Math.min(4, 1 + e.weight / 4)}
                strokeDasharray={e.kind === "shared" ? "4 3" : undefined}
              />
              {(hover === e.source || hover === e.target) && (
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 - 4}
                  textAnchor="middle"
                  className="num"
                  fontSize="10"
                  fill="var(--color-muted-foreground)"
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const isActor = ["seller", "customer", "delivery_partner"].includes(n.kind);
          const r = n.id === focusId ? 15 : isActor ? 11 : 8;
          return (
            <g
              key={n.id}
              opacity={active(n.id) ? 1 : 0.2}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            >
              {n.id === focusId && (
                <circle cx={p.x} cy={p.y} r={r + 6} fill="none" stroke="var(--color-primary)" strokeWidth="2" />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={KIND_FILL[n.kind]}
                stroke="var(--color-surface)"
                strokeWidth="2"
              />
              <text
                x={p.x}
                y={p.y + r + 12}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-foreground)"
                fontWeight={n.id === focusId ? 700 : 500}
              >
                {isActor ? n.label : `${KIND_LABEL[n.kind]} ${n.label}`}
              </text>
              {isActor && n.risk !== undefined && (
                <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="9" fill="white" className="num">
                  {Math.round(n.risk)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        Dashed red edges are shared-attribute links (same device, IP or address cluster). Solid grey edges are
        order flows, thickness = order count. Hover a node to isolate its links.
      </p>
    </div>
  );
}
