# Trust Navigator

Trust Graph — Multi-Actor Fraud Detection & Remediation

A working MVP for Track 5: score orders for risk, surface collusion rings a per-transaction model can't see, explain the evidence in plain language, and drive graduated remediation with a human-reviewable appeal path.

What gets built

1. Landing / pitch page (/)

Problem, solution, the four success metrics, cost-per-decision, and a "Enter console" CTA. This is also the presentation surface for the demo.

2. Investigator console (/console)

Case queue: actor (customer / seller / delivery partner), risk score, top signals, recommended action, SLA clock.

Case detail: risk breakdown (per-transaction score vs graph score), plain-language evidence narrative, immutable evidence timeline, and the action panel.

Action panel enforces the precision guardrail: hard actions (suspension, payout freeze) are only offered when the model's measured precision for that rule ≥95%; otherwise the UI routes to human review and says why.

Collusion graph view: interactive node/edge canvas showing seller ↔ buyer ↔ device/IP ↔ address ↔ delivery-partner clusters, with ring detection highlighted and shared-attribute edges labelled.

3. Accused party portal (/appeals/:caseId)

What action was taken, when it expires, the evidence written for a non-technical reader, an appeal form with document/statement submission, SLA countdown, and appeal status.

4. Ops metrics dashboard (/metrics)

Fraud loss avoided, precision/recall vs held-out labels, single-model vs +graph lift, median time-to-resolution, action-rate parity by seller size/tenure and partner cohort (the fairness report), appeal overturn rate, and cost-per-decision by model tier.

AI architecture (cooperating agents, not one mega-prompt)

Five specialized steps, each on the cheapest model that can do the job:

Agent

Job

Tier

Triage scorer

Deterministic feature rules + weighted score over transaction/device/velocity features. No LLM.

~₹0

Graph analyst

Ring detection over the actor graph: shared device/IP/address components, reciprocal order loops, rating self-inflation, delivery-scan anomalies. Classical algorithms, no LLM.

~₹0

Evidence explainer

Turns the numeric + graph evidence into plain-language narrative for investigator and accused party.

cheap LLM

Remediation planner

Chooses graduated action (step-up verify → payout hold → suspend), sets time bound and SLA, checks the precision gate.

cheap LLM

Self-check reviewer

Reviews the proposed action against business goals and fairness/livelihood guardrails; can downgrade a hard action to human review. Only runs on high-stakes cases.

reasoning LLM

Every run records which tier ran and an estimated cost, so the dashboard can report real cost-per-decision and show that the classical scorer + graph solver handle the vast majority of decisions without an LLM call.

Data

Lovable Cloud (Postgres) with realistic seeded data inserted in the migration: actors across all three roles, orders and payments, listings/ratings/payouts, delivery scan + GPS + POD events, return/refund claims, device/IP fingerprints and address clusters, historical confirmed-fraud labels, and past appeal outcomes. Seed includes three planted collusion rings and a set of honest-but-suspicious actors so false-positive handling is demonstrable, plus a held-out labeled slice so the dashboard metrics are computed, not hardcoded.

External signals

An adapter layer (IdentityIntelligence, Notifications) with deterministic stubs for AbuseIPDB, GSTIN verification, disposable-email checking, and email/SMS notification. Real keys can be dropped in later with no call-site changes; the console shows which signals are live vs simulated.

Guardrails, implemented not just claimed

Precision gate: hard actions blocked below 95% measured precision; blocked cases visibly route to a human.

Livelihood: every income-affecting action carries an expiry, an appeal link, and an SLA deadline; overdue reviews escalate in the queue.

Auditability: append-only evidence log per case (no updates/deletes), written in reviewer-readable language.

Data residency: PII isolated to dedicated columns/tables with a documented India-region processing boundary and a residency note in the write-up.

Fairness: action-rate parity computed per cohort and shown on the dashboard.

Design

Light institutional: white/slate surfaces, teal #0F766E primary with blue #1D4ED8 accent, calm audit-friendly typography, dense but readable tables, risk expressed via a semantic severity scale. All colors as design tokens in src/styles.css.

Technical notes

TanStack Start routes; scoring, graph analysis, and agent calls run in server functions (src/lib/*.functions.ts) so no model keys or PII logic reach the browser.

Lovable Cloud for Postgres + auth; RLS scoping investigators vs accused parties, with grants on every new table.

Lovable AI Gateway for the two LLM steps; graph and scoring logic is pure TypeScript so it stays free and fast.

Graph rendering as a custom SVG/canvas component — no heavy graph library.

Each route gets its own head() metadata.

Build order

Cloud + schema + seeded demo data (including collusion rings and held-out labels)

Scoring engine + graph ring detection + metrics computation

Investigator console and graph view

Remediation actions, precision gate, appeal portal, notifications

Metrics/fairness dashboard, landing page, cost reporting

Not in this build

Real dataset ingestion (IEEE-CIS / Elliptic CSV upload and scoring), live API keys, and a trained ML model — the scoring engine is a transparent feature-weighted model over the seeded labels. All three are natural follow-ups and I'll note them as roadmap in the pitch page.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://trusted-circles-guard.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/21d567aa-347f-4f0e-a626-c99305ee7234).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
