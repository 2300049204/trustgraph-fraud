import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { RawData } from "@/lib/engine";

export function serverPublicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function pageAll<T>(
  fetcher: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
) {
  const out: T[] = [];
  const size = 1000;
  for (let page = 0; page < 20; page += 1) {
    const { data, error } = await fetcher(page * size, page * size + size - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

let cache: { at: number; data: RawData } | null = null;

export async function loadRawData(): Promise<RawData> {
  if (cache && Date.now() - cache.at < 60_000) return cache.data;
  const sb = serverPublicClient();

  const [actors, orders, fingerprints, events, claims, ratings, labels] = await Promise.all([
    pageAll<never>((f, t) => sb.from("actors").select("id,role,display_name,size_tier,tenure_days,city").range(f, t) as never),
    pageAll<never>((f, t) => sb.from("orders").select("id,buyer_id,seller_id,partner_id,amount,status,created_at").range(f, t) as never),
    pageAll<never>((f, t) => sb.from("order_fingerprints").select("order_id,device_id,ip_address,address_cluster").range(f, t) as never),
    pageAll<never>((f, t) => sb.from("delivery_events").select("order_id,event_type,occurred_at,lat,lng,pod_ok").range(f, t) as never),
    pageAll<never>((f, t) => sb.from("claims").select("order_id,claim_type,amount,status").range(f, t) as never),
    pageAll<never>((f, t) => sb.from("ratings").select("order_id,rater_id,ratee_id,stars").range(f, t) as never),
    pageAll<never>((f, t) => sb.from("fraud_labels").select("actor_id,is_fraud,is_holdout").range(f, t) as never),
  ]);

  const data = { actors, orders, fingerprints, events, claims, ratings, labels } as unknown as RawData;
  cache = { at: Date.now(), data };
  return data;
}
