import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { CollusionGraph } from "@/components/CollusionGraph";
import { RiskPill, Shell, SlaClock, useSession } from "@/components/trust-ui";
import { ACTION_META, type ActionKey } from "@/lib/engine";
import {
  applyAction,
  explainCase,
  fetchCase,
  planRemediation,
  resolveAppeal,
  selfCheckCase,
} from "@/lib/trustgraph.functions";

export const Route = createFileRoute("/console/$caseId")({
  head: () => ({
    meta: [
      { title: "Case detail — Trust Graph console" },
      {
        name: "description",
        content:
          "Evidence timeline, collusion graph, precision-gated remediation and appeal decisions for a single fraud case.",
      },
      { property: "og:title", content: "Case detail — Trust Graph console" },
      { property: "og:description", content: "Full evidence, graph context and remediation controls for a case." },
    ],
  }),
  component: CaseDetail,
});

const ACTIONS: ActionKey[] = ["monitor", "step_up_verify", "payout_hold", "payout_freeze", "suspend"];

function CaseDetail() {
  const { caseId } = Route.useParams();
  const { signedIn } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<{ investigator: string; accused: string } | null>(null);
  const [plan, setPlan] = useState<{ action: string; rationale: string; gate: { allowed: boolean; measured: number; reason: string | null } } | null>(null);
  const [review, setReview] = useState<{ verdict: string; reason: string } | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => fetchCase({ data: { caseId } }),
  });

  const guard = () => {
    if (!signedIn) {
      toast.error("Sign in as an investigator to run agents and take actions.");
      return false;
    }
    return true;
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    if (!guard()) return;
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Agent failed");
    } finally {
      setBusy(null);
    }
  };

  if (isPending) return <Shell><main className="mx-auto max-w-[1400px] px-5 py-10 text-sm text-muted-foreground">Loading case…</main></Shell>;
  if (error || !data) return <Shell><main className="mx-auto max-w-[1400px] px-5 py-10 text-sm text-destructive">Case not found.</main></Shell>;

  const c = data.case;
  const s = data.scored;
  const precisionFor = (rule: string) => Number(data.precision.find((p) => p.rule_key === rule)?.precision ?? 0);
  const primaryRule = s?.primaryRule ?? "unknown_rule";
  const openAppeal = data.appeals.find((a) => a.status !== "decided");

  return (
    <Shell>
      <main className="mx-auto max-w-[1400px] px-5 py-8">
        <Link to="/console" className="text-xs text-muted-foreground hover:underline">
          ← Back to queue
        </Link>

        <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{s?.displayName ?? c.actor_id}</h1>
              <RiskPill score={Number(c.risk_score)} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {s?.role.replace("_", " ")} · {s?.city ?? "unknown city"} · {s?.tenureDays ?? 0} days tenure
              {s?.sizeTier ? ` · ${s.sizeTier} seller` : ""} · case status{" "}
              <span className="font-medium text-foreground">{c.status.replace(/_/g, " ")}</span>
            </p>
          </div>
          <div className="panel px-4 py-2 text-right">
            <div className="label-caps">SLA</div>
            <SlaClock deadline={c.sla_deadline} />
          </div>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-5">
            <section className="panel p-5">
              <h2 className="text-sm font-semibold">Risk breakdown</h2>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[
                  ["Transaction score", Number(c.txn_score), "Per-order features only"],
                  ["Graph score", Number(c.graph_score), "Network / ring structure"],
                  ["Blended risk", Number(c.risk_score), "60% graph when in a ring"],
                ].map(([label, val, note]) => (
                  <div key={label as string} className="rounded-md border border-border bg-surface-strong p-3">
                    <div className="label-caps">{label as string}</div>
                    <div className="num mt-1 text-2xl font-semibold">{(val as number).toFixed(0)}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{note as string}</div>
                  </div>
                ))}
              </div>
              <ul className="mt-4 space-y-2">
                {(s?.signals ?? []).map((sig, si) => (
                  <li key={`${sig.key}-${si}`} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{sig.label}</span>
                      <span className="num text-xs font-semibold text-primary">+{sig.contribution.toFixed(1)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{sig.detail}</p>
                    <div className="mt-2 h-1.5 rounded bg-muted">
                      <div
                        className="h-1.5 rounded bg-primary"
                        style={{ width: `${Math.min(100, sig.contribution * 3)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <CollusionGraph nodes={data.graph.nodes} edges={data.graph.edges} focusId={c.actor_id} ringId={c.ring_id} />

            <section className="panel p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Evidence log</h2>
                <span className="label-caps">append-only</span>
              </div>
              <ol className="mt-3 space-y-3 border-l border-border pl-4">
                {data.evidence.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="label-caps">{e.source.replace(/_/g, " ")}</span>
                      <span className="num text-[11px] text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{e.summary}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="space-y-5">
            <section className="panel p-5">
              <h2 className="text-sm font-semibold">Language agents</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Run on demand. Each run is logged with its tier and cost, and feeds the cost-per-decision metric.
              </p>
              <div className="mt-3 space-y-2">
                <button
                  disabled={busy !== null}
                  onClick={() =>
                    run("explain", async () => {
                      const r = await explainCase({ data: { caseId } });
                      setNarrative({ investigator: r.narrative, accused: r.appealNarrative });
                      toast.success("Evidence explained");
                      refetch();
                    })
                  }
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {busy === "explain" ? "Explaining…" : "Explain evidence · cheap tier"}
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() =>
                    run("plan", async () => {
                      const r = await planRemediation({ data: { caseId } });
                      setPlan({ action: r.action, rationale: r.rationale, gate: r.gate });
                      toast.success("Remediation planned");
                    })
                  }
                  className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
                >
                  {busy === "plan" ? "Planning…" : "Plan remediation · cheap tier"}
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() =>
                    run("review", async () => {
                      const r = await selfCheckCase({ data: { caseId } });
                      setReview(r);
                      toast.success(`Self-check: ${r.verdict}`);
                    })
                  }
                  className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
                >
                  {busy === "review" ? "Reviewing…" : "Self-check high-stakes action · reasoning tier"}
                </button>
              </div>

              {(narrative?.investigator || c.narrative) && (
                <div className="mt-4 rounded-md border border-border bg-surface-strong p-3">
                  <div className="label-caps">Investigator narrative</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {narrative?.investigator ?? c.narrative}
                  </p>
                </div>
              )}
              {(narrative?.accused || c.appeal_narrative) && (
                <div className="mt-3 rounded-md border border-border bg-surface-strong p-3">
                  <div className="label-caps">Plain-language notice to the accused party</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {narrative?.accused ?? c.appeal_narrative}
                  </p>
                </div>
              )}
              {plan && (
                <div className="mt-3 rounded-md border border-border p-3">
                  <div className="label-caps">Planner recommendation</div>
                  <p className="mt-1 text-sm font-medium">{ACTION_META[plan.action as ActionKey]?.label ?? plan.action}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.rationale}</p>
                  {!plan.gate.allowed && (
                    <p className="mt-2 rounded bg-risk-high-soft p-2 text-xs text-risk-high">{plan.gate.reason}</p>
                  )}
                </div>
              )}
              {review && (
                <div className="mt-3 rounded-md border border-border p-3">
                  <div className="label-caps">Self-check reviewer</div>
                  <p className="mt-1 text-sm font-medium">{review.verdict}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{review.reason}</p>
                </div>
              )}
            </section>

            <section className="panel p-5">
              <h2 className="text-sm font-semibold">Graduated remediation</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Hard, income-affecting actions require ≥95% measured precision for the triggering rule
                (<span className="num">{primaryRule}</span>:{" "}
                <span className="num font-semibold">{(precisionFor(primaryRule) * 100).toFixed(1)}%</span>). Blocked
                actions are downgraded to human review automatically.
              </p>
              <div className="mt-3 space-y-2">
                {ACTIONS.map((a) => {
                  const meta = ACTION_META[a];
                  const blocked = meta.severity === "hard" && precisionFor(primaryRule) < 0.95;
                  return (
                    <button
                      key={a}
                      disabled={busy !== null}
                      onClick={() =>
                        run(a, async () => {
                          const r = await applyAction({ data: { caseId, action: a, ruleKey: primaryRule } });
                          toast[r.gate.allowed ? "success" : "warning"](
                            r.gate.allowed ? `${meta.label} applied` : "Blocked by precision gate — routed to human review",
                          );
                          refetch();
                        })
                      }
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm disabled:opacity-60 ${
                        blocked ? "border-risk-high/40 bg-risk-high-soft/40" : "border-border hover:bg-muted"
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        <span className="font-medium">{meta.label}</span>
                        <span className="label-caps">{meta.severity}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {meta.hours ? `Time-bound ${meta.hours}h · appealable` : "No restriction"}
                        {blocked ? " · gate will block, routes to human review" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
              {data.actions.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-border pt-3 text-xs">
                  {data.actions.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-2">
                      <span>
                        <span className="font-medium">{a.action_type.replace(/_/g, " ")}</span>{" "}
                        <span className="text-muted-foreground">
                          {new Date(a.created_at).toLocaleString("en-IN")}
                        </span>
                        {a.gate_reason ? <span className="block text-risk-high">{a.gate_reason}</span> : null}
                      </span>
                      <span className={`num shrink-0 ${a.gate_passed ? "text-risk-low" : "text-risk-high"}`}>
                        {(Number(a.precision_at_decision) * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel p-5">
              <h2 className="text-sm font-semibold">Appeals</h2>
              {data.appeals.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  No appeal filed. The accused party portal is at{" "}
                  <Link to="/appeals/$caseId" params={{ caseId }} className="underline">
                    /appeals/{caseId.slice(0, 8)}…
                  </Link>
                </p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {data.appeals.map((a) => (
                    <li key={a.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between">
                        <span className="label-caps">{a.status}{a.outcome ? ` · ${a.outcome}` : ""}</span>
                        {a.sla_deadline ? <SlaClock deadline={a.sla_deadline} /> : null}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.statement}</p>
                      {a.evidence_note ? (
                        <p className="mt-1 text-xs text-muted-foreground">Evidence: {a.evidence_note}</p>
                      ) : null}
                      {a.status !== "decided" && (
                        <div className="mt-3 flex gap-2">
                          {(["overturned", "upheld"] as const).map((outcome) => (
                            <button
                              key={outcome}
                              disabled={busy !== null}
                              onClick={() =>
                                run(outcome, async () => {
                                  await resolveAppeal({
                                    data: {
                                      appealId: a.id,
                                      outcome,
                                      note:
                                        outcome === "overturned"
                                          ? "Evidence supplied by the accused party resolved the anomaly."
                                          : "Evidence did not address the linked-account pattern.",
                                    },
                                  });
                                  toast.success(`Appeal ${outcome}`);
                                  refetch();
                                })
                              }
                              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
                            >
                              {outcome === "overturned" ? "Overturn action" : "Uphold action"}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {openAppeal ? (
                <p className="mt-2 text-xs text-risk-high">An appeal is awaiting a human decision.</p>
              ) : null}
            </section>

            <section className="panel p-5">
              <h2 className="text-sm font-semibold">External signals & residency</h2>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                {data.external.map((x, i) => (
                  <li key={i} className="border-b border-border/70 pb-1.5">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium text-foreground">{x.provider}</span>
                      <span className="label-caps">{x.live ? "live" : "simulated"}</span>
                    </div>
                    <div>
                      {x.verdict} — {x.detail}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Deterministic stubs behind a single adapter interface — swapping in live AbuseIPDB / GSTIN keys
                changes no call sites. PII is stored separately and processed in the India region.
              </p>
              {data.runs.length > 0 && (
                <p className="num mt-2 text-[11px] text-muted-foreground">
                  {data.runs.length} agent runs · ₹
                  {data.runs.reduce((s2, r) => s2 + Number(r.cost_inr), 0).toFixed(2)} spent on this case
                </p>
              )}
            </section>
          </div>
        </div>
      </main>
    </Shell>
  );
}
