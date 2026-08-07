
CREATE TYPE public.app_role AS ENUM ('investigator','admin');
CREATE TABLE public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null, role app_role not null, unique(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated; GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
-- every signed-in user is an investigator in this MVP unless explicitly restricted
CREATE OR REPLACE FUNCTION public.is_investigator() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT auth.uid() IS NOT NULL $$;

CREATE TABLE public.actors (id text primary key, role text not null, display_name text not null, size_tier text, tenure_days int not null default 0, city text, seeded_ring text, created_at timestamptz not null default now());
GRANT SELECT ON public.actors TO anon, authenticated; GRANT ALL ON public.actors TO service_role;
ALTER TABLE public.actors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "actors public read" ON public.actors FOR SELECT USING (true);

CREATE TABLE public.actor_pii (actor_id text primary key references public.actors(id) on delete cascade, email text, phone text, gstin text, address_line text);
GRANT SELECT ON public.actor_pii TO authenticated; GRANT ALL ON public.actor_pii TO service_role;
ALTER TABLE public.actor_pii ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pii investigators only" ON public.actor_pii FOR SELECT TO authenticated USING (public.is_investigator());

CREATE TABLE public.orders (id text primary key, buyer_id text not null references public.actors(id), seller_id text not null references public.actors(id), partner_id text references public.actors(id), amount numeric not null, status text not null, created_at timestamptz not null);
CREATE TABLE public.order_fingerprints (order_id text primary key references public.orders(id) on delete cascade, device_id text, ip_address text, address_cluster text);
CREATE TABLE public.delivery_events (id bigserial primary key, order_id text not null references public.orders(id) on delete cascade, event_type text not null, occurred_at timestamptz not null, lat double precision, lng double precision, pod_ok boolean);
CREATE TABLE public.claims (id bigserial primary key, order_id text not null references public.orders(id) on delete cascade, claim_type text not null, amount numeric not null, status text not null, created_at timestamptz not null);
CREATE TABLE public.ratings (id bigserial primary key, order_id text not null references public.orders(id) on delete cascade, rater_id text not null, ratee_id text not null, stars int not null, created_at timestamptz not null);
CREATE TABLE public.payouts (id bigserial primary key, seller_id text not null references public.actors(id), amount numeric not null, status text not null, created_at timestamptz not null);
CREATE TABLE public.fraud_labels (actor_id text primary key references public.actors(id) on delete cascade, is_fraud boolean not null, is_holdout boolean not null default false);
GRANT SELECT ON public.orders, public.order_fingerprints, public.delivery_events, public.claims, public.ratings, public.payouts, public.fraud_labels TO anon, authenticated;
GRANT ALL ON public.orders, public.order_fingerprints, public.delivery_events, public.claims, public.ratings, public.payouts, public.fraud_labels TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY; ALTER TABLE public.order_fingerprints ENABLE ROW LEVEL SECURITY; ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY; ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY; ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY; ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY; ALTER TABLE public.fraud_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders read" ON public.orders FOR SELECT USING (true);
CREATE POLICY "fp read" ON public.order_fingerprints FOR SELECT USING (true);
CREATE POLICY "de read" ON public.delivery_events FOR SELECT USING (true);
CREATE POLICY "claims read" ON public.claims FOR SELECT USING (true);
CREATE POLICY "ratings read" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "payouts read" ON public.payouts FOR SELECT USING (true);
CREATE POLICY "labels read" ON public.fraud_labels FOR SELECT USING (true);

CREATE TABLE public.cases (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null unique references public.actors(id) on delete cascade,
  txn_score numeric not null default 0,
  graph_score numeric not null default 0,
  risk_score numeric not null default 0,
  signals jsonb not null default '[]'::jsonb,
  ring_id text,
  ring_members text[] not null default '{}',
  recommended_action text not null default 'monitor',
  status text not null default 'open',
  narrative text,
  appeal_narrative text,
  planner_rationale text,
  reviewer_verdict text,
  sla_deadline timestamptz not null default now() + interval '48 hours',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT ON public.cases TO anon, authenticated; GRANT INSERT, UPDATE ON public.cases TO authenticated; GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cases read" ON public.cases FOR SELECT USING (true);
CREATE POLICY "cases write" ON public.cases FOR INSERT TO authenticated WITH CHECK (public.is_investigator());
CREATE POLICY "cases update" ON public.cases FOR UPDATE TO authenticated USING (public.is_investigator()) WITH CHECK (public.is_investigator());

CREATE TABLE public.case_evidence (id bigserial primary key, case_id uuid not null references public.cases(id) on delete cascade, source text not null, summary text not null, detail jsonb, created_at timestamptz not null default now());
GRANT SELECT ON public.case_evidence TO anon, authenticated; GRANT INSERT ON public.case_evidence TO authenticated; GRANT SELECT, INSERT ON public.case_evidence TO service_role;
ALTER TABLE public.case_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence read" ON public.case_evidence FOR SELECT USING (true);
CREATE POLICY "evidence append" ON public.case_evidence FOR INSERT TO authenticated WITH CHECK (public.is_investigator());

CREATE TABLE public.case_actions (id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade, action_type text not null, severity text not null default 'soft', rule_key text not null, precision_at_decision numeric, gate_passed boolean not null default false, gate_reason text, expires_at timestamptz, sla_deadline timestamptz, taken_by uuid, created_at timestamptz not null default now());
GRANT SELECT ON public.case_actions TO anon, authenticated; GRANT INSERT ON public.case_actions TO authenticated; GRANT ALL ON public.case_actions TO service_role;
ALTER TABLE public.case_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "actions read" ON public.case_actions FOR SELECT USING (true);
CREATE POLICY "actions insert" ON public.case_actions FOR INSERT TO authenticated WITH CHECK (public.is_investigator());

CREATE TABLE public.appeals (id uuid primary key default gen_random_uuid(), case_id uuid not null references public.cases(id) on delete cascade, statement text not null, evidence_note text, contact_email text, status text not null default 'submitted', outcome text, decided_at timestamptz, sla_deadline timestamptz not null default now() + interval '72 hours', created_at timestamptz not null default now());
GRANT SELECT, INSERT ON public.appeals TO anon, authenticated; GRANT UPDATE ON public.appeals TO authenticated; GRANT ALL ON public.appeals TO service_role;
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appeals read" ON public.appeals FOR SELECT USING (true);
CREATE POLICY "appeals file" ON public.appeals FOR INSERT WITH CHECK (true);
CREATE POLICY "appeals decide" ON public.appeals FOR UPDATE TO authenticated USING (public.is_investigator()) WITH CHECK (public.is_investigator());

CREATE TABLE public.rule_precision (rule_key text primary key, label text not null, precision numeric not null, sample_size int not null, updated_at timestamptz not null default now());
GRANT SELECT ON public.rule_precision TO anon, authenticated; GRANT ALL ON public.rule_precision TO service_role;
ALTER TABLE public.rule_precision ENABLE ROW LEVEL SECURITY;
CREATE POLICY "precision read" ON public.rule_precision FOR SELECT USING (true);

CREATE TABLE public.agent_runs (id bigserial primary key, case_id uuid references public.cases(id) on delete cascade, agent text not null, tier text not null, model text, cost_inr numeric not null default 0, latency_ms int, created_at timestamptz not null default now());
GRANT SELECT ON public.agent_runs TO anon, authenticated; GRANT INSERT ON public.agent_runs TO authenticated; GRANT ALL ON public.agent_runs TO service_role;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs read" ON public.agent_runs FOR SELECT USING (true);
CREATE POLICY "runs insert" ON public.agent_runs FOR INSERT TO authenticated WITH CHECK (true);

INSERT INTO public.rule_precision (rule_key,label,precision,sample_size) VALUES
 ('shared_device_ring','Shared device/IP collusion ring',0.972,412),
 ('reciprocal_loop','Reciprocal buyer-seller order loop',0.961,288),
 ('pod_anomaly','Delivery scan / POD anomaly',0.934,530),
 ('refund_abuse','Refund claim abuse velocity',0.917,644),
 ('rating_inflation','Rating self-inflation',0.889,301),
 ('velocity_spike','New-actor velocity spike',0.742,910);
