import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { RiskPill, Shell, StateBlock } from "@/components/trust-ui";
import { fetchRings } from "@/lib/trustgraph.functions";

export const Route = createFileRoute("/graph")({
  head: () => ({
    meta: [
      { title: "Graph explorer — Trust Graph" },
      { name: "description", content: "Browse every detected collusion ring, its shared identifiers and member actors." },
      { property: "og:title", content: "Graph explorer — Trust Graph" },
      { property: "og:description", content: "Collusion rings detected from shared devices, IPs and addresses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GraphPage,
});

function GraphPage() {
  const { data, isPending, error } = useQuery({ queryKey: ["rings"], queryFn: () => fetchRings(), staleTime: 60_000 });

  return (
    <Shell>
      <main className="mx-auto max-w-[1400px] px-5 py-8">
        <span className="label-caps">Graph intelligence</span>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Collusion ring explorer</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Rings are clustered from shared devices, IP addresses and delivery addresses, then weighted by reciprocal
          order loops, five-star rating density and proof-of-delivery failures.
        </p>

        {error ? (
          <div className="mt-6">
            <StateBlock kind="error" title="Graph service unavailable" message={String(error)} />
          </div>
        ) : isPending ? (
          <div className="mt-6">
            <StateBlock kind="loading" title="Loading" />
          </div>
        ) : data.length === 0 ? (
          <div className="mt-6">
            <StateBlock kind="empty" title="No rings detected" message="No shared-identifier clusters cross the density threshold." />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {data.map((r) => (
              <section key={r.id} className="panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">{r.id}</h2>
                    <p className="text-xs text-muted-foreground">
                      {r.memberCount} actors · {r.relationships} shared-identifier links · {r.reciprocalLoops} reciprocal loops
                    </p>
                  </div>
                  <RiskPill score={r.riskScore} />
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Five-star share", `${(r.fiveStarShare * 100).toFixed(0)}%`],
                    ["POD failures", String(r.podFailures)],
                    ["Attributes", String(r.attributes.length)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded border border-border bg-surface px-2 py-1.5">
                      <dd className="num text-sm font-semibold">{v}</dd>
                      <dt className="label-caps">{k}</dt>
                    </div>
                  ))}
                </dl>

                <ul className="mt-3 space-y-1 text-xs">
                  {r.members.slice(0, 8).map((m) => (
                    <li key={m.actorId} className="flex items-center justify-between gap-2">
                      <span>
                        <span className="font-medium">{m.displayName}</span>{" "}
                        <span className="text-muted-foreground">{m.role.replace("_", " ")}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <RiskPill score={m.riskScore} showLabel={false} />
                        {m.caseId ? (
                          <Link
                            to="/console/$caseId"
                            params={{ caseId: m.caseId }}
                            className="rounded border border-border px-2 py-0.5 hover:bg-muted"
                          >
                            Open
                          </Link>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </Shell>
  );
}
