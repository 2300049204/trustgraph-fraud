import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Shell } from "@/components/trust-ui";
import { fetchMetrics } from "@/lib/trustgraph.functions";

export const Route = createFileRoute("/metrics")({
  head: () => ({
    meta: [
      { title: "Ops metrics — Trust Graph" },
      {
        name: "description",
        content:
          "Measured fraud loss avoided, precision and recall lift from graph signals, appeal overturn rate, fairness parity and cost per decision.",
      },
      { property: "og:title", content: "Ops metrics — Trust Graph" },
      { property: "og:description", content: "Detection quality, fairness parity and cost per decision, measured." },
    ],
  }),
  component: MetricsPage,
});

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <div className="h-2 w-full rounded bg-muted">
      <div
        className="h-2 rounded bg-primary"
        style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }}
      />
    </div>
  );
}

function MetricsPage() {
  const { data, isPending, error } = useQuery({ queryKey: ["metrics"], queryFn: () => fetchMetrics() });

  if (isPending)
    return (
      <Shell>
        <main className="mx-auto max-w-[1400px] px-5 py-10 text-sm text-muted-foreground">Computing metrics…</main>
      </Shell>
    );
  if (error || !data)
    return (
      <Shell>
        <main className="mx-auto max-w-[1400px] px-5 py-10 text-sm text-destructive">Metrics unavailable.</main>
      </Shell>
    );

  const maxCohort = Math.max(...data.cohorts.map((c) => c.flagRate), 0.01);

  return (
    <Shell>
      <main className="mx-auto max-w-[1400px] px-5 py-8">
        <span className="label-caps">Ops dashboard</span>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Measured performance</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Detection quality is evaluated on a held-out labelled slice of {data.actorCount} actors and{" "}
          {data.orderCount.toLocaleString("en-IN")} orders at a risk threshold of {data.threshold}. Nothing on this
          page is hard-coded — every figure recomputes from the engine and the case database.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              k: "Fraud loss avoided",
              v: inr(data.fraudLossAvoided),
              s: `${pct(data.fraudLossTotal ? data.fraudLossAvoided / data.fraudLossTotal : 0)} of ${inr(data.fraudLossTotal)} labelled fraud loss`,
            },
            {
              k: "Precision @ threshold",
              v: pct(data.blended.precision),
              s: `${data.lift.precision >= 0 ? "+" : ""}${(data.lift.precision * 100).toFixed(1)} pts vs transaction-only`,
            },
            {
              k: "Recall @ threshold",
              v: pct(data.blended.recall),
              s: `${data.lift.caught >= 0 ? "+" : ""}${data.lift.caught} extra fraud actors caught by graph signals`,
            },
            {
              k: "Cost per decision",
              v: `₹${data.cost.perDecision.toFixed(2)}`,
              s: `${pct(data.cost.llmFreeShare)} of agent runs cost nothing`,
            },
          ].map((m) => (
            <div key={m.k} className="panel p-5">
              <div className="label-caps">{m.k}</div>
              <div className="num mt-1 text-3xl font-semibold">{m.v}</div>
              <div className="mt-1 text-xs text-muted-foreground">{m.s}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section className="panel p-5">
            <h2 className="text-sm font-semibold">Graph lift: does the network actually help?</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Same actors, same threshold, same labels — the only difference is whether the graph score is blended in.
            </p>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="label-caps py-2">Model</th>
                  <th className="label-caps py-2">Precision</th>
                  <th className="label-caps py-2">Recall</th>
                  <th className="label-caps py-2">F1</th>
                  <th className="label-caps py-2">TP / FP / FN</th>
                </tr>
              </thead>
              <tbody className="num">
                {[
                  ["Transaction-only", data.txnOnly],
                  ["Blended (graph)", data.blended],
                ].map(([label, m]) => {
                  const met = m as typeof data.blended;
                  return (
                    <tr key={label as string} className="border-b border-border/70">
                      <td className="py-2 font-medium">{label as string}</td>
                      <td className="py-2">{pct(met.precision)}</td>
                      <td className="py-2">{pct(met.recall)}</td>
                      <td className="py-2">{pct(met.f1)}</td>
                      <td className="py-2 text-muted-foreground">
                        {met.tp} / {met.fp} / {met.fn}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-4">
              <div className="label-caps">Collusion rings surfaced</div>
              <ul className="mt-2 space-y-1.5 text-sm">
                {data.rings.map((r) => (
                  <li key={r.id} className="flex justify-between border-b border-border/70 pb-1.5">
                    <span className="font-medium">{r.id}</span>
                    <span className="num text-muted-foreground">
                      {r.members} actors · {r.loops} reciprocal loops
                    </span>
                  </li>
                ))}
                {data.rings.length === 0 && <li className="text-muted-foreground">No rings detected.</li>}
              </ul>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-semibold">Fairness: action-rate parity by cohort</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              A model that quietly punishes small or new sellers is a failure even at high precision. Flag rate and
              action rate are published per cohort so drift is visible.
            </p>
            <div className="mt-3 space-y-3">
              {data.cohorts.map((c) => (
                <div key={c.name}>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{c.name}</span>
                    <span className="num text-muted-foreground">
                      flagged {pct(c.flagRate)} · actioned {pct(c.actionRate)} · n={c.total}
                    </span>
                  </div>
                  <div className="mt-1">
                    <Bar value={c.flagRate} max={maxCohort} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-semibold">Human oversight & remediation</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {[
                ["Actions taken", data.actionsTaken],
                ["Blocked by precision gate", data.gateBlocked],
                ["Appeals filed", data.appeals.total],
                ["Appeals decided", data.appeals.decided],
                ["Overturn rate", pct(data.appeals.overturnRate)],
                ["Median time-to-resolution", `${data.medianResolutionMin} min`],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-md border border-border bg-surface-strong p-3">
                  <div className="label-caps">{k as string}</div>
                  <div className="num mt-1 text-xl font-semibold">{v as string}</div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="label-caps">Measured rule precision (95% gate for hard actions)</div>
              <ul className="mt-2 space-y-1.5 text-sm">
                {data.precision.map((p) => (
                  <li key={p.rule_key} className="flex items-center justify-between gap-3 border-b border-border/70 pb-1.5">
                    <span className="num text-xs">{p.rule_key}</span>
                    <span
                      className={`num text-xs font-semibold ${Number(p.precision) >= 0.95 ? "text-risk-low" : "text-risk-high"}`}
                    >
                      {pct(Number(p.precision))} {Number(p.precision) >= 0.95 ? "· hard actions allowed" : "· soft only"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-semibold">Cost per decision by tier</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.cost.decisions} decisions, ₹{data.cost.total.toFixed(2)} total model spend. Deterministic agents
              carry the volume; reasoning is reserved for high-stakes cases.
            </p>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="label-caps py-2">Tier</th>
                  <th className="label-caps py-2">Runs</th>
                  <th className="label-caps py-2">Cost</th>
                </tr>
              </thead>
              <tbody className="num">
                {data.cost.byTier.map((t) => (
                  <tr key={t.tier} className="border-b border-border/70">
                    <td className="py-2">{t.tier.replace(/_/g, " ")}</td>
                    <td className="py-2">{t.runs}</td>
                    <td className="py-2">₹{t.cost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              Cases in database: <span className="num">{data.caseCount}</span>. Cost per decision falls as
              deterministic coverage rises — the language agents are opt-in per case, not per order.
            </p>
          </section>
        </div>
      </main>
    </Shell>
  );
}
