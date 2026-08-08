import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { RiskPill, SeverityBadge, Shell, SlaClock, StateBlock } from "@/components/trust-ui";
import { fetchAppeals } from "@/lib/trustgraph.functions";

export const Route = createFileRoute("/appeals/")({
  head: () => ({
    meta: [
      { title: "Appeals workbench — Trust Graph" },
      { name: "description", content: "Every filed appeal with its original action, risk score and 72-hour SLA clock." },
      { property: "og:title", content: "Appeals workbench — Trust Graph" },
      { property: "og:description", content: "Human review queue for contested remediation decisions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppealsPage,
});

function AppealsPage() {
  const { data, isPending, error } = useQuery({ queryKey: ["appeals"], queryFn: () => fetchAppeals(), staleTime: 30_000 });

  return (
    <Shell>
      <main className="mx-auto max-w-[1400px] px-5 py-8">
        <span className="label-caps">Human review</span>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Appeals workbench</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Accused parties get a plain-language explanation and a right of reply. Every decision is appended to the
          case audit trail and feeds rule precision.
        </p>

        {error ? (
          <div className="mt-6">
            <StateBlock kind="error" title="Appeals service unavailable" message={String(error)} />
          </div>
        ) : isPending ? (
          <div className="mt-6">
            <StateBlock kind="loading" title="Loading" />
          </div>
        ) : data.length === 0 ? (
          <div className="mt-6">
            <StateBlock kind="empty" title="No appeals filed yet" message="Appeals appear here as soon as an accused party responds." />
          </div>
        ) : (
          <div className="panel mt-6 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b border-border bg-surface-strong">
                <tr className="text-left">
                  {["Actor", "Risk", "Original action", "Statement", "Status", "Outcome", "SLA", ""].map((h) => (
                    <th key={h} className="label-caps px-3 py-2.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id} className="border-b border-border/70 align-top hover:bg-muted/50">
                    <td className="px-3 py-3">
                      <div className="font-medium">{a.actorName}</div>
                      <div className="text-[11px] text-muted-foreground">{a.actorRole?.replace("_", " ")}</div>
                    </td>
                    <td className="px-3 py-3">{a.riskScore === null ? "—" : <RiskPill score={a.riskScore} />}</td>
                    <td className="px-3 py-3 text-xs">
                      {a.originalAction ? (
                        <span className="flex flex-col gap-1">
                          <span className="font-medium">{a.originalAction.replace(/_/g, " ")}</span>
                          {a.originalSeverity ? <SeverityBadge severity={a.originalSeverity} /> : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">none recorded</span>
                      )}
                    </td>
                    <td className="max-w-96 px-3 py-3 text-xs text-muted-foreground">{a.statement}</td>
                    <td className="px-3 py-3 text-xs">{a.status}</td>
                    <td className="px-3 py-3 text-xs">{a.outcome ?? "pending"}</td>
                    <td className="px-3 py-3">
                      <SlaClock deadline={a.sla_deadline} />
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        to="/console/$caseId"
                        params={{ caseId: a.case_id }}
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                      >
                        Review case
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </Shell>
  );
}
