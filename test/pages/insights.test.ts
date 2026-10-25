import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Insights from "../../src/pages/insights.astro";

async function render() {
  const container = await AstroContainer.create();
  return container.renderToString(Insights);
}

describe("insights page", () => {
  it("shows a live status line while loading", async () => {
    const html = await render();
    expect(html).toMatch(/<p[^>]*role="status"[^>]*>\s*Loading/);
  });

  it("has every metric section", async () => {
    const html = await render();
    for (const heading of [
      "Conversations per day",
      "Topics",
      "Resolution",
      "Feedback",
      "Performance",
      "Blocked requests",
    ])
      expect(html).toContain(heading);
  });

  it("labels both charts for screen readers", async () => {
    const html = await render();
    expect(html).toMatch(/<canvas[^>]*id="days-chart"[^>]*aria-label=/);
    expect(html).toMatch(/<canvas[^>]*id="topics-chart"[^>]*aria-label=/);
  });
});
