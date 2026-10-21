import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Ats from "../../../src/pages/resume/ats.astro";

async function render() {
  const container = await AstroContainer.create();
  return container.renderToString(Ats);
}

describe("ats page", () => {
  it("renders the same resume content as the public page", async () => {
    const html = await render();
    expect(html).toContain("Nicolas Nisoria");
    expect(html).toContain("Senior Software Engineer");
    expect(html).toContain("Vention");
    expect(html).toContain("MSc Systems Engineering");
  });

  it("stacks the Experience job header (ATS-safe reading order)", async () => {
    const html = await render();
    expect(html).toContain('class="flex flex-col items-start gap-1"');
    expect(html).not.toContain("justify-between");
  });

  it("wires Download PDF to its own file, separate from the public PDF", async () => {
    const html = await render();
    const anchor = html.match(
      /<a[^>]*>(?:(?!<\/a>).)*?Download PDF(?:(?!<\/a>).)*?<\/a>/s,
    )?.[0];
    expect(anchor).toBeDefined();
    const href = anchor?.match(/href="([^"]+)"/)?.[1];
    expect(href).toMatch(/^https:\/\/[^/]+\/resume\/nicolas-nisoria-ats\.pdf$/);
  });

  it("renders both an EN and a PL language block", async () => {
    const html = await render();
    expect(html).toContain('data-lang="en"');
    expect(html).toContain('data-lang="pl"');
  });

  it("wires the PL block's PDF link to the ATS PL PDF file", async () => {
    const html = await render();
    const anchor = html.match(
      /<a[^>]*>(?:(?!<\/a>).)*?Pobierz PDF(?:(?!<\/a>).)*?<\/a>/s,
    )?.[0];
    expect(anchor).toBeDefined();
    const href = anchor?.match(/href="([^"]+)"/)?.[1];
    expect(href).toMatch(
      /^https:\/\/[^/]+\/resume\/nicolas-nisoria-ats-pl\.pdf$/,
    );
  });
});
