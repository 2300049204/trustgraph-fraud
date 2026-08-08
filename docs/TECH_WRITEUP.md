# Trust Graph — Tech Write-up

## 1. Problem framing

Marketplace fraud is rarely one bad actor. Refund abuse, fake delivery scans and rating inflation
are usually executed by **small colluding groups** spanning buyer, seller and delivery-partner
roles. Per-order scoring misses them because each individual order looks ordinary. Trust Graph is
network-first: it scores the relationship graph, then explains and remediates at the actor level.

## 2. Architecture

```text
                       ┌──────────────────────────────────────────────┐
  Browser (React 19)   │  /            landing                        │
                       │  /console     queue + case workspace         │
                       │  /appeals/:id accused-party portal           │
                       │  /metrics     ops dashboard                  │
                       └───────────────┬──────────────────────────────┘
                                       │ typed RPC (createServerFn)
                       ┌───────────────▼──────────────────────────────┐
                       │  Edge server (TanStack Start)                │
                       │                                              │
                       │  trustgraph.functions.ts   API boundary      │
                       │  pipeline.server.ts        agent orchestration│
                       │  engine.ts                 deterministic core │
                       │  data.server.ts            cached data loader │
                       │  adapters.server.ts        external signals   │
                       └───┬───────────────────────────┬──────────────┘
                           │                           │
             ┌─────────────▼──────────┐   ┌────────────▼──────────────┐
             │ Postgres (RLS)         │   │ Lovable AI Gateway        │
             │ actors / actor_pii     │   │ Explainer · Planner ·     │
             │ orders / fingerprints  │   │ Reviewer  (on demand)     │
             │ delivery_events        │   └───────────────────────────┘
             │ claims / ratings       │
             │ cases / case_evidence  │
             │ case_actions / appeals │
             │ rule_precision         │
             │ agent_runs (cost log)  │
             └────────────────────────┘
```

## 3. Risk engine (deterministic, zero marginal cost)

`src/lib/engine.ts` is pure TypeScript — no network, no LLM, no PII.

**Tier 1 — Triage Scorer.** Per-actor features and their weights:

| Signal | Feature | Max points |
| --- | --- | --- |
| Refund / claim abuse | claims ÷ orders | 24 |
| Proof-of-delivery failures | failed POD ÷ scanned deliveries | 20 |
| Off-hours pattern | share of activity 00:00–05:00 | 14 |
| New-actor velocity spike | orders ÷ tenure days | 16 |
| Counterparty concentration | top counterparty share | 14 |
| High ticket on young account | avg order value, tenure < 120d | 12 |

**Tier 2 — Graph Analyst.** Orders carry device / IP / address-cluster fingerprints. Actors sharing
a fingerprint are unioned (Union-Find). Hubs with >12 actors are discarded as shared
infrastructure, not collusion. A component becomes a **ring** only when it has ≥3 actors, ≥2
distinct roles and ≥6 internal orders. Ring score combines cluster size, reciprocal buyer→seller
loops (3+ repeats), 5-star share above the 62% baseline, POD failures, and identifier count.

**Blending.** Ring members: `0.4 × txn + 0.6 × graph + 8`. Non-members: `0.85 × txn + 0.15 × graph`.
Bands: ≥80 critical, ≥62 high, ≥42 medium. `/metrics` reports the lift from the graph tier by
recomputing precision/recall on the held-out labelled slice with and without it.

## 4. AI workflow — five cooperating agents

The LLM never scores. It explains, proposes and checks. Everything numeric is deterministic and
reproducible.

| Agent | Tier | Trigger | Job | Cost |
| --- | --- | --- | --- | --- |
| Triage Scorer | code | every actor | feature rules → txn score | ~0 |
| Graph Analyst | code | every batch | ring detection → graph score | ~0 |
| Explainer | LLM | investigator opens case / appeal generated | turn signals into a plain-language narrative that a non-technical accused party can understand | 1 call |
| Planner | LLM | investigator requests | propose a graduated action + duration, constrained to the allowed action ladder | 1 call |
| Reviewer | LLM | only for income-affecting actions | second opinion: is the evidence sufficient, is a softer action adequate, what would the accused say | 1 call |

Guardrails:

- Structured output via the AI SDK `Output` API with small, unconstrained schemas; malformed output
  degrades to a deterministic template rather than crashing.
- The Planner can only emit actions from a fixed ladder (`monitor`, `step_up_verify`, `payout_hold`,
  `payout_freeze`, `suspend`); anything else is rejected server-side.
- **Precision gate**: a hard action is blocked in the UI when `rule_precision` for the triggering
  rule is under 95%.
- Every LLM call is logged to `agent_runs` with tokens and latency, so cost-per-decision on
  `/metrics` is measured, not estimated.
- No PII enters a prompt. `actor_pii` is a separate RLS-protected table and is never joined into the
  agent context.

## 5. Data model & privacy

- RLS on every table; PII isolated in `actor_pii`, readable only by authenticated investigators.
- `case_evidence` is **append-only** — the investigation record cannot be rewritten after the fact.
- `case_actions` records who acted, when, on what evidence, and with which agent recommendation.
- Appeals are readable by case ID without an investigator account, so a restricted actor can see
  exactly why they were restricted.

## 6. Stack

TanStack Start v1 (React 19, Router, Query), Vite 7, Tailwind v4 + shadcn/ui, TypeScript strict,
Postgres with RLS, Vercel AI SDK over the Lovable AI Gateway, custom SVG graph rendering (no chart
library dependency for the collusion canvas), Recharts for the ops dashboard.

## 7. Known limits

- Demo dataset is synthetic with planted rings; real deployment needs a labelled backfill to
  calibrate thresholds and `rule_precision`.
- Ring detection is transductive — it re-runs over a batch rather than streaming incrementally.
- Adapters for external signals (IP reputation, GSTIN status) are deterministic stubs.
