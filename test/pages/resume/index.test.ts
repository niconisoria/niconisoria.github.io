import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Index from "../../../src/pages/resume/index.astro";

async function render() {
  const container = await AstroContainer.create();
  return container.renderToString(Index);
}

describe("index page", () => {
  it("wires Download PDF to a real, absolute file URL, not the inert placeholder", async () => {
    const html = await render();
    const anchor = html.match(
      /<a[^>]*>(?:(?!<\/a>).)*?Download PDF(?:(?!<\/a>).)*?<\/a>/s,
    )?.[0];
    expect(anchor).toBeDefined();
    const href = anchor?.match(/href="([^"]+)"/)?.[1];
    expect(href).toMatch(/^https:\/\/[^/]+\/resume\/nicolas-nisoria\.pdf$/);
  });

  it("opens the PDF in a new tab", async () => {
    const html = await render();
    const anchor = html.match(
      /<a[^>]*>(?:(?!<\/a>).)*?Download PDF(?:(?!<\/a>).)*?<\/a>/s,
    )?.[0];
    expect(anchor).toContain('target="_blank"');
    expect(anchor).toContain('rel="noopener noreferrer"');
  });

  it("renders both an EN and a PL language block", async () => {
    const html = await render();
    expect(html).toContain('data-lang="en"');
    expect(html).toContain('data-lang="pl"');
  });

  it("keeps the EN/PL language toggle", async () => {
    const html = await render();
    expect(html).toContain('id="lang-toggle"');
  });

  it("marks each language block with its own lang attribute for screen readers", async () => {
    const html = await render();
    expect(html).toMatch(/<div[^>]*data-lang="en"[^>]*lang="en"/);
    expect(html).toMatch(/<div[^>]*data-lang="pl"[^>]*lang="pl"/);
  });

  it("wires the PL block's PDF link to the PL PDF file", async () => {
    const html = await render();
    const anchor = html.match(
      /<a[^>]*>(?:(?!<\/a>).)*?Pobierz PDF(?:(?!<\/a>).)*?<\/a>/s,
    )?.[0];
    expect(anchor).toBeDefined();
    const href = anchor?.match(/href="([^"]+)"/)?.[1];
    expect(href).toMatch(/^https:\/\/[^/]+\/resume\/nicolas-nisoria-pl\.pdf$/);
  });
});
