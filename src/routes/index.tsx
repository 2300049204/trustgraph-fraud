import { createFileRoute, Link } from "@tanstack/react-router";

import { Shell } from "@/components/trust-ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trust Graph — Multi-Actor Fraud Detection & Remediation" },
      {
        name: "description",
        content:
          "Graph-native marketplace fraud detection: collusion ring discovery, plain-language evidence, precision-gated remediation and a human appeal path.",
      },
      { property: "og:title", content: "Trust Graph — Multi-Actor Fraud Detection & Remediation" },
      {
        property: "og:description",
        content:
          "Score orders for risk, surface collusion rings a per-transaction model can't see, and drive graduated, appealable remediation.",
      },
    ],
  }),
  component: Landing,
});

const METRICS = [
  { k: "Fraud loss avoided", v: "Measured against confirmed-fraud labels on a held-out slice" },
  { k: "Precision ≥ 95% for hard actions", v: "Enforced in code — blocked actions route to a human" },
  { k: "Median time-to-resolution", v: "SLA clock on every case, overdue reviews escalate" },
  { k: "Action-rate parity", v: "Computed per seller-size and partner cohort, published on the dashboard" },
];

const AGENTS = [
  ["Triage scorer", "Deterministic feature rules over transaction, device and velocity features.", "No LLM · ₹0"],
  ["Graph analyst", "Union-find ring detection, reciprocal loops, rating inflation, POD anomalies.", "No LLM · ₹0"],
  ["Evidence explainer", "Turns numbers and graph structure into narrative for both audiences.", "Cheap LLM"],
  ["Remediation planner", "Picks the graduated action, sets time bound + SLA, checks the precision gate.", "Cheap LLM"],
  ["Self-check reviewer", "Audits high-stakes actions against fairness and livelihood guardrails.", "Reasoning LLM"],
];

function Landing() {
  return (
    <Shell>
      <main>
        <section className="border-b border-border bg-surface">
          <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-20 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <span className="label-caps">Track 5 · Trust & Safety</span>
              <h1 className="mt-3 text-5xl font-semibold leading-[1.05] tracking-tight">
                Fraud is a network.
                <br />
                <span className="text-primary">Score it like one.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                A per-transaction model sees one order at a time. Trust Graph links buyers, sellers, delivery
                partners, devices, IPs and addresses into one actor graph — then explains what it found in
                language a human reviewer and an accused seller can both act on.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/console"
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Enter console
                </Link>
                <Link
                  to="/metrics"
                  className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
                >
                  See measured results
                </Link>
              </div>
            </div>
            <div className="panel p-6">
              <span className="label-caps">The problem</span>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Refund abuse, seller–buyer collusion, fake delivery scans and rating inflation are coordinated
                across accounts. Scored one transaction at a time, each order looks ordinary. Meanwhile every
                false positive freezes someone's income, so aggressive blocking is not an option.
              </p>
              <span className="label-caps mt-6 block">The approach</span>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {[
                  "Deterministic triage score over transaction, device and velocity features.",
                  "Classical graph solver over shared identifiers to surface collusion rings.",
                  "LLMs only where language and judgement are needed — never for scoring.",
                  "Graduated, time-bound, appealable remediation behind a precision gate.",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1400px] px-5 py-16">
          <h2 className="text-2xl font-semibold">Success metrics we hold ourselves to</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {METRICS.map((m) => (
              <div key={m.k} className="panel p-5">
                <p className="text-sm font-semibold text-primary">{m.k}</p>
                <p className="mt-2 text-sm text-muted-foreground">{m.v}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-[1400px] px-5 py-16">
            <h2 className="text-2xl font-semibold">Five cooperating agents, not one mega-prompt</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Each step runs on the cheapest engine that can do the job. Every run is logged with its tier and
              estimated cost, so cost-per-decision on the dashboard is measured, not asserted.
            </p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="label-caps py-2">Agent</th>
                    <th className="label-caps py-2">Job</th>
                    <th className="label-caps py-2">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {AGENTS.map(([a, j, t]) => (
                    <tr key={a} className="border-b border-border/70">
                      <td className="py-3 pr-4 font-medium">{a}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{j}</td>
                      <td className="num py-3 whitespace-nowrap text-primary">{t}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1400px] px-5 py-16">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="panel p-6">
              <span className="label-caps">Guardrails, implemented</span>
              <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Precision gate.</strong> Suspensions and payout freezes are
                  unavailable below 95% measured rule precision; the UI says why and routes to a human.
                </li>
                <li>
                  <strong className="text-foreground">Livelihood.</strong> Every income-affecting action carries an
                  expiry, an appeal link and an SLA deadline. Overdue reviews escalate in the queue.
                </li>
                <li>
                  <strong className="text-foreground">Auditability.</strong> Append-only evidence log per case — no
                  updates, no deletes — written in reviewer-readable language.
                </li>
                <li>
                  <strong className="text-foreground">Data residency.</strong> PII lives in a dedicated table with a
                  documented India-region processing boundary and investigator-only access.
                </li>
              </ul>
            </div>
            <div className="panel p-6">
              <span className="label-caps">Cost per decision</span>
              <p className="mt-3 text-sm text-muted-foreground">
                The classical scorer and graph solver handle the overwhelming majority of decisions at zero model
                cost. LLM tiers are invoked per case, on demand, by the investigator — and the reasoning tier only
                on high-stakes cases.
              </p>
              <div className="mt-4 space-y-2 text-sm">
                {[
                  ["Triage + graph", "₹0.00"],
                  ["Explainer / planner", "₹0.42 each"],
                  ["Self-check reviewer", "₹2.60"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-border/70 pb-1.5">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="num font-semibold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel p-6">
              <span className="label-caps">Roadmap — not in this build</span>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Real dataset ingestion (IEEE-CIS / Elliptic CSV upload and scoring).</li>
                <li>Live API keys for AbuseIPDB, GSTIN verification and notifications — the adapter layer is
                  already in place, so no call sites change.</li>
                <li>A trained ML model; today's scorer is a transparent feature-weighted model over seeded labels.</li>
              </ul>
            </div>
          </div>
        </section>

        <footer className="border-t border-border bg-surface">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-muted-foreground">
            <span>Trust Graph · demo data, seeded collusion rings, held-out labels. No real customer data.</span>
            <span>Processing boundary: India region.</span>
          </div>
        </footer>
      </main>
    </Shell>
  );
}
