import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_URL,
  FEEDBACK_URL,
  MAX_CHARS,
  STARTER_PROMPTS,
  chatRequest,
  chatResponse,
  newChat,
  sendFeedback,
  takeExtrasHtml,
} from "./chat";

const final = (extra = {}) => ({
  conversation_id: "c-1",
  message_id: "m-1",
  citations: [],
  cards: [],
  ...extra,
});

beforeEach(() => newChat());

const deepChatBody = (text: string) => ({
  body: { messages: [{ role: "user", text }] },
  headers: { "Content-Type": "application/json" },
});

describe("chatRequest", () => {
  it("maps Deep Chat's messages body to the backend's {message} body", () => {
    expect(chatRequest(deepChatBody("Who is Nicolas?"))).toEqual({
      body: { message: "Who is Nicolas?" },
      headers: { "Content-Type": "application/json" },
    });
  });

  it("allows a message of exactly MAX_CHARS characters", () => {
    const text = "a".repeat(MAX_CHARS);
    expect(chatRequest(deepChatBody(text))).toMatchObject({
      body: { message: text },
    });
  });

  it("blocks longer messages before sending, with the reason", () => {
    const result = chatRequest(deepChatBody("a".repeat(MAX_CHARS + 1)));
    expect(result).toEqual({
      error: "Messages can be up to 1,000 characters.",
    });
  });

  it("passes whitespace through so the server's own validation message shows", () => {
    expect(chatRequest(deepChatBody("   "))).toMatchObject({
      body: { message: "   " },
    });
  });
});

describe("conversation", () => {
  const sent = (text: string) =>
    (chatRequest(deepChatBody(text)) as { body: object }).body;

  it("omits conversation_id until the backend sends one", () => {
    expect(sent("Hi")).toEqual({ message: "Hi" });
  });

  it("sends the conversation_id from the last final event with follow-ups", () => {
    chatRequest(deepChatBody("Hi"));
    chatResponse(final());
    expect(sent("Since when?")).toEqual({
      message: "Since when?",
      conversation_id: "c-1",
    });
  });

  it("starts a fresh conversation after newChat", () => {
    chatRequest(deepChatBody("Hi"));
    chatResponse(final());
    newChat();
    expect(sent("Hello")).toEqual({
      message: "Hello",
    });
  });

  it("ignores a reply that finishes after newChat", () => {
    sent("Hi");
    newChat();
    chatResponse(final({ citations: [{ title: "T", path: "p" }] }));
    expect(sent("Hello")).toEqual({ message: "Hello" });
    expect(takeExtrasHtml()).toBe("");
  });
});

describe("chatResponse", () => {
  const stream = (...events: object[]) => {
    chatRequest(deepChatBody("Q"));
    return events.map((event) => chatResponse(event));
  };

  it("strips citation markers from the text", () => {
    expect(stream({ text: "Built chat [1] with WebSockets [2]." })).toEqual([
      { text: "Built chat with WebSockets." },
    ]);
  });

  it("strips a marker split across chunks", () => {
    const out = stream(
      { text: "Built chat [" },
      { text: "12] fast." },
      final(),
    );
    expect(out.map((r) => ("text" in r ? r.text : "")).join("")).toBe(
      "Built chat fast.",
    );
  });

  it("drops the space before a marker that arrives in the next chunk", () => {
    const out = stream({ text: "at Vention " }, { text: "[1]." }, final());
    expect(out.map((r) => ("text" in r ? r.text : "")).join("")).toBe(
      "at Vention.",
    );
  });

  it("flushes a held '[' that was not a marker on the final event", () => {
    const out = stream({ text: "Arrays like [" }, final());
    expect(out.map((r) => ("text" in r ? r.text : "")).join("")).toBe(
      "Arrays like [",
    );
  });

  it("passes error frames through as-is", () => {
    expect(stream({ error: "Search failed." })).toEqual([
      { error: "Search failed." },
    ]);
  });

  it("returns the error again on the final event so the error bubble stays", () => {
    const out = stream({ text: "Hi" }, { error: "Search failed." }, final());
    expect(out.at(-1)).toEqual({ error: "Search failed." });
  });

  it("never turns the final event into new bubble content", () => {
    const out = stream({ text: "Hi." }, final());
    expect(out.at(-1)).toEqual({ text: "" });
  });
});

