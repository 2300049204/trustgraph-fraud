// Pure TypeScript risk engine. No LLM, no network, no PII.
// Runs the Triage Scorer (deterministic feature rules) and the Graph Analyst
// (classical ring detection) — the two ~zero-cost tiers of the agent pipeline.

export type ActorRole = "customer" | "seller" | "delivery_partner";

export interface ActorRow {
  id: string;
  role: string;
  display_name: string;
  size_tier: string | null;
  tenure_days: number;
  city: string | null;
}

export interface OrderRow {
  id: string;
  buyer_id: string;
  seller_id: string;
  partner_id: string | null;
  amount: number;
  status: string;
  created_at: string;
}

export interface FingerprintRow {
  order_id: string;
  device_id: string | null;
  ip_address: string | null;
  address_cluster: string | null;
}

export interface DeliveryEventRow {
  order_id: string;
  event_type: string;
  occurred_at: string;
  lat: number | null;
  lng: number | null;
  pod_ok: boolean | null;
}

export interface ClaimRow {
  order_id: string;
  claim_type: string;
  amount: number;
  status: string;
}

export interface RatingRow {
  order_id: string;
  rater_id: string;
  ratee_id: string;
  stars: number;
}

export interface LabelRow {
  actor_id: string;
  is_fraud: boolean;
  is_holdout: boolean;
}

export interface RawData {
  actors: ActorRow[];
  orders: OrderRow[];
  fingerprints: FingerprintRow[];
  events: DeliveryEventRow[];
  claims: ClaimRow[];
  ratings: RatingRow[];
  labels: LabelRow[];
}

export interface Signal {
  key: string;
  label: string;
  contribution: number; // points added to the score
  detail: string;
}

export type ActionKey =
  | "monitor"
  | "step_up_verify"
  | "payout_hold"
  | "payout_freeze"
  | "suspend";

export const ACTION_META: Record<
  ActionKey,
  { label: string; severity: "info" | "soft" | "hard"; incomeAffecting: boolean; hours: number }
> = {
  monitor: { label: "Monitor only", severity: "info", incomeAffecting: false, hours: 0 },
  step_up_verify: { label: "Step-up verification", severity: "soft", incomeAffecting: false, hours: 72 },
  payout_hold: { label: "Temporary payout hold", severity: "soft", incomeAffecting: true, hours: 168 },
  payout_freeze: { label: "Payout freeze", severity: "hard", incomeAffecting: true, hours: 336 },
  suspend: { label: "Account suspension", severity: "hard", incomeAffecting: true, hours: 336 },
};

export interface ScoredActor {
  actorId: string;
  role: ActorRole;
  displayName: string;
  sizeTier: string | null;
  tenureDays: number;
  city: string | null;
  txnScore: number;
  graphScore: number;
  riskScore: number;
  signals: Signal[];
  ringId: string | null;
  ringMembers: string[];
  recommendedAction: ActionKey;
  primaryRule: string;
  features: Record<string, number>;
}

export interface GraphNode {
  id: string;
  kind: "customer" | "seller" | "delivery_partner" | "device" | "ip" | "address";
  label: string;
  risk?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  kind: "shared" | "order" | "rating";
  weight: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let r = this.parent.get(x)!;
    if (r !== x) {
      r = this.find(r);
      this.parent.set(x, r);
    }
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
  keys() {
    return [...this.parent.keys()];
  }
}

export interface EngineResult {
  scored: ScoredActor[];
  byActor: Map<string, ScoredActor>;
  rings: {
    id: string;
    members: string[];
    attributes: { kind: string; value: string; actors: string[] }[];
    reciprocalPairs: number;
    fiveStarShare: number;
    podFailures: number;
  }[];
  sharedAttributes: Map<string, { kind: "device" | "ip" | "address"; value: string; actors: string[] }>;
}

