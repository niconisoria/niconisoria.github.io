---
title: Widget citations and cards
status: implemented
refs: [20261022210345_landing_chat_widget.md]
---

## Brainstorm

Widget shows only streamed text; drops backend final event (`conversation_id`, `citations`, `cards`). Follow-ups lose context, no sources, no booking/CV actions. resume-agent S10.

Scope: read final SSE event (no text) without empty/broken bubble. Keep `conversation_id` in memory, send with each follow-up; "New chat" button in dialog header clears messages + id. "Sources" list (citation titles, not linked) under answer; strip `[n]` markers (not aligned with citations). Cards (booking, CV) as links under answer text, card `url` only, new tab `rel="noopener"`. 422/429/503 + `{error}` show server text; 20-message limit suggests new chat. Mock server follows new contract. Widget public after live checks.

Constraints: `../resume-agent` untouched (contract changes via that session). Backend cards (S09) not deployed yet; citations + `conversation_id` live. No 👍/👎 (S13). Model may say "button above/below": cards sit directly under answer text.

Related: [Landing chat widget](20261022210345_landing_chat_widget.md)

## Story

As visitor, want sources, quick actions and follow-ups in chat, so trust answers and reach Nicolas fast.

AC:

1. answer with sources shows "Sources" list of titles under it, not linked
2. `[1]`-style markers never shown in answer text
3. booking and CV actions show as buttons under answer text, open their link in new tab
4. follow-up question answered in context of earlier messages
5. "New chat" button in chat header clears messages and starts fresh conversation
6. no empty or broken message bubble after reply ends
7. 422, 429, 503 and mid-reply failures show server's message text
8. 20-message limit message offers new chat
9. sources and buttons readable in dark and light themes, at phone width

## Design

### Flow

```mermaid
flowchart LR
    A([visitor sends message]) --> B[chatRequest: message + conversation_id if known; reset reply state]
    B --> C{200 SSE?}
    C -->|no: 422 / 429 / 503| E([error bubble: server error string])
    C -->|yes| D[chatResponse per event]
    D -->|text| F[strip markers, hold split '[n' tail, append to bubble]
    D -->|error| E
    D -->|final| G[store conversation_id, stash citations + cards, flush tail]
    G --> H[stream closes, Deep Chat fires message event]
    H --> I([addMessage html bubble: Sources + card links under answer])
    E -.-> N([New chat button: clearMessages, drop conversation_id])
```

### Data

request: `{ message: string, conversation_id?: string }` (id omitted until first final event)
final event: `{ conversation_id: string, message_id: string | null, citations: {title, path}[], cards: {type: "booking" | "cv", label, url, language?}[] }`, no `text`
extras html: `<ul class="chat-sources">` titles (escaped, not linked) + `<a class="chat-card" target="_blank" rel="noopener">` per card (label escaped, `url` http(s) only, else card dropped)

### Modules

- `src/lib/chat.ts` — module state (`conversationId`, per-reply tail/flags, pending extras). `chatRequest` adds `conversation_id`, resets reply state. NEW `chatResponse(event)` for Deep Chat `responseInterceptor`: text → markers stripped (`/\[\d+\]/g`), trailing `[` / `[12` held for next chunk; `{error}` passed through, flagged; final → stores id + extras, returns held tail as `{text}` (or the flagged `{error}` again, so Deep Chat keeps error bubble). NEW `takeExtrasHtml()` returns escaped Sources + cards HTML once, `""` when none. NEW `newChat()` drops id + pending extras
- `src/lib/chat.test.ts` — request carries id after final event, omits before; marker strip incl. split across chunks; final event never returns empty bubble content / keeps error; extras HTML escaped, path never rendered, non-http(s) card dropped, `""` when empty; `newChat` drops id
- `src/components/ChatWidget.astro` — `responseInterceptor = chatResponse`; on `message` event (AI, not history) `takeExtrasHtml()` → `chat.addMessage({role: "ai", html})`; `messageStyles.html` transparent bubble; `auxiliaryStyle` for `.chat-sources` (small, muted) and `.chat-card` (pill link, theme vars, wraps at phone width). "New chat" button in dialog header next to close: `newChat()` + `chat.clearMessages()`
- `src/components/ChatWidget.test.ts` — header has labelled "New chat" button
- `scripts/mock-chat.mjs` — new contract: accepts `conversation_id`, sends final event (id reused or new `randomUUID`), citation per reply with `[1]` marker in text, booking card on "talk|call", CV card on "cv", 429 limit text on "limit", 503 on "outage", error frame on "fail" then final event with `message_id: null`
- `docs/specs/20261022210345_landing_chat_widget.md` — untouched (this spec extends it)

[chat.ts](../../src/lib/chat.ts) [chat.test.ts](../../src/lib/chat.test.ts) [ChatWidget.astro](../../src/components/ChatWidget.astro) [ChatWidget.test.ts](../../src/components/ChatWidget.test.ts) [mock-chat.mjs](../../scripts/mock-chat.mjs)

[chat.ts](src/lib/chat.ts) [chat.test.ts](src/lib/chat.test.ts) [ChatWidget.astro](src/components/ChatWidget.astro) [ChatWidget.test.ts](src/components/ChatWidget.test.ts) [mock-chat.mjs](scripts/mock-chat.mjs)

## Summary

`chatResponse` interceptor reads each SSE event: strips `[n]` markers (holding split ones across chunks), stores `conversation_id` and builds escaped Sources + card HTML from final event, never adds bubble for it. Widget adds that HTML as transparent bubble under finished answer; `chatRequest` sends id with follow-ups; header "New chat" clears messages and id. Failed replies keep error bubble, show no sources or cards; replies ending after New chat ignored. Mock server follows new contract; verified headless at phone width, both themes.
