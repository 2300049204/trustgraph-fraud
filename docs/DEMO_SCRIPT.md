# Trust Graph — 8-Minute Demo Script

Live app: https://trusted-circles-guard.lovable.app

## 0:00–1:00 — The problem

"Marketplaces lose 1–3% of GMV to fraud, and the hardest part is coordinated groups: a buyer, a
seller and a delivery partner colluding. Every order they place looks normal on its own — the
pattern only exists in the network. And when platforms do act, they ban accounts with a generic
policy email, so honest sellers and gig workers lose income with no explanation and no appeal."

## 1:00–1:45 — The solution (landing page, `/`)

Show `/`. Three ideas: score the **network** not the order; explain evidence in **plain language**;
remediate on a **graduated ladder** with a real appeal path. Point out the five-agent pipeline
diagram — two deterministic tiers, three LLM agents that run only when a human is involved.

## 1:45–3:30 — Investigator console (`/console`)

- Show the queue sorted by blended risk, SLA clocks running.
- Toggle **ring members only** — these are cases per-order scoring would not have surfaced.
- Compare the **blended score vs transaction-only score** column: that gap is the graph tier's
  contribution.
- Open the top critical case.

## 3:30–5:30 — Case workspace (`/console/:caseId`)

- **Risk breakdown**: each signal, its point contribution and the underlying counts.
- **Collusion graph**: actors on the outer ring, shared device/IP/address in the centre; dashed red
  edges are shared identifiers, solid edges are order flow. Call out the reciprocal loop.
- Run the **Explainer** live — plain-language narrative appended to the evidence log.
- Run the **Planner** — it proposes a graduated action, not a ban by default.
- Because the action is income-affecting, run the **Reviewer** — second opinion on whether the
  evidence supports it and whether a softer action would do.
- Show the **precision gate** blocking a hard action when the triggering rule's measured precision
  is below 95%.
- Confirm the action; point at the **append-only evidence log** — the record can't be rewritten.

## 5:30–6:30 — Accused-party portal (`/appeals/:caseId`)

Open the appeal link the action generated. Same evidence, written for a non-technical person: what
was restricted, why, for how long, and a form to submit a statement and documents that routes to
human review with its own SLA. "This is the part most fraud systems don't have."

## 6:30–7:30 — Metrics & AI architecture (`/metrics`)

- Fraud loss avoided, precision/recall on the **held-out labelled slice**.
- **Graph signal lift**: same threshold, with and without the graph tier.
- **Cohort fairness parity** across city / size tier / tenure.
- **Cost per decision**, recomputed from the `agent_runs` log — measured, not estimated. Detection
  is deterministic code, so LLM spend is only paid on cases a human opens: fractions of a paisa per
  transaction.

## 7:30–8:00 — Impact & roadmap

"Catches rings per-order scoring misses, reduces hard bans on honest accounts, cuts investigator
handling time, and gives the platform an auditable record. Next: streaming ring updates, real
external KYC/IP adapters, appeal outcomes feeding back into rule precision, and shipping the graph
tier as an API so existing risk stacks can adopt it without a rewrite."

## Recording tips

- Have `/console` pre-loaded and one critical case identified before recording.
- Agent calls take a few seconds — keep narrating the risk breakdown while they run.
- Widen the browser to at least 1440px so the collusion graph and queue columns don't wrap.
