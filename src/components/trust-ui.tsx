import { Link } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  FileWarning,
  GitBranch,
  LayoutDashboard,
  Layers,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
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

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: bandClass["critical"]!,
    high: bandClass["high"]!,
    medium: bandClass["medium"]!,
    low: bandClass["low"]!,
    hard: bandClass["critical"]!,
    soft: bandClass["medium"]!,
    info: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${map[severity] ?? map["info"]}`}>
      {severity}
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

export function StateBlock({
  kind,
  title,
  message,
}: {
  kind: "loading" | "error" | "empty";
  title: string;
  message?: string;
}) {
  if (kind === "loading")
    return (
      <div className="panel space-y-2 p-4" role="status" aria-live="polite">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  return (
    <div className={`panel p-8 text-center ${kind === "error" ? "border-destructive/40" : ""}`}>
      <p className={`text-sm font-semibold ${kind === "error" ? "text-destructive" : "text-foreground"}`}>{title}</p>
      {message ? <p className="mt-1 text-xs text-muted-foreground">{message}</p> : null}
    </div>
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

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/cases", label: "Cases", icon: FileWarning, exact: false },
  { to: "/graph", label: "Graph Explorer", icon: GitBranch, exact: false },
  { to: "/appeals", label: "Appeals", icon: ScrollText, exact: false },
  { to: "/metrics", label: "Metrics", icon: Activity, exact: false },
  { to: "/architecture", label: "Architecture", icon: Layers, exact: false },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const { email } = useSession();
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-surface lg:flex">
        <Link to="/" className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="grid size-7 place-items-center rounded bg-primary text-xs font-bold text-primary-foreground">
            TG
          </span>
          <span className="text-sm font-semibold tracking-tight">Trust Graph</span>
        </Link>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.exact }}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{
                className: "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm bg-primary-soft text-primary font-medium",
              }}
            >
              <l.icon className="size-4" aria-hidden />
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" aria-hidden />
            Immutable audit trail
          </div>
          <p className="mt-1">Every action, gate outcome and appeal decision is append-only.</p>
        </div>
      </aside>

      <div className="lg:pl-56">
        <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
          <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
            <Link to="/" className="flex items-center gap-2 lg:hidden">
              <span className="grid size-7 place-items-center rounded bg-primary text-xs font-bold text-primary-foreground">
                TG
              </span>
            </Link>
            <nav className="flex items-center gap-1 overflow-x-auto text-sm lg:hidden">
              {NAV.slice(1).map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="whitespace-nowrap rounded px-2 py-1.5 text-muted-foreground hover:bg-muted"
                  activeProps={{ className: "whitespace-nowrap rounded px-2 py-1.5 bg-primary-soft text-primary font-medium" }}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-xs">
              <span className="hidden items-center gap-1.5 md:flex">
                <span className="size-1.5 rounded-full bg-primary" />
                <span className="text-muted-foreground">India region processing</span>
              </span>
              <span className="hidden items-center gap-1.5 md:flex" title="Engine, database and gateway reachable">
                <span className="size-1.5 rounded-full bg-risk-low" />
                <span className="text-muted-foreground">System operational</span>
              </span>
              <button
                type="button"
                aria-label="Notifications"
                className="rounded border border-border p-1.5 text-muted-foreground hover:bg-muted"
              >
                <Bell className="size-3.5" aria-hidden />
              </button>
              {email ? (
                <span className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary">
                    {email.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="hidden text-muted-foreground sm:inline">{email}</span>
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
    </div>
  );
}
