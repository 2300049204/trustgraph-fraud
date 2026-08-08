# Trust Graph — Multi-Actor Fraud Detection & Remediation

Trust Graph scores marketplace orders and actors for fraud risk, surfaces **collusion rings**
across buyers, sellers and delivery partners, explains the evidence in plain language, and drives
**graduated remediation** with a human-reviewable appeal path.

Live demo: https://trusted-circles-guard.lovable.app

| Surface | Route | Who uses it |
| --- | --- | --- |
| Landing / overview | `/` | Anyone |
| Investigator console (queue) | `/console` | Fraud/Trust ops |
| Case workspace | `/console/:caseId` | Fraud/Trust ops |
| Accused-party portal | `/appeals/:caseId` | Restricted seller/partner/customer |
| Ops metrics dashboard | `/metrics` | Risk leadership |

## Docs

- [Tech write-up](docs/TECH_WRITEUP.md) — architecture diagram, AI workflow, stack
- [Business pitch](docs/BUSINESS_PITCH.md) — problem, solution, value, cost-per-transaction, roadmap
- [Demo script](docs/DEMO_SCRIPT.md) — 8-minute walkthrough

## Stack

- **Frontend/SSR**: TanStack Start v1 (React 19, TanStack Router + Query), Vite 7, Tailwind v4, shadcn/ui
- **Backend**: TanStack `createServerFn` typed RPC running on an edge worker
- **Data**: Postgres (Lovable Cloud / Supabase) with RLS, PII isolated in a separate table
- **AI**: Lovable AI Gateway via the Vercel AI SDK (`@ai-sdk/openai-compatible`)
- **Risk core**: pure TypeScript, no LLM — `src/lib/engine.ts`

## Local setup

Requires Node 20+ (or Bun) and a Postgres/Supabase project.

```bash
git clone <your-repo-url>
cd trust-graph
npm install          # or: bun install
cp .env.example .env # fill in the values below
npm run dev          # http://localhost:8080
```

`.env` values:

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
VITE_SUPABASE_PROJECT_ID=<project ref>

# server-only
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable key>
LOVABLE_API_KEY=<AI gateway key>   # optional: agent narratives degrade gracefully without it
```

Database: apply the SQL migrations in `supabase/migrations/` (e.g. `supabase db push`, or paste them
into the SQL editor in order). They create the schema **and** seed the demo dataset — 127 actors,
1,600+ orders, delivery events, claims, ratings, three planted collusion rings and a held-out
labelled slice used by `/metrics`.

Build:

```bash
npm run build     # production build
npm run lint
```

## How it works (short version)

1. `engine.ts` computes a **transaction score** (refund abuse, POD failures, off-hours activity,
   velocity, counterparty concentration) and a **graph score** (Union-Find clustering over shared
   device/IP/address fingerprints, reciprocal order loops, rating self-inflation).
2. Cases above threshold are materialised into the investigator queue with an SLA clock.
3. LLM agents run **on demand only**: Explainer (plain-language narrative), Planner (proposed
   action), Reviewer (second-opinion check on income-affecting actions).
4. Actions are graduated — monitor → step-up verification → payout hold → freeze → suspension —
   and hard actions are blocked by a **precision gate** when the triggering rule's measured
   precision is below 95%.
5. Every restricted actor gets an appeal URL with the same evidence in plain language and a form
   that routes to human review.
