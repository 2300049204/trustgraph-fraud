import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { RiskPill, SlaClock, StateBlock, Tag, riskBand } from "@/components/trust-ui";
import { ACTION_META } from "@/lib/engine";
import { fetchQueue } from "@/lib/trustgraph.functions";

type SortKey = "risk" | "sla" | "graph" | "created";

const ALL = "all";

export function CaseQueue() {
  const { data, isPending, error } = useQuery({
    queryKey: ["queue"],
    queryFn: () => fetchQueue(),
    staleTime: 30_000,
  });

  const [q, setQ] = useState("");
  const [band, setBand] = useState(ALL);
  const [role, setRole] = useState(ALL);
  const [fraudType, setFraudType] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [actionFilter, setActionFilter] = useState(ALL);
  const [graphOnly, setGraphOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("risk");

  const currentActionByCase = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of data?.actions ?? []) {
      if (!m.has(a.case_id)) m.set(a.case_id, a.action_type);
    }
    return m;
  }, [data]);

  const fraudTypes = useMemo(
    () => [...new Set((data?.items ?? []).map((i) => i.primaryRule))].sort(),
    [data],
  );
  const statuses = useMemo(() => [...new Set((data?.items ?? []).map((i) => i.status))].sort(), [data]);

  const rows = useMemo(() => {
    let list = data?.items ?? [];
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.displayName.toLowerCase().includes(t) ||
          i.actorId.toLowerCase().includes(t) ||
          i.caseId.toLowerCase().includes(t) ||
          (i.city ?? "").toLowerCase().includes(t) ||
          (i.ringId ?? "").toLowerCase().includes(t),
      );
    }
    if (band !== ALL) list = list.filter((i) => riskBand(i.riskScore).key === band);
    if (role !== ALL) list = list.filter((i) => i.role === role);
    if (fraudType !== ALL) list = list.filter((i) => i.primaryRule === fraudType);
    if (status !== ALL) list = list.filter((i) => i.status === status);
    if (actionFilter !== ALL) list = list.filter((i) => i.recommendedAction === actionFilter);
    if (graphOnly) list = list.filter((i) => i.ringId);
    return [...list].sort((a, b) =>
      sort === "risk"
        ? b.riskScore - a.riskScore
        : sort === "graph"
          ? b.graphScore - a.graphScore
          : sort === "created"
            ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            : new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime(),
    );
  }, [data, q, band, role, fraudType, status, actionFilter, graphOnly, sort]);

  const stats = useMemo(() => {
    const items = data?.items ?? [];
    const rings = new Set(items.filter((i) => i.ringId).map((i) => i.ringId));
    return {
      open: items.length,
      critical: items.filter((i) => i.riskScore >= 80).length,
      rings: rings.size,
      overdue: items.filter((i) => new Date(i.slaDeadline).getTime() < Date.now()).length,
      actioned: (data?.actions ?? []).length,
      appeals: (data?.appeals ?? []).length,
    };
  }, [data]);

  const selectCls = "rounded-md border border-input bg-surface px-2 py-1.5 text-sm";

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="label-caps">Investigator console</span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Case queue</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cases are materialised by the deterministic triage scorer and the graph analyst at zero model cost. Open
            a case to run the language agents, inspect the network and take precision-gated remediation.
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
          placeholder="Search case id, actor, city or ring"
          aria-label="Search cases"
          className="min-w-56 flex-1 rounded-md border border-input bg-surface px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <select aria-label="Risk band" value={band} onChange={(e) => setBand(e.target.value)} className={selectCls}>
          <option value={ALL}>All risk bands</option>
          <option value="critical">Critical (80+)</option>
          <option value="high">High (62–79)</option>
          <option value="medium">Medium (42–61)</option>
          <option value="low">Low (&lt;42)</option>
        </select>
        <select aria-label="Actor type" value={role} onChange={(e) => setRole(e.target.value)} className={selectCls}>
          <option value={ALL}>All actor types</option>
          <option value="customer">Customer</option>
          <option value="seller">Seller</option>
          <option value="delivery_partner">Delivery partner</option>
        </select>
        <select
          aria-label="Fraud type"
          value={fraudType}
          onChange={(e) => setFraudType(e.target.value)}
          className={selectCls}
        >
          <option value={ALL}>All fraud types</option>
          {fraudTypes.map((f) => (
            <option key={f} value={f}>
              {f.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
          <option value={ALL}>All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          aria-label="Recommended action"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className={selectCls}
        >
          <option value={ALL}>All actions</option>
          {Object.entries(ACTION_META).map(([k, m]) => (
            <option key={k} value={k}>
              {m.label}
            </option>
          ))}
        </select>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectCls}>
          <option value="risk">Sort: blended risk</option>
          <option value="graph">Sort: graph score</option>
          <option value="sla">Sort: SLA urgency</option>
          <option value="created">Sort: newest</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={graphOnly} onChange={(e) => setGraphOnly(e.target.checked)} />
          Graph involvement only
        </label>
      </div>

      {error ? (
        <div className="mt-6">
          <StateBlock
            kind="error"
            title="Backend unavailable"
            message={`The case service did not respond: ${String(error)}. No metrics are substituted.`}
          />
        </div>
      ) : isPending ? (
        <div className="mt-6">
          <StateBlock kind="loading" title="Loading" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <StateBlock kind="empty" title="No cases match these filters" message="Clear a filter to widen the queue." />
        </div>
      ) : (
        <div className="panel mt-6 overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="border-b border-border bg-surface-strong">
              <tr className="text-left">
                {[
                  "Case",
                  "Actor",
                  "Risk",
                  "Txn / Graph",
                  "Fraud type",
                  "Ring",
                  "Recommended",
                  "Current action",
                  "Status",
                  "Created",
                  "SLA",
                  "",
                ].map((h) => (
                  <th key={h} className="label-caps px-3 py-2.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const current = currentActionByCase.get(r.caseId);
                return (
                  <tr key={r.caseId} className="border-b border-border/70 align-top hover:bg-muted/50">
                    <td className="num px-3 py-3 text-xs text-muted-foreground">{r.caseId.slice(0, 8)}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{r.displayName}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                        <Tag>{r.role.replace("_", " ")}</Tag>
                        {r.sizeTier ? <Tag>{r.sizeTier}</Tag> : null}
                        <span className="num">{r.actorId}</span>
                        {r.city ? <span>· {r.city}</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <RiskPill score={r.riskScore} />
                    </td>
                    <td className="num px-3 py-3 text-xs text-muted-foreground">
                      {r.txnScore.toFixed(0)} / {r.graphScore.toFixed(0)}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <div className="font-medium">{r.primaryRule.replace(/_/g, " ")}</div>
                      <div className="text-muted-foreground">{r.topSignals[0]?.label ?? ""}</div>

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
                    <td className="px-3 py-3 text-xs font-medium">{ACTION_META[r.recommendedAction].label}</td>
                    <td className="px-3 py-3 text-xs">
                      {current ? (
                        <span className="font-medium">{current.replace(/_/g, " ")}</span>
                      ) : (
                        <span className="text-muted-foreground">none</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">{r.status.replace(/_/g, " ")}</td>
                    <td className="num px-3 py-3 text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-3 py-3">
                      <SlaClock deadline={r.slaDeadline} />
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