describe("takeExtrasHtml", () => {
  const finish = (extra: object) => {
    chatRequest(deepChatBody("Q"));
    chatResponse({ text: "A" });
    chatResponse(final(extra));
  };

  it("is empty when the reply has no citations, cards or message_id", () => {
    finish({ message_id: null });
    expect(takeExtrasHtml()).toBe("");
  });

  it("lists citation titles under a Sources heading, without links or paths", () => {
    finish({
      citations: [
        {
          title: "Vention — Senior Software Engineer",
          path: "roles/vention.md",
        },
      ],
    });
    const html = takeExtrasHtml();
    expect(html).toContain("Sources");
    expect(html).toContain("Vention — Senior Software Engineer");
    expect(html).not.toContain("roles/vention.md");
    expect(html).not.toMatch(/<a[\s>][^>]*>[^<]*Vention/);
  });

  it("renders cards as new-tab links to their url", () => {
    finish({
      cards: [
        {
          type: "booking",
          label: "Book a call",
          url: "https://cal.example/x?a=1&b=2",
        },
        {
          type: "cv",
          label: "Download CV (PL)",
          url: "https://example.com/cv-pl.pdf",
          language: "pl",
        },
      ],
    });
    const html = takeExtrasHtml();
    expect(html).toMatch(
      /<a [^>]*href="https:\/\/cal\.example\/x\?a=1&amp;b=2"[^>]*target="_blank"[^>]*rel="noopener"[^>]*>Book a call<\/a>/,
    );
    expect(html).toContain(">Download CV (PL)</a>");
  });

  it("escapes titles and labels", () => {
    finish({
      citations: [{ title: "<img src=x onerror=alert(1)>", path: "x" }],
      cards: [{ type: "cv", label: "<b>CV</b>", url: "https://e.com" }],
    });
    const html = takeExtrasHtml();
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;img");
  });

  it("drops cards whose url is not http(s)", () => {
    finish({
      cards: [{ type: "booking", label: "Bad", url: "javascript:alert(1)" }],
      message_id: null,
    });
    expect(takeExtrasHtml()).toBe("");
  });

  it("shows no sources or cards for a reply that failed", () => {
    chatRequest(deepChatBody("Q"));
    chatResponse({ text: "A" });
    chatResponse({ error: "Search failed." });
    chatResponse(final({ citations: [{ title: "T", path: "p" }] }));
    expect(takeExtrasHtml()).toBe("");
  });

  it("hands the extras out once", () => {
    finish({ citations: [{ title: "T", path: "p" }] });
    expect(takeExtrasHtml()).not.toBe("");
    expect(takeExtrasHtml()).toBe("");
  });

  it("drops pending extras on newChat", () => {
    finish({ citations: [{ title: "T", path: "p" }] });
    newChat();
    expect(takeExtrasHtml()).toBe("");
  });
});

describe("chat config", () => {
  it("defaults to the live backend and a 1,000-character limit", () => {
    expect(CHAT_URL).toBe("https://niconisoria-resume-agent.fly.dev/chat");
    expect(MAX_CHARS).toBe(1000);
  });

  it("offers three starter prompts", () => {
    expect(STARTER_PROMPTS).toHaveLength(3);
  });
});

