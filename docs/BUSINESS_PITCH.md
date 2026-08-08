# Trust Graph — Business Pitch

## Problem

Marketplaces lose 1–3% of GMV to fraud, and the expensive part isn't the single bad seller — it's
**coordinated groups**. A buyer, a seller and a delivery partner working together can manufacture
refunds, fake delivery scans and inflate ratings indefinitely, because every individual order looks
normal to a per-transaction model.

The current response makes it worse in two directions:

1. **Under-detection** — rules tuned per order never see the ring.
2. **Over-punishment** — when something does trip, the platform suspends an account with a generic
   "policy violation" email. Honest sellers and gig partners lose their income with no explanation
   and no real appeal. That drives churn, support cost, press risk and, increasingly, regulatory
   attention.

## Solution

Trust Graph is a network-first fraud detection and remediation layer:

- **Detect the ring, not the order.** Shared device/IP/address fingerprints plus reciprocal order
  loops and rating inflation surface multi-actor collusion clusters.
- **Explain in plain language.** Every case carries a narrative an ops analyst *and* the accused
  party can read — which signals fired, how much each contributed, what the evidence is.
- **Remediate proportionally.** A graduated ladder — monitor → step-up verification → payout hold →
  payout freeze → suspension — instead of a binary ban. Income-affecting actions require a second
  agent review, and hard actions are blocked when the triggering rule's measured precision is
  under 95%.
- **Give a real appeal path.** Every restricted actor gets a portal showing the same evidence and a
  form that routes to a human, with an SLA clock the ops team is measured on.

## Value

| Lever | Impact |
| --- | --- |
| Fraud loss avoided | Graph tier catches rings that per-order scoring misses — the lift is measured on a held-out labelled slice on `/metrics` |
| False-positive cost | Precision gate + graduated actions mean fewer honest accounts hard-banned; softer first actions are reversible |
| Investigator throughput | Pre-written narratives and proposed actions cut case handling from a manual data pull to a review-and-confirm |
| Support & appeal cost | Self-serve explanation portal deflects "why was I banned" tickets |
| Audit & regulatory posture | Append-only evidence log, recorded human decision, documented appeal route |

## Rough cost-per-transaction

The two detection tiers are deterministic code, so scoring is effectively free; LLM cost is paid
only on cases a human actually opens.

| Component | Cost |
| --- | --- |
| Triage Scorer + Graph Analyst (per order scored) | ~₹0 — pure compute, batched |
| Explainer + Planner (per opened case) | ~2 LLM calls |
| Reviewer (income-affecting cases only) | ~1 additional LLM call |

With roughly 1 case opened per 1,000 orders, LLM spend amortises to a **fraction of a paisa per
transaction** — the dominant cost stays infrastructure, not inference. `/metrics` recomputes
cost-per-decision from the actual `agent_runs` log rather than an estimate, so the number stays
honest as volume grows.

## What's next

1. **Streaming ingestion** — incremental ring updates instead of batch recomputation.
2. **Real external adapters** — IP reputation, GSTIN/KYC status, device attestation replacing the
   current deterministic stubs.
3. **Feedback loop** — appeal outcomes and investigator overrides write back into `rule_precision`,
   so the precision gate self-calibrates.
4. **Cohort fairness monitoring in production** — alert when action rates diverge across city, size
   tier or tenure cohorts.
5. **Cross-marketplace ring signals** — federated fingerprint matching without sharing PII.
6. **Ship as an API** — `POST /score` + webhook actions so an existing risk stack can adopt the
   graph tier without replacing its own rules.
