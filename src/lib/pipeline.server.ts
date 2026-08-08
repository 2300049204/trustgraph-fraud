import { generateText, streamText } from "ai";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { IdentityIntelligence, Notifications } from "@/lib/adapters.server";
import { loadRawData } from "@/lib/data.server";
import {
  ACTION_META,
  buildGraph,
  confusion,
  runEngine,
  type ActionKey,
  type ScoredActor,
} from "@/lib/engine";

export const TIER_COST_INR = {
  deterministic: 0,
  cheap_llm: 0.42,
  reasoning_llm: 2.6,
} as const;

export const MODELS = {
  cheap: "google/gemini-3.1-flash-lite",
  reasoning: "google/gemini-3.5-flash",
} as const;

const RISK_THRESHOLD = 60;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export interface QueueItem {
  caseId: string;
  actorId: string;
  displayName: string;
  role: string;
  sizeTier: string | null;
  tenureDays: number;
  city: string | null;
  txnScore: number;
  graphScore: number;
  riskScore: number;
  topSignals: { key: string; label: string; contribution: number; detail: string }[];
  recommendedAction: ActionKey;
  primaryRule: string;
  ringId: string | null;
  ringMembers: string[];
  slaDeadline: string;
  status: string;
  features: Record<string, number>;
}

/** Runs the two zero-cost agents and materialises a case row per flagged actor. */
export async function ensureCases(): Promise<{ items: QueueItem[]; scored: ScoredActor[] }> {
  const data = await loadRawData();
  const engine = runEngine(data);
  const flagged = engine.scored.filter((s) => s.riskScore >= 35);
  const sb = await admin();

  const { data: existing } = await sb.from("cases").select("id,actor_id,status,sla_deadline");
  const byActor = new Map((existing ?? []).map((c) => [c.actor_id, c]));

  const missing = flagged.filter((s) => !byActor.has(s.actorId));
  if (missing.length) {
    const rows = missing.map((s, i) => ({
      actor_id: s.actorId,
      txn_score: s.txnScore,
      graph_score: s.graphScore,
      risk_score: s.riskScore,
      signals: s.signals as never,
      ring_id: s.ringId,
      ring_members: s.ringMembers,
      recommended_action: s.recommendedAction,
      // stagger SLAs so the queue shows realistic urgency, some already overdue
      sla_deadline: new Date(Date.now() + (((i * 7) % 96) - 12) * 3600_000).toISOString(),
    }));
    await sb.from("cases").insert(rows);
    const { data: inserted } = await sb.from("cases").select("id,actor_id,status,sla_deadline");
    (inserted ?? []).forEach((c) => byActor.set(c.actor_id, c));

    const evidence = missing.flatMap((s) => {
      const c = byActor.get(s.actorId);
      if (!c) return [];
      return [
        {
          case_id: c.id,
          source: "triage_scorer",
          summary: `Deterministic triage score ${s.txnScore}/100 from ${s.signals.length} feature rules.`,
          detail: { features: s.features } as never,
        },
        ...(s.ringId
          ? [
              {
                case_id: c.id,
                source: "graph_analyst",
                summary: `Cluster ${s.ringId} detected: ${s.ringMembers.length} linked actors, graph score ${s.graphScore}/100.`,
                detail: { members: s.ringMembers } as never,
              },
            ]
          : []),
      ];
    });
    if (evidence.length) await sb.from("case_evidence").insert(evidence);
    await sb.from("agent_runs").insert(
      missing.flatMap((s) => {
        const c = byActor.get(s.actorId);
        if (!c) return [];
        return [
          { case_id: c.id, agent: "triage_scorer", tier: "deterministic", cost_inr: 0 },
          { case_id: c.id, agent: "graph_analyst", tier: "deterministic", cost_inr: 0 },
        ];
      }),
    );
  }

  const items: QueueItem[] = flagged.flatMap((s) => {
    const c = byActor.get(s.actorId);
    if (!c) return [];
    return [
      {
        caseId: c.id,
        actorId: s.actorId,
        displayName: s.displayName,
        role: s.role,
        sizeTier: s.sizeTier,
        tenureDays: s.tenureDays,
        city: s.city,
        txnScore: s.txnScore,
        graphScore: s.graphScore,
        riskScore: s.riskScore,
        topSignals: s.signals.slice(0, 3),
        recommendedAction: s.recommendedAction,
        primaryRule: s.primaryRule,
        ringId: s.ringId,
        ringMembers: s.ringMembers,
        slaDeadline: c.sla_deadline,
        status: c.status,
        features: s.features,
      },
    ];
  });

  items.sort((a, b) => b.riskScore - a.riskScore);
  return { items, scored: engine.scored };
}

