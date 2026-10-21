import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Landing from "../../src/pages/index.astro";

async function render() {
  const container = await AstroContainer.create();
  return container.renderToString(Landing);
}

describe("landing page", () => {
  it("shows name and tagline", async () => {
    const html = await render();
    expect(html).toContain("Nicolas Nisoria");
    expect(html).toContain("Senior Software Engineer");
  });

  it("links to the CV at /resume/", async () => {
    const html = await render();
    expect(html).toMatch(/<a[^>]*href="\/resume\/"[^>]*>(?:(?!<\/a>).)*?CV/s);
  });

  it("links to GitHub, LinkedIn and the booking calendar", async () => {
    const html = await render();
    expect(html).toContain('href="https://github.com/niconisoria"');
    expect(html).toContain('href="https://linkedin.com/in/niconisoria"');
    expect(html).toContain('href="https://calendar.google.com/');
  });

  it("has an empty placeholder section for the future chat widget", async () => {
    const html = await render();
    expect(html).toMatch(/<section[^>]*id="chat"[^>]*>\s*<\/section>/);
  });

  it("is EN-only: no CV content, no language toggle", async () => {
    const html = await render();
    expect(html).not.toContain("Vention");
    expect(html).not.toContain('id="lang-toggle"');
  });
});
