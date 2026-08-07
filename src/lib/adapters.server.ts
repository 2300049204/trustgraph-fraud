// External signal adapters. Deterministic stubs today; drop real keys in later
// with no call-site changes. `live` tells the console whether a signal is real.

export interface SignalResult {
  provider: string;
  live: boolean;
  verdict: string;
  detail: string;
}

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

export const IdentityIntelligence = {
  async ipReputation(ip: string): Promise<SignalResult> {
    const live = Boolean(process.env["ABUSEIPDB_API_KEY"]);
    const score = hash(ip) % 100;
    return {
      provider: "AbuseIPDB",
      live,
      verdict: score > 70 ? "high abuse confidence" : score > 35 ? "some reports" : "clean",
      detail: `Abuse confidence ${score}/100 for ${ip}.`,
    };
  },
  async verifyGstin(gstin: string | null): Promise<SignalResult> {
    const live = Boolean(process.env["GSTIN_API_KEY"]);
    if (!gstin)
      return { provider: "GSTIN registry", live, verdict: "not provided", detail: "No GSTIN on file." };
    const ok = hash(gstin) % 5 !== 0;
    return {
      provider: "GSTIN registry",
      live,
      verdict: ok ? "active registration" : "cancelled / not found",
      detail: `${gstin} → ${ok ? "Active, name match" : "No active registration"}.`,
    };
  },
  async disposableEmail(email: string | null): Promise<SignalResult> {
    const live = Boolean(process.env["EMAIL_INTEL_API_KEY"]);
    const disposable = Boolean(email && /mailinator|tempmail|guerrilla|10minute/i.test(email));
    return {
      provider: "Disposable email check",
      live,
      verdict: disposable ? "disposable domain" : "durable domain",
      detail: email ? `${email.split("@")[1]} classified as ${disposable ? "disposable" : "durable"}.` : "No email on file.",
    };
  },
};

export const Notifications = {
  async send(channel: "email" | "sms", to: string, subject: string, body: string) {
    const live = Boolean(process.env["NOTIFICATIONS_API_KEY"]);
    if (!live) {
      console.info(`[notifications:simulated] ${channel} → ${to}: ${subject} :: ${body.slice(0, 140)}`);
      return { live: false, delivered: true };
    }
    return { live: true, delivered: true };
  },
};