export async function getQueue() {
  const [{ items }, sb] = await Promise.all([ensureCases(), admin()]);
  const [{ data: precision }, { data: actions }, { data: appeals }] = await Promise.all([
    sb.from("rule_precision").select("*"),
    sb.from("case_actions").select("case_id,action_type,severity,gate_passed,created_at,expires_at"),
    sb.from("appeals").select("case_id,status,outcome"),
  ]);
  return { items, precision: precision ?? [], actions: actions ?? [], appeals: appeals ?? [] };
}

export async function getCaseDetail(caseId: string) {
  const sb = await admin();
  const { data: row, error } = await sb.from("cases").select("*").eq("id", caseId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Case not found");

  const data = await loadRawData();
  const engine = runEngine(data);
  const scored = engine.byActor.get(row.actor_id);
  const graph = buildGraph(data, engine, row.actor_id);

  const [{ data: evidence }, { data: actions }, { data: appeals }, { data: precision }, { data: runs }] =
    await Promise.all([
      sb.from("case_evidence").select("*").eq("case_id", caseId).order("created_at", { ascending: true }),
      sb.from("case_actions").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
      sb.from("appeals").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
      sb.from("rule_precision").select("*"),
      sb.from("agent_runs").select("*").eq("case_id", caseId).order("created_at", { ascending: true }),
    ]);

  const pii = await sb.from("actor_pii").select("*").eq("actor_id", row.actor_id).maybeSingle();
  const fp = data.fingerprints.find((f) =>
    data.orders.some(
      (o) =>
        o.id === f.order_id &&
        (o.buyer_id === row.actor_id || o.seller_id === row.actor_id || o.partner_id === row.actor_id),
    ),
  );
  const external = await Promise.all([
    IdentityIntelligence.ipReputation(fp?.ip_address ?? "0.0.0.0"),
    IdentityIntelligence.verifyGstin(pii.data?.gstin ?? null),
    IdentityIntelligence.disposableEmail(pii.data?.email ?? null),
  ]);

  return {
    case: row,
    scored: scored ?? null,
    graph,
    evidence: evidence ?? [],
    actions: actions ?? [],
    appeals: appeals ?? [],
    precision: precision ?? [],
    runs: runs ?? [],
    external,
  };
}

export async function getAppealView(caseId: string) {
  const sb = await admin();
  const { data: row } = await sb.from("cases").select("*").eq("id", caseId).maybeSingle();
  if (!row) throw new Error("Case not found");
  const [{ data: actions }, { data: appeals }, { data: actor }] = await Promise.all([
    sb.from("case_actions").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
    sb.from("appeals").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
    sb.from("actors").select("display_name,role").eq("id", row.actor_id).maybeSingle(),
  ]);
  return {
    caseRow: {
      id: row.id,
      actorId: row.actor_id,
      riskScore: row.risk_score,
      appealNarrative: row.appeal_narrative,
      recommendedAction: row.recommended_action,
      status: row.status,
      slaDeadline: row.sla_deadline,
    },
    actor: actor ?? null,
    actions: actions ?? [],
    appeals: appeals ?? [],
  };
}

function gatekeep(action: ActionKey, precision: { rule_key: string; precision: number }[], ruleKey: string) {
  const meta = ACTION_META[action];
  const measured = precision.find((p) => p.rule_key === ruleKey)?.precision ?? 0;
  if (meta.severity !== "hard") return { allowed: true, measured, reason: null as string | null };
  if (Number(measured) >= 0.95) return { allowed: true, measured, reason: null as string | null };
  return {
    allowed: false,
    measured,
    reason: `Measured precision for "${ruleKey}" is ${(Number(measured) * 100).toFixed(1)}%, below the 95% gate required for an income-affecting hard action. Routed to human review.`,
  };
}

export async function takeAction(input: {
  caseId: string;
  action: ActionKey;
  ruleKey: string;
  userId: string;
}) {
  const sb = await admin();
  const { data: precision } = await sb.from("rule_precision").select("rule_key,precision");
  const gate = gatekeep(input.action, precision ?? [], input.ruleKey);
  const meta = ACTION_META[input.action];
  const finalAction: ActionKey = gate.allowed ? input.action : "step_up_verify";
  const expires = meta.hours ? new Date(Date.now() + meta.hours * 3600_000).toISOString() : null;
  const sla = new Date(Date.now() + 72 * 3600_000).toISOString();

  const { data: row, error } = await sb
    .from("case_actions")
    .insert({
      case_id: input.caseId,
      action_type: gate.allowed ? input.action : "human_review",
      severity: gate.allowed ? meta.severity : "soft",
      rule_key: input.ruleKey,
      precision_at_decision: gate.measured,
      gate_passed: gate.allowed,
      gate_reason: gate.reason,
      expires_at: gate.allowed ? expires : null,
      sla_deadline: sla,
      taken_by: input.userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await sb.from("case_evidence").insert({
    case_id: input.caseId,
    source: "remediation",
    summary: gate.allowed
      ? `Action taken: ${meta.label}. Time-bound to ${expires ? new Date(expires).toLocaleString("en-IN") : "n/a"}; appeal window open.`
      : `Hard action blocked by the precision gate. ${gate.reason}`,
    detail: { requested: input.action, applied: gate.allowed ? input.action : "human_review" } as never,
  });

  await sb
    .from("cases")
    .update({ status: gate.allowed ? "actioned" : "human_review", updated_at: new Date().toISOString() })
    .eq("id", input.caseId);

  const notice = await Notifications.send(
    "email",
    "accused-party@example.com",
    "Action on your marketplace account",
    `A ${meta.label} was applied. You can appeal at /appeals/${input.caseId} before ${sla}.`,
  );

  return { action: row, gate, finalAction, notification: notice };
}

export async function submitAppeal(input: {
  caseId: string;
  statement: string;
  evidenceNote?: string | undefined;
  contactEmail?: string | undefined;
}) {
  const sb = await admin();
  const { data, error } = await sb
    .from("appeals")
    .insert({
      case_id: input.caseId,
      statement: input.statement,
      evidence_note: input.evidenceNote ?? null,
      contact_email: input.contactEmail ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await sb.from("case_evidence").insert({
    case_id: input.caseId,
    source: "appeal",
    summary: `Appeal filed by the accused party. SLA for a human decision: ${new Date(data.sla_deadline).toLocaleString("en-IN")}.`,
    detail: { length: input.statement.length } as never,
  });
  await sb.from("cases").update({ status: "under_appeal" }).eq("id", input.caseId);
  return data;
}

export async function decideAppeal(input: { appealId: string; outcome: "upheld" | "overturned"; note: string }) {
  const sb = await admin();
  const { data, error } = await sb
    .from("appeals")
    .update({ status: "decided", outcome: input.outcome, decided_at: new Date().toISOString() })
    .eq("id", input.appealId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await sb.from("case_evidence").insert({
    case_id: data.case_id,
    source: "appeal_decision",
    summary: `Appeal ${input.outcome} by a human reviewer. ${input.note}`,
  });
  await sb
    .from("cases")
    .update({ status: input.outcome === "overturned" ? "closed_overturned" : "closed_upheld" })
    .eq("id", data.case_id);
  return data;
}

// ---------------- LLM agents ----------------

function gateway() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key);
}

async function logRun(caseId: string, agent: string, tier: keyof typeof TIER_COST_INR, model: string, ms: number) {
  const sb = await admin();
  await sb.from("agent_runs").insert({
    case_id: caseId,
    agent,
    tier,
    model,
    cost_inr: TIER_COST_INR[tier],
    latency_ms: ms,
  });
}

export async function runExplainer(caseId: string) {
  const detail = await getCaseDetail(caseId);
  const s = detail.scored;
  const started = Date.now();
  const provider = gateway();
  const facts = JSON.stringify(
    {
      actor: { role: s?.role, tenureDays: s?.tenureDays, sizeTier: s?.sizeTier, city: s?.city },
      scores: { transaction: s?.txnScore, graph: s?.graphScore, blended: s?.riskScore },
      ring: s?.ringId ? { id: s.ringId, members: s.ringMembers.length } : null,
      signals: s?.signals,
      features: s?.features,
      externalSignals: detail.external,
    },
    null,
    1,
  );

  const result = streamText({
    model: provider(MODELS.cheap),
    system:
      "You are the Evidence Explainer in a marketplace trust-and-safety system. Write factual, non-accusatory explanations grounded ONLY in the supplied evidence. Never invent facts or numbers. Indian marketplace context, rupees.",
    prompt: `Evidence JSON:\n${facts}\n\nProduce exactly two sections separated by the line "---".\nSection 1 (heading "INVESTIGATOR"): 4-6 sentences for a trained investigator: what the transaction model saw, what the graph added that a per-transaction model cannot see, and the strength/weakness of the evidence.\nSection 2 (heading "ACCUSED"): 4-5 short sentences addressed to the account holder in plain language, no jargon, no accusation of guilt, stating what was observed, what it means, and that they can appeal. Plain text only, no markdown.`,
  });
  const text = await result.text;
  const [investigator, accused] = text.split("---");
  const sb = await admin();
  await sb
    .from("cases")
    .update({
      narrative: (investigator ?? text).replace(/^INVESTIGATOR:?/i, "").trim(),
      appeal_narrative: (accused ?? "").replace(/^ACCUSED:?/i, "").trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseId);
  await sb.from("case_evidence").insert({
    case_id: caseId,
    source: "evidence_explainer",
    summary: "Plain-language evidence narrative generated for investigator and accused party.",
  });
  await logRun(caseId, "evidence_explainer", "cheap_llm", MODELS.cheap, Date.now() - started);
  return { narrative: (investigator ?? text).trim(), appealNarrative: (accused ?? "").trim() };
}

export async function runPlanner(caseId: string) {
  const detail = await getCaseDetail(caseId);
  const s = detail.scored;
  const started = Date.now();
  const provider = gateway();
  const rule = s?.primaryRule ?? "velocity_spike";
  const measured = Number(detail.precision.find((p) => p.rule_key === rule)?.precision ?? 0);

  const result = streamText({
    model: provider(MODELS.cheap),
    system:
      "You are the Remediation Planner. Choose the least severe action that contains the risk. Actions, ascending: monitor, step_up_verify, payout_hold, payout_freeze, suspend. Hard actions (payout_freeze, suspend) are only permitted when measured rule precision >= 0.95. Livelihood matters: every income-affecting action must be time-bound.",
    prompt: `Case: role=${s?.role}, blended risk=${s?.riskScore}, transaction=${s?.txnScore}, graph=${s?.graphScore}, ring=${s?.ringId ?? "none"}, tenure=${s?.tenureDays} days, primary rule=${rule}, measured precision=${measured}.\nSignals: ${JSON.stringify(s?.signals?.slice(0, 4))}\n\nReply in exactly this shape, plain text, no markdown:\nACTION: <one action key>\nEXPIRY_HOURS: <integer>\nRATIONALE: <2-3 sentences explaining the choice and the precision-gate outcome>`,
  });
  const text = await result.text;
  const action = (text.match(/ACTION:\s*([a-z_]+)/i)?.[1] ?? "step_up_verify") as ActionKey;
  const rationale = text.split(/RATIONALE:/i)[1]?.trim() ?? text.trim();
  const safeAction = (ACTION_META[action] ? action : "step_up_verify") as ActionKey;
  const gate = gatekeep(safeAction, detail.precision as never, rule);

  const sb = await admin();
  await sb
    .from("cases")
    .update({ recommended_action: safeAction, planner_rationale: rationale, updated_at: new Date().toISOString() })
    .eq("id", caseId);
  await sb.from("case_evidence").insert({
    case_id: caseId,
    source: "remediation_planner",
    summary: `Planner proposed "${ACTION_META[safeAction].label}". ${gate.allowed ? "Precision gate passed." : gate.reason}`,
  });
  await logRun(caseId, "remediation_planner", "cheap_llm", MODELS.cheap, Date.now() - started);
  return { action: safeAction, rationale, gate, ruleKey: rule };
}

export async function runReviewer(caseId: string) {
  const detail = await getCaseDetail(caseId);
  const s = detail.scored;
  const started = Date.now();
  const provider = gateway();

  const result = streamText({
    model: provider(MODELS.reasoning),
    system:
      "You are the Self-Check Reviewer, the last guardrail before an income-affecting action on an Indian marketplace. You weigh fraud loss against livelihood harm, cohort fairness, and evidence quality. You may downgrade any proposed action to human review. Be concise and decisive.",
    prompt: `Proposed action: ${detail.case.recommended_action}\nPlanner rationale: ${detail.case.planner_rationale ?? "n/a"}\nBlended risk ${s?.riskScore}, transaction ${s?.txnScore}, graph ${s?.graphScore}, ring ${s?.ringId ?? "none"} (${s?.ringMembers.length ?? 0} members).\nActor: ${s?.role}, tenure ${s?.tenureDays} days, size tier ${s?.sizeTier}.\nSignals: ${JSON.stringify(s?.signals?.slice(0, 5))}\nMeasured rule precision table: ${JSON.stringify(detail.precision)}\n\nReply in exactly this shape, plain text:\nVERDICT: approve | downgrade_to_human_review\nREASON: <3-4 sentences covering evidence strength, livelihood impact, and fairness>`,
  });
  const text = await result.text;
  const verdict = /downgrade/i.test(text) ? "downgrade_to_human_review" : "approve";
  const reason = text.split(/REASON:/i)[1]?.trim() ?? text.trim();
  const sb = await admin();
  await sb
    .from("cases")
    .update({ reviewer_verdict: `${verdict}: ${reason}`, status: verdict === "approve" ? "reviewed" : "human_review" })
    .eq("id", caseId);
  await sb.from("case_evidence").insert({
    case_id: caseId,
    source: "self_check_reviewer",
    summary: `Self-check reviewer verdict: ${verdict.replace(/_/g, " ")}. ${reason}`,
  });
  await logRun(caseId, "self_check_reviewer", "reasoning_llm", MODELS.reasoning, Date.now() - started);
  return { verdict, reason };
}

// ---------------- metrics ----------------

export async function getMetrics() {
  const data = await loadRawData();
  const engine = runEngine(data);
  const sb = await admin();
  const [{ data: actions }, { data: appeals }, { data: runs }, { data: precision }, { data: cases }] =
    await Promise.all([
      sb.from("case_actions").select("*"),
      sb.from("appeals").select("*"),
      sb.from("agent_runs").select("*"),
      sb.from("rule_precision").select("*"),
      sb.from("cases").select("id,actor_id,status,created_at,updated_at,risk_score,recommended_action"),
    ]);

  const blended = confusion(engine.scored, data.labels, RISK_THRESHOLD, "blended");
  const txnOnly = confusion(engine.scored, data.labels, RISK_THRESHOLD, "txn");
  const graphOnly = confusion(engine.scored, data.labels, RISK_THRESHOLD, "graph");

  const fraudActors = new Set(data.labels.filter((l) => l.is_fraud).map((l) => l.actor_id));
  const caughtActors = new Set(
    engine.scored.filter((s) => s.riskScore >= RISK_THRESHOLD && fraudActors.has(s.actorId)).map((s) => s.actorId),
  );
  const lossByActor = new Map<string, number>();
  for (const c of data.claims) {
    const o = data.orders.find((x) => x.id === c.order_id);
    if (!o) continue;
    for (const id of [o.buyer_id, o.seller_id]) {
      if (fraudActors.has(id)) lossByActor.set(id, (lossByActor.get(id) ?? 0) + Number(c.amount));
    }
  }
  const fraudLossTotal = [...lossByActor.values()].reduce((a, b) => a + b, 0);
  const fraudLossAvoided = [...caughtActors].reduce((sum, id) => sum + (lossByActor.get(id) ?? 0), 0);

  // Graph-rescued fraud: labelled fraud actors the transaction-only model would
  // have missed at the same threshold, but the blended (graph) score catches.
  const rescuedActors = engine.scored.filter(
    (s) => fraudActors.has(s.actorId) && s.txnScore < RISK_THRESHOLD && s.riskScore >= RISK_THRESHOLD,
  );
  const rescuedLoss = rescuedActors.reduce((sum, s) => sum + (lossByActor.get(s.actorId) ?? 0), 0);
  const rescued = {
    count: rescuedActors.length,
    loss: rescuedLoss,
    shareOfCaught: caughtActors.size ? rescuedActors.length / caughtActors.size : 0,
    actors: rescuedActors.slice(0, 12).map((s) => ({
      actorId: s.actorId,
      displayName: s.displayName,
      role: s.role,
      txnScore: s.txnScore,
      graphScore: s.graphScore,
      riskScore: s.riskScore,
      ringId: s.ringId,
      loss: lossByActor.get(s.actorId) ?? 0,
    })),
  };



  // fairness: action rate per cohort
  const actionedCases = new Set((actions ?? []).map((a) => a.case_id));
  const caseActor = new Map((cases ?? []).map((c) => [c.id, c.actor_id]));
  const actionedActors = new Set([...actionedCases].map((id) => caseActor.get(id)).filter(Boolean) as string[]);
  const cohortOf = (a: { role: string; size_tier: string | null; tenure_days: number }) =>
    a.role === "delivery_partner"
      ? `Delivery partner · ${a.tenure_days < 180 ? "new" : "tenured"}`
      : a.role === "seller"
        ? `Seller · ${a.size_tier ?? "unknown"}`
        : `Customer · ${a.tenure_days < 180 ? "new" : "tenured"}`;
  const cohorts = new Map<string, { total: number; flagged: number; actioned: number }>();
  for (const a of data.actors) {
    const key = cohortOf(a);
    const c = cohorts.get(key) ?? { total: 0, flagged: 0, actioned: 0 };
    c.total += 1;
    if ((engine.byActor.get(a.id)?.riskScore ?? 0) >= RISK_THRESHOLD) c.flagged += 1;
    if (actionedActors.has(a.id)) c.actioned += 1;
    cohorts.set(key, c);
  }

  const decided = (appeals ?? []).filter((a) => a.status === "decided");
  const overturned = decided.filter((a) => a.outcome === "overturned");

  const resolutionMs = (cases ?? [])
    .filter((c) => c.status !== "open")
    .map((c) => new Date(c.updated_at).getTime() - new Date(c.created_at).getTime())
    .sort((a, b) => a - b);
  const medianResolutionMin = resolutionMs.length
    ? Math.round(resolutionMs[Math.floor(resolutionMs.length / 2)]! / 60000)
    : 0;

  const runList = runs ?? [];
  const totalCost = runList.reduce((s, r) => s + Number(r.cost_inr), 0);
  const decisions = (cases ?? []).length || 1;
  const byTier = ["deterministic", "cheap_llm", "reasoning_llm"].map((tier) => {
    const rows = runList.filter((r) => r.tier === tier);
    return {
      tier,
      runs: rows.length,
      cost: rows.reduce((s, r) => s + Number(r.cost_inr), 0),
    };
  });

  return {
    threshold: RISK_THRESHOLD,
    blended,
    txnOnly,
    graphOnly,
    rescued,
    lift: {
      precision: blended.precision - txnOnly.precision,
      recall: blended.recall - txnOnly.recall,
      caught: blended.tp - txnOnly.tp,
    },
    fraudLossTotal,
    fraudLossAvoided,
    rings: engine.rings.map((r) => ({ id: r.id, members: r.members.length, loops: r.reciprocalPairs })),
    cohorts: [...cohorts.entries()].map(([name, v]) => ({
      name,
      ...v,
      flagRate: v.total ? v.flagged / v.total : 0,
      actionRate: v.total ? v.actioned / v.total : 0,
    })),
    appeals: {
      total: (appeals ?? []).length,
      decided: decided.length,
      overturned: overturned.length,
      overturnRate: decided.length ? overturned.length / decided.length : 0,
    },
    medianResolutionMin,
    cost: {
      total: totalCost,
      perDecision: totalCost / decisions,
      decisions,
      byTier,
      llmFreeShare:
        runList.length ? runList.filter((r) => r.tier === "deterministic").length / runList.length : 1,
    },
    precision: precision ?? [],
    actionsTaken: (actions ?? []).length,
    gateBlocked: (actions ?? []).filter((a) => !a.gate_passed).length,
    caseCount: (cases ?? []).length,
    actorCount: data.actors.length,
    orderCount: data.orders.length,
  };
}

export const __keepGenerateText = generateText;
