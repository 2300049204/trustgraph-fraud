import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Shell, SlaClock } from "@/components/trust-ui";
import { ACTION_META, type ActionKey } from "@/lib/engine";
import { fetchAppealView, fileAppeal } from "@/lib/trustgraph.functions";

export const Route = createFileRoute("/appeals/$caseId")({
  head: () => ({
    meta: [
      { title: "Appeal a restriction — Trust Graph" },
      {
        name: "description",
        content:
          "See in plain language why a restriction was applied to your account, what it limits, when it expires, and submit an appeal for human review.",
      },
      { property: "og:title", content: "Appeal a restriction — Trust Graph" },
      { property: "og:description", content: "Plain-language explanation and a human-reviewed appeal path." },
    ],
  }),
  component: AppealPortal,
});

function AppealPortal() {
  const { caseId } = Route.useParams();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["appeal", caseId],
    queryFn: () => fetchAppealView({ data: { caseId } }),
  });
  const [statement, setStatement] = useState("");
  const [evidence, setEvidence] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (statement.trim().length < 20) {
      toast.error("Please describe what happened in at least 20 characters.");
      return;
    }
    setBusy(true);
    try {
      await fileAppeal({
        data: {
          caseId,
          statement: statement.trim(),
          evidenceNote: evidence.trim() || undefined,
          contactEmail: email.trim() || undefined,
        },
      });
      toast.success("Appeal submitted. A human reviewer will decide within the stated SLA.");
      setStatement("");
      setEvidence("");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit the appeal");
    } finally {
      setBusy(false);
    }
  };

  if (isPending)
    return (
      <Shell>
        <main className="mx-auto max-w-3xl px-5 py-12 text-sm text-muted-foreground">Loading your case…</main>
      </Shell>
    );
  if (error || !data)
    return (
      <Shell>
        <main className="mx-auto max-w-3xl px-5 py-12 text-sm text-destructive">
          We could not find this case reference. Check the link in your notification.
        </main>
      </Shell>
    );

  const latest = data.actions[0];
  const pending = data.appeals.find((a) => a.status !== "decided");
  const decided = data.appeals.find((a) => a.status === "decided");

  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <span className="label-caps">Account review notice</span>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {data.actor?.display_name ?? "Your account"} — what happened and what you can do
        </h1>

        <section className="panel mt-6 p-5">
          <h2 className="text-sm font-semibold">Why your account was reviewed</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {data.caseRow.appealNarrative ??
              "Our systems flagged unusual activity linked to your account. An investigator has not yet published the plain-language summary for this case — you can still appeal below and a human will review it."}
          </p>
        </section>

        <section className="panel mt-4 p-5">
          <h2 className="text-sm font-semibold">Current restriction</h2>
          {latest ? (
            <div className="mt-2 space-y-1.5 text-sm">
              <p>
                <span className="font-medium">
                  {ACTION_META[latest.action_type as ActionKey]?.label ?? latest.action_type.replace(/_/g, " ")}
                </span>{" "}
                <span className="text-muted-foreground">
                  applied {new Date(latest.created_at).toLocaleString("en-IN")}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {latest.expires_at
                  ? `This is time-bound and lifts automatically on ${new Date(latest.expires_at).toLocaleString("en-IN")} unless a human extends it.`
                  : "This is a monitoring-only measure. It does not restrict payouts or your ability to sell."}
              </p>
              <p className="text-sm text-muted-foreground">
                Decision deadline for any appeal:{" "}
                {latest.sla_deadline ? <SlaClock deadline={latest.sla_deadline} /> : "72 hours from your submission"}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No restriction is currently applied. This case is under review only.
            </p>
          )}
        </section>

        {decided ? (
          <section className="panel mt-4 p-5">
            <h2 className="text-sm font-semibold">Appeal outcome</h2>
            <p className="mt-2 text-sm">
              Your appeal was{" "}
              <span className={decided.outcome === "overturned" ? "font-semibold text-risk-low" : "font-semibold text-risk-high"}>
                {decided.outcome}
              </span>{" "}
              by a human reviewer on {new Date(decided.decided_at ?? decided.created_at).toLocaleString("en-IN")}.
            </p>
          </section>
        ) : pending ? (
          <section className="panel mt-4 p-5">
            <h2 className="text-sm font-semibold">Your appeal is with a human reviewer</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Submitted {new Date(pending.created_at).toLocaleString("en-IN")}. Decision due{" "}
              {pending.sla_deadline ? <SlaClock deadline={pending.sla_deadline} /> : "shortly"}.
            </p>
            <p className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-surface-strong p-3 text-sm">
              {pending.statement}
            </p>
          </section>
        ) : (
          <section className="panel mt-4 p-5">
            <h2 className="text-sm font-semibold">Appeal this decision</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              A person reads every appeal. Automated systems cannot reject it. Explain the activity we flagged — for
              example a shared office network, a family device, or a bulk buyer you genuinely trade with.
            </p>
            <form onSubmit={submit} className="mt-4 space-y-3">
              <div>
                <label className="label-caps" htmlFor="statement">
                  What happened
                </label>
                <textarea
                  id="statement"
                  required
                  rows={5}
                  maxLength={4000}
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Describe the orders, accounts or devices we flagged and why they are legitimate."
                />
                <p className="num mt-0.5 text-[11px] text-muted-foreground">{statement.length}/4000</p>
              </div>
              <div>
                <label className="label-caps" htmlFor="evidence">
                  Supporting evidence (optional)
                </label>
                <textarea
                  id="evidence"
                  rows={3}
                  maxLength={2000}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Invoice numbers, GSTIN, courier reference numbers, or anything a reviewer can verify."
                />
              </div>
              <div>
                <label className="label-caps" htmlFor="email">
                  Contact email (optional)
                </label>
                <input
                  id="email"
                  type="email"
                  maxLength={255}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Submitting…" : "Submit appeal for human review"}
              </button>
            </form>
          </section>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          Your personal data is stored separately from case analytics and processed in the India region. We do not
          share the identities of other accounts in the review with you, and we do not share yours with them.
        </p>
      </main>
    </Shell>
  );
}