export function runEngine(data: RawData): EngineResult {
  const fpByOrder = new Map(data.fingerprints.map((f) => [f.order_id, f]));
  const orderById = new Map(data.orders.map((o) => [o.id, o]));

  // ---------- per-actor aggregates ----------
  interface Agg {
    orders: number;
    value: number;
    night: number;
    claims: number;
    claimValue: number;
    podTotal: number;
    podFail: number;
    counterparties: Map<string, number>;
    fiveStars: number;
    ratings: number;
  }
  const agg = new Map<string, Agg>();
  const blank = (): Agg => ({
    orders: 0,
    value: 0,
    night: 0,
    claims: 0,
    claimValue: 0,
    podTotal: 0,
    podFail: 0,
    counterparties: new Map(),
    fiveStars: 0,
    ratings: 0,
  });
  const get = (id: string) => {
    let a = agg.get(id);
    if (!a) {
      a = blank();
      agg.set(id, a);
    }
    return a;
  };
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  const actorOrders = new Map<string, string[]>();
  for (const o of data.orders) {
    const hour = new Date(o.created_at).getUTCHours();
    const night = hour >= 0 && hour <= 5 ? 1 : 0;
    for (const [id, counterparty] of [
      [o.buyer_id, o.seller_id],
      [o.seller_id, o.buyer_id],
      ...(o.partner_id ? [[o.partner_id, o.seller_id]] : []),
    ] as [string, string][]) {
      const a = get(id);
      a.orders += 1;
      a.value += Number(o.amount);
      a.night += night;
      bump(a.counterparties, counterparty);
      const list = actorOrders.get(id) ?? [];
      list.push(o.id);
      actorOrders.set(id, list);
    }
  }
  for (const c of data.claims) {
    const o = orderById.get(c.order_id);
    if (!o) continue;
    for (const id of [o.buyer_id, o.seller_id, o.partner_id].filter(Boolean) as string[]) {
      const a = get(id);
      a.claims += 1;
      a.claimValue += Number(c.amount);
    }
  }
  for (const e of data.events) {
    if (e.pod_ok === null) continue;
    const o = orderById.get(e.order_id);
    if (!o) continue;
    for (const id of [o.seller_id, o.partner_id].filter(Boolean) as string[]) {
      const a = get(id);
      a.podTotal += 1;
      if (!e.pod_ok) a.podFail += 1;
    }
  }
  for (const r of data.ratings) {
    const a = get(r.ratee_id);
    a.ratings += 1;
    if (r.stars === 5) a.fiveStars += 1;
  }

  // ---------- shared-attribute graph (Graph Analyst) ----------
  const attrActors = new Map<string, Set<string>>(); // "device:xxx" -> actors
  for (const o of data.orders) {
    const fp = fpByOrder.get(o.id);
    if (!fp) continue;
    const parties = [o.buyer_id, o.seller_id, o.partner_id].filter(Boolean) as string[];
    for (const [kind, value] of [
      ["device", fp.device_id],
      ["ip", fp.ip_address],
      ["address", fp.address_cluster],
    ] as [string, string | null][]) {
      if (!value) continue;
      const key = `${kind}:${value}`;
      const set = attrActors.get(key) ?? new Set<string>();
      parties.forEach((p) => set.add(p));
      attrActors.set(key, set);
    }
  }

  const uf = new UnionFind();
  const sharedAttributes = new Map<
    string,
    { kind: "device" | "ip" | "address"; value: string; actors: string[] }
  >();
  for (const [key, set] of attrActors) {
    // A hub used by very many actors is infrastructure (shared NAT), not collusion.
    if (set.size < 2 || set.size > 12) continue;
    const [kind, ...rest] = key.split(":");
    sharedAttributes.set(key, {
      kind: kind as "device" | "ip" | "address",
      value: rest.join(":"),
      actors: [...set],
    });
    const members = [...set];
    for (let i = 1; i < members.length; i += 1) uf.union(members[0]!, members[i]!);
  }

  const components = new Map<string, string[]>();
  for (const actorId of uf.keys()) {
    const root = uf.find(actorId);
    const list = components.get(root) ?? [];
    list.push(actorId);
    components.set(root, list);
  }

  const roleOf = new Map(data.actors.map((a) => [a.id, a.role as ActorRole]));
  const rings: EngineResult["rings"] = [];
  const ringOfActor = new Map<string, { id: string; members: string[]; score: number; signals: Signal[] }>();

  let ringSeq = 0;
  for (const [, members] of components) {
    const roles = new Set(members.map((m) => roleOf.get(m)).filter(Boolean));
    if (members.length < 3 || roles.size < 2) continue;

    const memberSet = new Set(members);
    const internalOrders = data.orders.filter(
      (o) => memberSet.has(o.buyer_id) && memberSet.has(o.seller_id),
    );
    if (internalOrders.length < 6) continue;

    const pairCount = new Map<string, number>();
    for (const o of internalOrders) bump(pairCount, `${o.buyer_id}->${o.seller_id}`);
    const reciprocalPairs = [...pairCount.values()].filter((n) => n >= 3).length;

    const internalOrderIds = new Set(internalOrders.map((o) => o.id));
    const internalRatings = data.ratings.filter((r) => internalOrderIds.has(r.order_id));
    const fiveStarShare = internalRatings.length
      ? internalRatings.filter((r) => r.stars === 5).length / internalRatings.length
      : 0;
    const podFailures = data.events.filter(
      (e) => internalOrderIds.has(e.order_id) && e.pod_ok === false,
    ).length;

    const attrs = [...sharedAttributes.values()].filter((a) => a.actors.some((x) => memberSet.has(x)));

    const sizeTerm = clamp01((members.length - 2) / 8) * 28;
    const loopTerm = clamp01(reciprocalPairs / 6) * 26;
    const ratingTerm = clamp01((fiveStarShare - 0.6) / 0.4) * 18;
    const podTerm = clamp01(podFailures / Math.max(6, internalOrders.length * 0.4)) * 20;
    const attrTerm = clamp01(attrs.length / 3) * 8;
    const score = Math.min(100, sizeTerm + loopTerm + ratingTerm + podTerm + attrTerm);

    ringSeq += 1;
    const ringId = `RING-${String(ringSeq).padStart(2, "0")}`;
    const signals: Signal[] = [];
    if (sizeTerm > 0)
      signals.push({
        key: "shared_device_ring",
        label: "Shared device / IP / address cluster",
        contribution: round1(sizeTerm + attrTerm),
        detail: `${members.length} actors across ${roles.size} roles share ${attrs.length} identifiers (${attrs
          .slice(0, 3)
          .map((a) => `${a.kind} ${a.value}`)
          .join(", ")}).`,
      });
    if (loopTerm > 0)
      signals.push({
        key: "reciprocal_loop",
        label: "Reciprocal buyer-seller order loops",
        contribution: round1(loopTerm),
        detail: `${reciprocalPairs} buyer→seller pairs inside the cluster transacted 3+ times; ${internalOrders.length} orders never left the cluster.`,
      });
    if (ratingTerm > 0)
      signals.push({
        key: "rating_inflation",
        label: "Rating self-inflation",
        contribution: round1(ratingTerm),
        detail: `${Math.round(fiveStarShare * 100)}% of ratings inside the cluster are 5-star, against a 62% marketplace baseline.`,
      });
    if (podTerm > 0)
      signals.push({
        key: "pod_anomaly",
        label: "Delivery scan / POD anomalies",
        contribution: round1(podTerm),
        detail: `${podFailures} deliveries inside the cluster were marked complete without a valid proof-of-delivery scan.`,
      });

    rings.push({ id: ringId, members, attributes: attrs, reciprocalPairs, fiveStarShare, podFailures });
    for (const m of members) ringOfActor.set(m, { id: ringId, members, score, signals });
  }

  // ---------- combine ----------
  const scored: ScoredActor[] = [];
  for (const actor of data.actors) {
    const a = agg.get(actor.id) ?? blank();
    const orders = a.orders;
    const claimRate = orders ? a.claims / orders : 0;
    const nightShare = orders ? a.night / orders : 0;
    const podFailRate = a.podTotal ? a.podFail / a.podTotal : 0;
    const velocity = orders / Math.max(14, actor.tenure_days);
    const avgValue = orders ? a.value / orders : 0;
    const topCounterparty = Math.max(0, ...a.counterparties.values());
    const concentration = orders ? topCounterparty / orders : 0;
    const fiveStarShare = a.ratings ? a.fiveStars / a.ratings : 0;

    const signals: Signal[] = [];
    const add = (key: string, label: string, contribution: number, detail: string) => {
      if (contribution >= 1) signals.push({ key, label, contribution: round1(contribution), detail });
    };

    const claimTerm = clamp01(claimRate / 0.3) * 24;
    const podTerm = clamp01(podFailRate / 0.5) * 20;
    const nightTerm = clamp01((nightShare - 0.15) / 0.5) * 14;
    const velocityTerm = clamp01(velocity / 1.2) * 16;
    const concTerm = clamp01((concentration - 0.15) / 0.5) * 14;
    const valueTerm = actor.tenure_days < 120 ? clamp01(avgValue / 12000) * 12 : 0;

    add(
      "refund_abuse",
      "Refund / claim abuse",
      claimTerm,
      `${a.claims} claims across ${orders} orders (${Math.round(claimRate * 100)}%), ₹${Math.round(
        a.claimValue,
      ).toLocaleString("en-IN")} claimed.`,
    );
    add(
      "pod_anomaly",
      "Proof-of-delivery failures",
      podTerm,
      `${a.podFail} of ${a.podTotal} scanned deliveries lacked a valid POD.`,
    );
    add(
      "odd_hours",
      "Off-hours ordering pattern",
      nightTerm,
      `${Math.round(nightShare * 100)}% of activity falls between 00:00–05:00 IST.`,
    );
    add(
      "velocity_spike",
      "New-actor velocity spike",
      velocityTerm,
      `${orders} orders in ${actor.tenure_days} days on the platform (${velocity.toFixed(2)}/day).`,
    );
    add(
      "counterparty_concentration",
      "Counterparty concentration",
      concTerm,
      `${Math.round(concentration * 100)}% of activity is with a single counterparty.`,
    );
    add(
      "high_value_new",
      "High ticket size on a young account",
      valueTerm,
      `Average order value ₹${Math.round(avgValue).toLocaleString("en-IN")} on an account ${actor.tenure_days} days old.`,
    );

    const txnScore = Math.min(
      100,
      claimTerm + podTerm + nightTerm + velocityTerm + concTerm + valueTerm,
    );

    const ring = ringOfActor.get(actor.id) ?? null;
    const graphScore = ring ? ring.score : clamp01((concentration - 0.4) / 0.6) * 20;
    const allSignals = [...(ring?.signals ?? []), ...signals].sort(
      (x, y) => y.contribution - x.contribution,
    );

    const riskScore = ring
      ? Math.min(100, 0.4 * txnScore + 0.6 * graphScore + 8)
      : Math.min(100, 0.85 * txnScore + 0.15 * graphScore);

    const primaryRule = allSignals[0]?.key ?? "velocity_spike";
    let recommendedAction: ActionKey = "monitor";
    if (riskScore >= 80) recommendedAction = actor.role === "seller" ? "payout_freeze" : "suspend";
    else if (riskScore >= 62) recommendedAction = "payout_hold";
    else if (riskScore >= 42) recommendedAction = "step_up_verify";

    scored.push({
      actorId: actor.id,
      role: actor.role as ActorRole,
      displayName: actor.display_name,
      sizeTier: actor.size_tier,
      tenureDays: actor.tenure_days,
      city: actor.city,
      txnScore: round1(txnScore),
      graphScore: round1(graphScore),
      riskScore: round1(riskScore),
      signals: allSignals,
      ringId: ring?.id ?? null,
      ringMembers: ring?.members ?? [],
      recommendedAction,
      primaryRule,
      features: {
        orders,
        claimRate: round1(claimRate * 100),
        podFailRate: round1(podFailRate * 100),
        nightShare: round1(nightShare * 100),
        velocity: Math.round(velocity * 100) / 100,
        avgValue: Math.round(avgValue),
        concentration: round1(concentration * 100),
        fiveStarShare: round1(fiveStarShare * 100),
      },
    });
  }

  scored.sort((a, b) => b.riskScore - a.riskScore);
  return { scored, byActor: new Map(scored.map((s) => [s.actorId, s])), rings, sharedAttributes };
}

