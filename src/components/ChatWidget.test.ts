import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import ChatWidget from "./ChatWidget.astro";

async function render() {
  const container = await AstroContainer.create();
  return container.renderToString(ChatWidget);
}

describe("ChatWidget", () => {
  it("keeps Deep Chat inside a closed dialog", async () => {
    const html = await render();
    const dialog = html.match(/<dialog[^>]*>.*?<\/dialog>/s)?.[0];
    expect(dialog).toBeDefined();
    expect(dialog).toMatch(/<deep-chat[^>]*>/);
    expect(dialog?.match(/<dialog[^>]*>/)?.[0]).not.toMatch(/\sopen[\s>=]/);
  });

  it("shows an 'Ask about Nicolas…' button on the page to open the chat", async () => {
    const html = await render();
    const outside = html.replace(/<dialog[^>]*>.*?<\/dialog>/s, "");
    expect(outside).toMatch(
      /<button[^>]*type="button"[^>]*data-chat-open[^>]*>.*?Ask about Nicolas…/s,
    );
  });

  it("renders three starter prompt buttons outside the dialog", async () => {
    const html = await render();
    const outside = html.replace(/<dialog[^>]*>.*?<\/dialog>/s, "");
    expect(outside.match(/<button[^>]*data-starter[^>]*>/g) ?? []).toHaveLength(
      3,
    );
    expect(outside).toContain("Who is Nicolas?");
  });

  it("names the dialog by its visible title", async () => {
    const html = await render();
    const labelledBy = html.match(/<dialog[^>]*aria-labelledby="([^"]+)"/)?.[1];
    expect(labelledBy).toBeDefined();
    expect(html).toMatch(
      new RegExp(
        `<h2[^>]*id="${labelledBy}"[^>]*>\\s*Explore Nicolas's career`,
      ),
    );
  });

  it("closes natively via a dialog form with a labelled button", async () => {
    const html = await render();
    expect(html).toMatch(
      /<form[^>]*method="dialog"[^>]*>.*?<button[^>]*aria-label="Close chat"/s,
    );
  });

  it("offers a labelled New chat button in the chat header", async () => {
    const html = await render();
    const dialog = html.match(/<dialog[^>]*>.*?<\/dialog>/s)?.[0];
    expect(dialog).toMatch(
      /<button[^>]*type="button"[^>]*data-chat-new[^>]*>\s*New chat\s*<\/button>/,
    );
  });

  it("shows the one-line privacy notice in the chat", async () => {
    const html = await render();
    const dialog = html.match(/<dialog[^>]*>.*?<\/dialog>/s)?.[0];
    expect(dialog).toContain(
      "Messages are logged anonymously to improve answers. Don't share personal data.",
    );
  });
});
