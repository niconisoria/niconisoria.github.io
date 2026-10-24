// Chat with the resume agent (resume-agent repo). The backend takes
// {message, conversation_id?} and streams `data: {"text": ...}` events, then always
// a final event {conversation_id, message_id, citations, cards} with no text (on a
// daily-budget fallback message_id is null, conversation_id too on a new chat). Its `{error}` bodies (422/429/503) and
// `{error}` stream frames surface via `errorMessages.displayServiceErrorMessages`.
// The live backend rejects localhost (CORS), so `astro dev` talks to
// `npm run mock:chat`; PUBLIC_CHAT_URL overrides either default.
export const CHAT_URL: string =
  import.meta.env.PUBLIC_CHAT_URL ??
  (import.meta.env.MODE === "development"
    ? "http://localhost:8787/chat"
    : "https://niconisoria-resume-agent.fly.dev/chat");

export const FEEDBACK_URL = CHAT_URL.replace(/\/chat$/, "/feedback");

export const MAX_CHARS = 1000;

export const STARTER_PROMPTS = [
  "Who is Nicolas?",
  "What did he build at Vention?",
  "What's his tech stack?",
];

interface Citation {
  title: string;
  path: string;
}
interface Card {
  type: string;
  label: string;
  url?: string;
  issue?: number; // handoff ticket
}
interface StreamEvent {
  text?: string;
  error?: string;
  conversation_id?: string | null;
  message_id?: string | null;
  citations?: Citation[];
  cards?: Card[];
}

// One chat per page, kept in memory: Deep Chat's on-screen history doesn't survive a
// reload either, so the backend never remembers more than the visitor can see.
let conversationId: string | undefined;
let tail = ""; // a possibly split ` [12` marker (or trailing space) held for the next chunk
let replyError: string | undefined;
let extras = "";
let replying = false; // false after newChat, so a reply still streaming is dropped

function resetReply() {
  tail = "";
  replyError = undefined;
  extras = "";
}

export function newChat() {
  conversationId = undefined;
  replying = false;
  resetReply();
}

interface RequestDetails {
  body: { messages: { text?: string }[] };
  headers?: Record<string, string>;
}

// Deep Chat requestInterceptor: send only the latest text, and stop over-long
// messages here so the visitor sees why (the server validates again).
export function chatRequest(details: RequestDetails) {
  const text = details.body.messages.at(-1)?.text ?? "";
  if (text.length > MAX_CHARS) {
    return {
      error: `Messages can be up to ${MAX_CHARS.toLocaleString("en")} characters.`,
    };
  }
  resetReply();
  replying = true;
  const body = conversationId
    ? { message: text, conversation_id: conversationId }
    : { message: text };
  return { ...details, body };
}

// `[n]` markers are numbered per reply and don't line up with the de-duplicated
// citations, so they're dropped (with the space before them).
const MARKER = / ?\[\d+\]/g;
const SPLIT_MARKER = / ?(\[\d*)?$/;

// Deep Chat responseInterceptor, called once per SSE event.
export function chatResponse(event: StreamEvent) {
  if (event.error) {
    replyError = event.error;
    return event;
  }
  if ("message_id" in event) {
    if (!replying) return { text: "" };
    replying = false;
    // a budget fallback on a new chat has no id: keep whatever we have
    conversationId = event.conversation_id ?? conversationId;
    // Deep Chat clears the error bubble after each event: hand the error back to keep
    // it (no sources or cards for a failed reply); otherwise append only the held
    // tail, so no new or empty bubble appears.
    if (replyError) return { error: replyError };
    extras = extrasHtml(
      event.citations ?? [],
      event.cards ?? [],
      event.message_id ?? null,
    );
    const rest = tail;
    tail = "";
    return { text: rest };
  }
  const text = (tail + (event.text ?? "")).replace(MARKER, "");
  tail = text.match(SPLIT_MARKER)?.[0] ?? "";
  return { text: text.slice(0, text.length - tail.length) };
}

// Sources + cards of the last reply, once; Deep Chat renders it as a separate
// bubble (one streamed message can't mix text and html).
export function takeExtrasHtml() {
  const html = extras;
  extras = "";
  return html;
}

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot", "'": "#39" }[c]};`,
  );

function cardHtml(card: Card) {
  if (card.type === "handoff") {
    const ticket = Number.isInteger(card.issue)
      ? ` · ticket #${card.issue}`
      : "";
    return `<span class="chat-chip">✓ ${escape(card.label)}${ticket}</span>`;
  }
  return card.url && /^https?:\/\//i.test(card.url)
    ? `<a class="chat-card" href="${escape(card.url)}" target="_blank" rel="noopener">${escape(card.label)}</a>`
    : "";
}

function extrasHtml(
  citations: Citation[],
  cards: Card[],
  messageId: string | null,
) {
  const items = cards.map(cardHtml).join("");
  const sources = citations.map((c) => `<li>${escape(c.title)}</li>`);
  return [
    items ? `<div class="chat-cards">${items}</div>` : "",
    sources.length
      ? `<div class="chat-sources"><p>Sources</p><ul>${sources.join("")}</ul></div>`
      : "",
    messageId
      ? `<div class="chat-feedback" data-message-id="${escape(messageId)}">` +
        `<button type="button" data-rating="1" aria-pressed="false" aria-label="Helpful">👍</button>` +
        `<button type="button" data-rating="-1" aria-pressed="false" aria-label="Not helpful">👎</button>` +
        `<span role="status"></span></div>`
      : "",
  ].join("");
}

const FEEDBACK_ERROR = "Couldn't save your vote. Please try again.";

// 👍/👎 on an answer; voting again replaces the earlier vote server-side.
export async function sendFeedback(
  messageId: string,
  rating: 1 | -1,
): Promise<{ ok: true } | { error: string }> {
  try {
    const res = await fetch(FEEDBACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId, rating }),
    });
    if (res.ok) return { ok: true };
    const { error } = await res.json();
    return { error: typeof error === "string" ? error : FEEDBACK_ERROR };
  } catch {
    return { error: FEEDBACK_ERROR }; // offline, or a non-JSON error page
  }
}
