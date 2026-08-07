import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { RiskPill, Shell, SlaClock, Tag, riskBand } from "@/components/trust-ui";
import { ACTION_META } from "@/lib/engine";
import { fetchQueue } from "@/lib/trustgraph.functions";

export const Route = createFileRoute("/console/")({
  head: () => ({
    meta: [
      { title: "Investigator console — Trust Graph" },
      {
        name: "description",
        content:
          "Triage the fraud case queue: blended risk scores, collusion ring membership, top signals and SLA clocks.",
      },
      { property: "og:title", content: "Investigator console — Trust Graph" },
      { property: "og:description", content: "Risk-ranked case queue with collusion ring context and SLA tracking." },
    ],
  }),
  component: ConsolePage,
});

type SortKey = "risk" | "sla" | "graph";

function ConsolePage() {
  const { data, isPending, error } = useQuery({
    queryKey: ["queue"],
    queryFn: () => fetchQueue(),
    staleTime: 30_000,
  });
  const [q, setQ] = useState("");
  const [band, setBand] = useState<string>("all");
  const [ringsOnly, setRingsOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("risk");

  const rows = useMemo(() => {
    let list = data?.items ?? [];
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.displayName.toLowerCase().includes(t) ||
          (i.city ?? "").toLowerCase().includes(t) ||
          (i.ringId ?? "").toLowerCase().includes(t),
      );
    }
    if (band !== "all") list = list.filter((i) => riskBand(i.riskScore).key === band);
    if (ringsOnly) list = list.filter((i) => i.ringId);
    return [...list].sort((a, b) =>
      sort === "risk"
        ? b.riskScore - a.riskScore
        : sort === "graph"
          ? b.graphScore - a.graphScore
          : new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime(),
    );
  }, [data, q, band, ringsOnly, sort]);

  const stats = useMemo(() => {
    const items = data?.items ?? [];
    const rings = new Set(items.filter((i) => i.ringId).map((i) => i.ringId));
    const overdue = items.filter((i) => new Date(i.slaDeadline).getTime() < Date.now()).length;
    return {
      open: items.length,
      critical: items.filter((i) => i.riskScore >= 80).length,
      rings: rings.size,
      overdue,
      actioned: (data?.actions ?? []).length,
      appeals: (data?.appeals ?? []).length,
    };
  }, [data]);

  return (
    <Shell>
      <main className="mx-auto max-w-[1400px] px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="label-caps">Investigator console</span>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Case queue</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every case is materialised by the deterministic triage scorer and the graph analyst — zero model cost.
              Open a case to run the language agents.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[
              ["Open", stats.open],
              ["Critical", stats.critical],
              ["Rings", stats.rings],
              ["Overdue", stats.overdue],
              ["Actioned", stats.actioned],
              ["Appeals", stats.appeals],
            ].map(([k, v]) => (
              <div key={k as string} className="panel px-3 py-2 text-center">
                <div className="num text-lg font-semibold">{v as number}</div>
                <div className="label-caps">{k as string}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel mt-6 flex flex-wrap items-center gap-3 p-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actor, city or ring id"
            className="min-w-56 flex-1 rounded-md border border-input bg-surface px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={band}
            onChange={(e) => setBand(e.target.value)}
            className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
          >
            <option value="all">All risk bands</option>
            <option value="critical">Critical (80+)</option>
            <option value="high">High (62–79)</option>
            <option value="medium">Medium (42–61)</option>
            <option value="low">Low (&lt;42)</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
          >
            <option value="risk">Sort: blended risk</option>
            <option value="graph">Sort: graph score</option>
            <option value="sla">Sort: SLA urgency</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={ringsOnly} onChange={(e) => setRingsOnly(e.target.checked)} />
            Ring members only
          </label>
        </div>

        {error ? (
          <p className="panel mt-6 p-6 text-sm text-destructive">Could not load the queue: {String(error)}</p>
        ) : isPending ? (
          <div className="panel mt-6 space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : (
          <div className="panel mt-6 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b border-border bg-surface-strong">
                <tr className="text-left">
                  {["Actor", "Risk", "Txn / Graph", "Top signals", "Ring", "Recommended", "SLA", ""].map((h) => (
                    <th key={h} className="label-caps px-3 py-2.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.caseId} className="border-b border-border/70 align-top hover:bg-muted/50">
                    <td className="px-3 py-3">
                      <div className="font-medium">{r.displayName}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                        <Tag>{r.role.replace("_", " ")}</Tag>
                        {r.sizeTier ? <Tag>{r.sizeTier}</Tag> : null}
                        <span className="num">{r.tenureDays}d tenure</span>
                        {r.city ? <span>· {r.city}</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <RiskPill score={r.riskScore} />
                    </td>
                    <td className="num px-3 py-3 text-xs text-muted-foreground">
                      {r.txnScore.toFixed(0)} / {r.graphScore.toFixed(0)}
                    </td>
                    <td className="max-w-80 px-3 py-3">
                      <ul className="space-y-0.5 text-xs text-muted-foreground">
                        {r.topSignals.map((s, si) => (
                          <li key={`${s.key}-${si}`}>
                            <span className="font-medium text-foreground">{s.label}</span>{" "}
                            <span className="num">+{s.contribution.toFixed(0)}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {r.ringId ? (
                        <span className="rounded bg-risk-critical-soft px-1.5 py-0.5 font-semibold text-risk-critical">
                          {r.ringId} · {r.ringMembers.length}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <div className="font-medium">{ACTION_META[r.recommendedAction].label}</div>
                      <div className="text-muted-foreground">{r.primaryRule}</div>
                    </td>
                    <td className="px-3 py-3">
                      <SlaClock deadline={r.slaDeadline} />
                      <div className="label-caps mt-0.5">{r.status.replace(/_/g, " ")}</div>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        to="/console/$caseId"
                        params={{ caseId: r.caseId }}
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                      >
                        Investigate
                      </Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      No cases match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </Shell>
  );
}
