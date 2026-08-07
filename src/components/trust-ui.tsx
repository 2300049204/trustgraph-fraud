import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export function riskBand(score: number) {
  if (score >= 80) return { key: "critical", label: "Critical" } as const;
  if (score >= 62) return { key: "high", label: "High" } as const;
  if (score >= 42) return { key: "medium", label: "Medium" } as const;
  return { key: "low", label: "Low" } as const;
}

const bandClass: Record<string, string> = {
  critical: "bg-risk-critical-soft text-risk-critical",
  high: "bg-risk-high-soft text-risk-high",
  medium: "bg-risk-medium-soft text-risk-medium",
  low: "bg-risk-low-soft text-risk-low",
};

export function RiskPill({ score, showLabel = true }: { score: number; showLabel?: boolean }) {
  const band = riskBand(score);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${bandClass[band.key]}`}
    >
      <span className="num">{score.toFixed(0)}</span>
      {showLabel ? <span className="font-medium opacity-80">{band.label}</span> : null}
    </span>
  );
}

export function Tag({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "teal" | "blue" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    teal: "bg-primary-soft text-primary",
    blue: "bg-accent-soft text-accent",
  };
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

export function SlaClock({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const diff = new Date(deadline).getTime() - now;
  const overdue = diff < 0;
  const hrs = Math.floor(Math.abs(diff) / 3600_000);
  const mins = Math.floor((Math.abs(diff) % 3600_000) / 60000);
  return (
    <span
      className={`num text-xs font-semibold ${overdue ? "text-destructive" : hrs < 6 ? "text-risk-high" : "text-muted-foreground"}`}
      title={new Date(deadline).toLocaleString("en-IN")}
    >
      {overdue ? "escalated · " : ""}
      {hrs}h {mins}m {overdue ? "over" : "left"}
    </span>
  );
}

export function useSession() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { email, ready, signedIn: Boolean(email) };
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { email } = useSession();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded bg-primary text-primary-foreground text-xs font-bold">
              TG
            </span>
            <span className="text-sm font-semibold tracking-tight">Trust Graph</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {[
              { to: "/console", label: "Console" },
              { to: "/metrics", label: "Metrics" },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{ className: "rounded px-2.5 py-1.5 bg-primary-soft text-primary font-medium" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="size-1.5 rounded-full bg-primary" />
              <span className="text-muted-foreground">India region processing</span>
            </span>
            {email ? (
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">{email}</span>
                <button
                  className="rounded border border-border px-2 py-1 hover:bg-muted"
                  onClick={() => supabase.auth.signOut()}
                >
                  Sign out
                </button>
              </span>
            ) : (
              <Link to="/auth" className="rounded bg-primary px-3 py-1.5 font-medium text-primary-foreground">
                Investigator sign-in
              </Link>
            )}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
