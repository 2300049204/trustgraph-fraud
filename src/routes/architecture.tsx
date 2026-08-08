import { createFileRoute } from "@tanstack/react-router";

import { Shell } from "@/components/trust-ui";

export const Route = createFileRoute("/architecture")({
  head: () => ({
    meta: [
      { title: "Architecture — Trust Graph" },
      { name: "description", content: "How Trust Graph's five cooperating agents turn raw marketplace data into gated remediation." },
      { property: "og:title", content: "Architecture — Trust Graph" },
      { property: "og:description", content: "Triage, graph, explainer, planner and reviewer agents with a deterministic-first cost model." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArchitecturePage,
});

const AGENTS = [
  ["Triage scorer", "Deterministic", "Rule-based transaction scoring: refund abuse, velocity spikes, POD anomalies, rating manipulation.", "₹0"],
  ["Graph analyst", "Deterministic", "Union-Find clustering over shared devices, IPs and addresses; reciprocal loop and rating-density weighting.", "₹0"],
  ["Explainer", "LLM", "Turns the signal set into plain-language evidence for investigators and for the accused party.", "per case"],
  ["Planner", "LLM", "Proposes graduated remediation, constrained to the action ladder and the precision gate.", "per case"],
  ["Reviewer", "LLM", "Self-check pass that must agree with the evidence before a hard action is offered.", "per case"],
] as const;

function ArchitecturePage() {
  return (
    <Shell>
      <main className="mx-auto max-w-[1100px] px-5 py-8">
        <span className="label-caps">System design</span>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Architecture</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Deterministic engines do the scoring at zero marginal cost; language models are spent only on the handful
          of cases a human is about to look at.
        </p>

        <pre className="panel mt-6 overflow-x-auto p-4 text-xs leading-relaxed">{`DATA  ──▶  Triage scorer ──┐
(orders, claims,           ├──▶ Risk fusion ──▶ Evidence ──▶ Explainer
 fingerprints, PODs,       │      (blended)                      │
 ratings, payouts)         │                                     ▼
           └──▶ Graph analyst                            Precision gate
                (rings, loops)                                   │
                                                                 ▼
                              Audit trail ◀── Appeal ◀── Graduated remediation`}</pre>

        <div className="panel mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border bg-surface-strong">
              <tr className="text-left">
                {["Agent", "Tier", "Responsibility", "Cost"].map((h) => (
                  <th key={h} className="label-caps px-3 py-2.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AGENTS.map(([name, tier, what, cost]) => (
                <tr key={name} className="border-b border-border/70 align-top">
                  <td className="px-3 py-3 font-medium">{name}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{tier}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{what}</td>
                  <td className="num px-3 py-3 text-xs">{cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </Shell>
  );
}