// ---------- metrics ----------
export interface ConfusionMetrics {
  precision: number;
  recall: number;
  f1: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

export function confusion(
  scored: ScoredActor[],
  labels: LabelRow[],
  threshold: number,
  useGraph: boolean,
  holdoutOnly = true,
): ConfusionMetrics {
  const labelMap = new Map(labels.map((l) => [l.actor_id, l]));
  let tp = 0,
    fp = 0,
    fn = 0,
    tn = 0;
  for (const s of scored) {
    const l = labelMap.get(s.actorId);
    if (!l) continue;
    if (holdoutOnly && !l.is_holdout) continue;
    const score = useGraph ? s.riskScore : s.txnScore;
    const flagged = score >= threshold;
    if (flagged && l.is_fraud) tp += 1;
    else if (flagged && !l.is_fraud) fp += 1;
    else if (!flagged && l.is_fraud) fn += 1;
    else tn += 1;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return {
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    tp,
    fp,
    fn,
    tn,
  };
}

// ---------- graph projection for the canvas ----------
export function buildGraph(
  data: RawData,
  engine: EngineResult,
  focusActorId: string,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const focus = engine.byActor.get(focusActorId);
  const members = new Set<string>(focus?.ringMembers?.length ? focus.ringMembers : [focusActorId]);
  if (!focus?.ringMembers.length) {
    // pull in direct counterparties so a non-ring case still shows context
    for (const o of data.orders) {
      if (o.buyer_id === focusActorId) members.add(o.seller_id);
      if (o.seller_id === focusActorId) members.add(o.buyer_id);
      if (members.size > 10) break;
    }
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const addNode = (n: GraphNode) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    nodes.push(n);
  };

  const actorById = new Map(data.actors.map((a) => [a.id, a]));
  for (const m of members) {
    const a = actorById.get(m);
    if (!a) continue;
    addNode({
      id: m,
      kind: a.role as GraphNode["kind"],
      label: a.display_name,
      risk: engine.byActor.get(m)?.riskScore ?? 0,
    });
  }

  for (const attr of engine.sharedAttributes.values()) {
    const inside = attr.actors.filter((x) => members.has(x));
    if (inside.length < 2) continue;
    const nodeId = `${attr.kind}:${attr.value}`;
    addNode({ id: nodeId, kind: attr.kind, label: attr.value });
    for (const actorId of inside) {
      edges.push({
        source: actorId,
        target: nodeId,
        label: `shared ${attr.kind}`,
        kind: "shared",
        weight: 1,
      });
    }
  }

  const pair = new Map<string, number>();
  for (const o of data.orders) {
    if (!members.has(o.buyer_id) || !members.has(o.seller_id)) continue;
    const k = `${o.buyer_id}|${o.seller_id}`;
    pair.set(k, (pair.get(k) ?? 0) + 1);
  }
  for (const [k, n] of pair) {
    const [source, target] = k.split("|") as [string, string];
    edges.push({ source, target, label: `${n} orders`, kind: "order", weight: n });
  }

  return { nodes, edges };
}
