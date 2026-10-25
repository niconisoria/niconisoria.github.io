// Public 30-day numbers from the resume agent's `GET /insights` (counts only).
// Non-200 bodies are `{error}` (429 rate limit, 503 DB down). Like /chat, the live
// API rejects localhost (CORS), so `astro dev` reads `npm run mock:chat`.
import { CHAT_URL } from "./chat";

export const INSIGHTS_URL: string =
  import.meta.env.PUBLIC_INSIGHTS_URL ??
  CHAT_URL.replace(/\/chat$/, "/insights");

export interface Day {
  date: string; // YYYY-MM-DD, UTC
  conversations: number;
  messages: number;
}
export interface Insights {
  window_days: number;
  generated_at: string;
  days: Day[];
  resolution: {
    conversations: number;
    escalated: number;
    resolved_share: number | null;
  };
  feedback: { up: number; down: number; up_share: number | null };
  topics: { topic: string; messages: number; no_hits: number }[];
  p95_latency_ms: number | null;
  cost_per_conversation_usd: number | null;
  blocked: { rate_limited: number; budget_exceeded: number };
}

export const TOPIC_LABELS: Record<string, string> = {
  experience: "Experience",
  skills: "Skills",
  projects: "Projects",
  ai_work: "AI work",
  availability: "Availability",
  logistics: "Logistics",
  out_of_scope: "Out of scope",
  other: "Other",
};

const NONE = "—";
const GENERIC_ERROR = "Couldn't load insights. Please try again later.";

export const formatShare = (v: number | null) =>
  v === null ? NONE : `${Math.round(v * 100)}%`;

export const formatSeconds = (ms: number | null) =>
  ms === null ? NONE : `${(ms / 1000).toFixed(1)} s`;

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumSignificantDigits: 2,
});
export const formatCost = (v: number | null) =>
  v === null ? NONE : usd.format(v);

export const formatUpdated = (iso: string) =>
  `Updated ${new Date(iso).toLocaleString()}`;

// API lists only days with traffic; the chart wants every day in the window.
export function fillDays(days: Day[], windowDays: number, generatedAt: string) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const end = new Date(generatedAt);
  return Array.from({ length: windowDays }, (_, i) => {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - (windowDays - 1 - i));
    const date = day.toISOString().slice(0, 10);
    return byDate.get(date) ?? { date, conversations: 0, messages: 0 };
  });
}

export async function fetchInsights(): Promise<
  { data: Insights } | { error: string }
> {
  try {
    const res = await fetch(INSIGHTS_URL);
    const body = await res.json().catch(() => ({}));
    // ponytail: shape check is `days` only; full schema validation if the API grows
    if (res.ok && Array.isArray(body.days)) return { data: body };
    return {
      error: typeof body.error === "string" ? body.error : GENERIC_ERROR,
    };
  } catch {
    return { error: GENERIC_ERROR };
  }
}
