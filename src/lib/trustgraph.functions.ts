import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const fetchQueue = createServerFn({ method: "GET" }).handler(async () => {
  const { getQueue } = await import("@/lib/pipeline.server");
  return getQueue();
});

export const fetchCase = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { getCaseDetail } = await import("@/lib/pipeline.server");
    return getCaseDetail(data.caseId);
  });

export const fetchAppealView = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { getAppealView } = await import("@/lib/pipeline.server");
    return getAppealView(data.caseId);
  });

export const fetchMetrics = createServerFn({ method: "GET" }).handler(async () => {
  const { getMetrics } = await import("@/lib/pipeline.server");
  return getMetrics();
});

export const explainCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { runExplainer } = await import("@/lib/pipeline.server");
    return runExplainer(data.caseId);
  });

export const planRemediation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { runPlanner } = await import("@/lib/pipeline.server");
    return runPlanner(data.caseId);
  });

export const selfCheckCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ caseId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { runReviewer } = await import("@/lib/pipeline.server");
    return runReviewer(data.caseId);
  });

export const applyAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        action: z.enum(["monitor", "step_up_verify", "payout_hold", "payout_freeze", "suspend"]),
        ruleKey: z.string().min(1).max(64),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { takeAction } = await import("@/lib/pipeline.server");
    return takeAction({ ...data, userId: context.userId });
  });

export const fileAppeal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        statement: z.string().trim().min(20).max(4000),
        evidenceNote: z.string().trim().max(2000).optional(),
        contactEmail: z.string().trim().email().max(255).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { submitAppeal } = await import("@/lib/pipeline.server");
    return submitAppeal({
      caseId: data.caseId,
      statement: data.statement,
      evidenceNote: data.evidenceNote,
      contactEmail: data.contactEmail || undefined,
    });
  });

export const resolveAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        appealId: z.string().uuid(),
        outcome: z.enum(["upheld", "overturned"]),
        note: z.string().trim().max(1000).default("Reviewed by investigator."),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { decideAppeal } = await import("@/lib/pipeline.server");
    return decideAppeal(data);
  });
