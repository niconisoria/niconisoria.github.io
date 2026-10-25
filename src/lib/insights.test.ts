import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INSIGHTS_URL,
  TOPIC_LABELS,
  fetchInsights,
  fillDays,
  formatCost,
  formatSeconds,
  formatShare,
} from "./insights";

afterEach(() => vi.unstubAllGlobals());

describe("formatters", () => {
  it("shows — for null", () => {
    expect(formatShare(null)).toBe("—");
    expect(formatSeconds(null)).toBe("—");
    expect(formatCost(null)).toBe("—");
  });

  it("formats share, latency and tiny cost", () => {
    expect(formatShare(0.667)).toBe("67%");
    expect(formatShare(0)).toBe("0%");
    expect(formatSeconds(3949)).toBe("3.9 s");
    expect(formatCost(0.00046)).toBe("$0.00046");
  });
});

describe("fillDays", () => {
  it("covers the whole window ending on generated_at's UTC date, gaps as 0", () => {
    const days = fillDays(
      [{ date: "2026-10-24", conversations: 2, messages: 5 }],
      3,
      "2026-10-25T23:30:00-02:00", // 2026-10-26 in UTC
    );
    expect(days).toEqual([
      { date: "2026-10-24", conversations: 2, messages: 5 },
      { date: "2026-10-25", conversations: 0, messages: 0 },
      { date: "2026-10-26", conversations: 0, messages: 0 },
    ]);
  });

  it("returns an all-zero window for no traffic", () => {
    const days = fillDays([], 30, "2026-10-25T03:00:00+00:00");
    expect(days).toHaveLength(30);
    expect(days[0].date).toBe("2026-09-26");
    expect(days.every((d) => d.conversations === 0)).toBe(true);
  });
});

describe("fetchInsights", () => {
  const stub = (impl: () => Promise<unknown>) =>
    vi.stubGlobal("fetch", vi.fn(impl));

  it("returns data on 200", async () => {
    stub(async () => new Response(JSON.stringify({ days: [] })));
    expect(await fetchInsights()).toEqual({ data: { days: [] } });
    expect(fetch).toHaveBeenCalledWith(INSIGHTS_URL);
  });

  it("treats a 200 that isn't insights JSON as an error", async () => {
    stub(async () => new Response("<html>proxy page</html>"));
    expect(await fetchInsights()).toEqual({
      error: expect.stringMatching(/Couldn't load/),
    });
  });

  it("surfaces the server's error message", async () => {
    stub(
      async () =>
        new Response(JSON.stringify({ error: "Too many requests." }), {
          status: 429,
        }),
    );
    expect(await fetchInsights()).toEqual({ error: "Too many requests." });
  });

  it("falls back to a generic message on non-JSON or network failure", async () => {
    stub(async () => new Response("Bad gateway", { status: 502 }));
    const generic = await fetchInsights();
    expect(generic).toEqual({ error: expect.stringMatching(/Couldn't load/) });
    stub(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await fetchInsights()).toEqual(generic);
  });
});

it("labels all 8 topics and points at /insights", () => {
  expect(Object.keys(TOPIC_LABELS)).toHaveLength(8);
  expect(TOPIC_LABELS.ai_work).toBe("AI work");
  expect(INSIGHTS_URL).toMatch(/\/insights$/);
});
