import { createFileRoute } from "@tanstack/react-router";

import { CaseQueue } from "@/components/CaseQueue";
import { Shell } from "@/components/trust-ui";

export const Route = createFileRoute("/cases/")({
  head: () => ({
    meta: [
      { title: "Case queue — Trust Graph" },
      { name: "description", content: "Risk-ranked fraud cases with collusion ring context, SLA clocks and filters." },
      { property: "og:title", content: "Case queue — Trust Graph" },
      { property: "og:description", content: "Filter fraud cases by risk band, actor type, fraud type and graph involvement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <Shell>
      <CaseQueue />
    </Shell>
  ),
});