describe("final event with null ids", () => {
  const budget = {
    conversation_id: null,
    message_id: null,
    citations: [],
    cards: [
      { type: "booking", label: "Book a call", url: "https://cal.example" },
      { type: "cv", label: "Download CV (EN)", url: "https://e.com/cv" },
    ],
  };

  it("keeps the stored conversation when the final event has no id", () => {
    chatRequest(deepChatBody("Hi"));
    chatResponse(final());
    chatRequest(deepChatBody("More"));
    chatResponse({ text: "Resting." });
    chatResponse(budget);
    expect(takeExtrasHtml()).toContain("Book a call");
    expect(
      (chatRequest(deepChatBody("Again")) as { body: object }).body,
    ).toEqual({ message: "Again", conversation_id: "c-1" });
  });

  it("renders a budget fallback's cards without thumbs", () => {
    chatRequest(deepChatBody("Hi"));
    const out = chatResponse({ text: "Resting." });
    const last = chatResponse(budget);
    expect([out, last]).toEqual([{ text: "Resting." }, { text: "" }]);
    const html = takeExtrasHtml();
    expect(html).toContain(">Book a call</a>");
    expect(html).toContain(">Download CV (EN)</a>");
    expect(html).not.toContain("data-rating");
  });
});

describe("feedback thumbs", () => {
  const finish = (extra: object) => {
    chatRequest(deepChatBody("Q"));
    chatResponse({ text: "A" });
    chatResponse(final(extra));
    return takeExtrasHtml();
  };

  it("shows 👍/👎 for a saved answer, tied to its message_id", () => {
    const html = finish({ message_id: "m-9" });
    expect(html).toMatch(/<div class="chat-feedback" data-message-id="m-9"/);
    expect(html).toMatch(
      /<button[^>]*data-rating="1"[^>]*aria-pressed="false"/,
    );
    expect(html).toMatch(
      /<button[^>]*data-rating="-1"[^>]*aria-pressed="false"/,
    );
    expect(html).toMatch(/role="status"/);
  });

  it("shows no thumbs when the answer wasn't saved", () => {
    expect(finish({ message_id: "m-1" })).toContain("data-rating");
    expect(finish({ message_id: null })).not.toContain("data-rating");
  });

  it("escapes the message id", () => {
    const html = finish({ message_id: '"><img>' });
    expect(html).toContain('data-message-id="&quot;&gt;&lt;img&gt;"');
    expect(html).not.toContain("<img>");
  });
});

describe("handoff card", () => {
  const finish = (card: object) => {
    chatRequest(deepChatBody("Q"));
    chatResponse({ text: "A" });
    chatResponse(final({ cards: [card] }));
    return takeExtrasHtml();
  };

  it("renders a non-clickable chip with the ticket number", () => {
    const html = finish({
      type: "handoff",
      label: "Nicolas will follow up by email",
      issue: 42,
    });
    expect(html).toContain(
      '<span class="chat-chip">✓ Nicolas will follow up by email · ticket #42</span>',
    );
    expect(html).not.toMatch(/<a[\s>]/);
  });

  it("omits the ticket part when there is no issue number", () => {
    const html = finish({ type: "handoff", label: "Follow-up <soon>" });
    expect(html).toContain(
      '<span class="chat-chip">✓ Follow-up &lt;soon&gt;</span>',
    );
  });
});

describe("sendFeedback", () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubFetch = (impl: () => Promise<Response>) => {
    const fetch = vi.fn(impl);
    vi.stubGlobal("fetch", fetch);
    return fetch;
  };

  it("posts message_id and rating to the feedback endpoint", async () => {
    const fetch = stubFetch(async () =>
      Response.json({ status: "saved" }, { status: 200 }),
    );
    expect(await sendFeedback("m-1", -1)).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(FEEDBACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: "m-1", rating: -1 }),
    });
  });

  it("returns the server's error text", async () => {
    stubFetch(async () =>
      Response.json({ error: "Answer not found." }, { status: 404 }),
    );
    expect(await sendFeedback("m-1", 1)).toEqual({
      error: "Answer not found.",
    });
  });

  it("falls back to a readable error on network failure or odd bodies", async () => {
    const generic = { error: "Couldn't save your vote. Please try again." };
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await sendFeedback("m-1", 1)).toEqual(generic);
    stubFetch(async () => new Response("<html>502</html>", { status: 502 }));
    expect(await sendFeedback("m-1", 1)).toEqual(generic);
  });

  it("targets /feedback next to /chat", () => {
    expect(FEEDBACK_URL).toBe(
      "https://niconisoria-resume-agent.fly.dev/feedback",
    );
  });
});
