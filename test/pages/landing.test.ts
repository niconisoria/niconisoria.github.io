import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import Landing from "../../src/pages/index.astro";

async function render() {
  const container = await AstroContainer.create();
  return container.renderToString(Landing);
}

describe("landing page", () => {
  it("uses a phone-width viewport, not the CV's fixed 1024px one", async () => {
    const html = await render();
    expect(html).toContain('content="width=device-width, initial-scale=1"');
  });

  it("shows tagline and summary line", async () => {
    const html = await render();
    expect(html).toContain("Senior Software Engineer");
    expect(html).toContain(
      "From whiteboard to production, and everything in between",
    );
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*>\s*⚡\s*<\/span>/);
  });

  it("splits the name into word spans for the reveal", async () => {
    const html = await render();
    expect(html).toMatch(
      /<h1[^>]*>(?:(?!<\/h1>).)*<span[^>]*data-word[^>]*>Nicolas<\/span>(?:(?!<\/h1>).)*<span[^>]*data-word[^>]*>Nisoria<\/span>/s,
    );
  });

  it("puts tagline and name in the grain hero, starting in fallback state", async () => {
    const html = await render();
    const hero = html.match(
      /<header[^>]*data-grain-state="fallback"[^>]*>.*?<\/header>/s,
    )?.[0];
    expect(hero).toBeDefined();
    expect(hero).toContain("Senior Software Engineer");
    expect(hero).toContain("Nicolas");
    expect(hero).not.toContain("From whiteboard");
    expect(hero).not.toContain('href="/resume/"');
  });

  it("links View CV to /resume/ and keeps GitHub, LinkedIn, booking", async () => {
    const html = await render();
    expect(html).toMatch(
      /<a[^>]*href="\/resume\/"[^>]*>(?:(?!<\/a>).)*?View CV/s,
    );
    expect(html).toContain('href="https://github.com/niconisoria"');
    expect(html).toContain('href="https://linkedin.com/in/niconisoria"');
    expect(html).toContain('href="https://calendar.google.com/');
  });

  it("puts the chat widget in the #chat section, below the links", async () => {
    const html = await render();
    expect(html).toMatch(/<section[^>]*id="chat"[^>]*>.*?<deep-chat/s);
    expect(html.indexOf('id="chat"')).toBeGreaterThan(
      html.indexOf('aria-label="Links"'),
    );
  });

  it("has the theme toggle but no monogram and no language toggle", async () => {
    const html = await render();
    expect(html).toContain('id="theme-toggle"');
    expect(html).not.toMatch(/>\s*NN\s*</);
    expect(html).not.toContain('id="lang-toggle"');
    expect(html).not.toContain("MSc Systems Engineering");
  });
});
