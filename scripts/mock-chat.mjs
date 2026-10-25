#!/usr/bin/env node
// Local stand-in for the resume-agent /chat backend (which rejects localhost via
// CORS). Same contract: POST {message, conversation_id?} → SSE `data: {"text"}`
// chunks, then a final {conversation_id, message_id, citations, cards} event; 422/429
// `{error}` bodies. Keywords: "fail" → `{error}` frame, "limit" → 429 chat limit,
// "outage" → 503, "talk"/"call" → booking card, "cv" → CV card, "email" → handoff
// chip, "budget" → daily-budget fallback, "badvote" → answer whose votes 404.
// POST /feedback {message_id, rating}: 200 for ids issued here, 404 / 422 otherwise.
// GET /insights: fixed 30-day sample (cost null, gap days) for the /insights page.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = 8787;
const LIMIT_PER_MINUTE = 10;
const hits = [];
const answers = new Set(); // message_ids that can be voted on

const BOOKING = {
  type: "booking",
  label: "Book a call with Nicolas",
  url: "https://calendar.google.com/",
};
const CV = {
  type: "cv",
  label: "Download CV (EN)",
  url: "https://niconisoria.github.io/resume/",
  language: "en",
};

function feedback(req, res) {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    let body = {};
    try {
      body = JSON.parse(raw);
    } catch {
      // fall through to validation
    }
    if (body.rating !== 1 && body.rating !== -1)
      return send(res, 422, { error: "Rating must be 1 (👍) or -1 (👎)." });
    if (!answers.has(body.message_id))
      return send(res, 404, { error: "Answer not found." });
    send(res, 200, { status: "saved" });
  });
}

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};

const today = new Date();
const daysAgo = (n) =>
  new Date(today.getTime() - n * 86_400_000).toISOString().slice(0, 10);
const INSIGHTS = {
  window_days: 30,
  generated_at: today.toISOString(),
  days: [
    { date: daysAgo(12), conversations: 2, messages: 5 },
    { date: daysAgo(4), conversations: 4, messages: 11 },
    { date: daysAgo(0), conversations: 3, messages: 7 },
  ],
  resolution: { conversations: 9, escalated: 1, resolved_share: 0.889 },
  feedback: { up: 2, down: 1, up_share: 0.667 },
  topics: [
    ["skills", 8, 1],
    ["experience", 6, 0],
    ["ai_work", 4, 2],
    ["projects", 3, 0],
    ["logistics", 1, 0],
    ["availability", 1, 0],
    ["other", 0, 0],
    ["out_of_scope", 0, 0],
  ].map(([topic, messages, no_hits]) => ({ topic, messages, no_hits })),
  p95_latency_ms: 3949,
  cost_per_conversation_usd: null,
  blocked: { rate_limited: 2, budget_exceeded: 0 },
};

createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.writeHead(200).end();
  if (req.method === "GET" && req.url === "/insights")
    return send(res, 200, INSIGHTS);
  if (req.method === "POST" && req.url === "/feedback")
    return feedback(req, res);
  if (req.method !== "POST" || req.url !== "/chat")
    return send(res, 404, { error: "Not found." });

  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", async () => {
    const now = Date.now();
    while (hits.length && now - hits[0] > 60_000) hits.shift();
    if (hits.length >= LIMIT_PER_MINUTE) {
      const wait = Math.ceil((60_000 - (now - hits[0])) / 1000);
      return send(
        res,
        429,
        { error: `Too many messages. Please try again in ${wait} seconds.` },
        { "Retry-After": String(wait) },
      );
    }
    hits.push(now);

    let message = "";
    let conversationId;
    try {
      ({ message = "", conversation_id: conversationId } = JSON.parse(raw));
    } catch {
      // fall through to validation
    }
    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 1000
    ) {
      return send(res, 422, {
        error: "Message must be between 1 and 1000 characters.",
      });
    }

    if (/limit/i.test(message)) {
      return send(res, 429, {
        error:
          "This chat reached its 20-message limit. Please start a new one.",
      });
    }
    if (/outage/i.test(message)) {
      return send(res, 503, {
        error: "Chat is temporarily unavailable. Please try again later.",
      });
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    });
    if (/budget/i.test(message)) {
      res.write(
        `data: ${JSON.stringify({ text: "Nicolas's assistant is resting for today. You can book a call with him or grab his CV below." })}\n\n`,
      );
      res.write(
        `data: ${JSON.stringify({ conversation_id: conversationId ?? null, message_id: null, citations: [], cards: [BOOKING, CV] })}\n\n`,
      );
      return res.end();
    }
    const reply = `Mock reply to "${message}". Nicolas built real-time features with WebSockets at Vention [1].`;
    for (const word of reply.split(/(?<= )/)) {
      res.write(`data: ${JSON.stringify({ text: word })}\n\n`);
      await new Promise((r) => setTimeout(r, 40));
    }
    const failed = /fail/i.test(message);
    if (failed) {
      res.write(
        `data: ${JSON.stringify({ error: "Sorry, something went wrong while answering. Please try again." })}\n\n`,
      );
    }
    const cards = [];
    if (/talk|call/i.test(message)) cards.push(BOOKING);
    if (/cv/i.test(message)) cards.push(CV);
    if (/email/i.test(message))
      cards.push({
        type: "handoff",
        label: "Nicolas will follow up by email",
        issue: 42,
      });
    const messageId = failed ? null : randomUUID();
    if (messageId && !/badvote/i.test(message)) answers.add(messageId);
    const final = {
      conversation_id: conversationId ?? randomUUID(),
      message_id: messageId,
      citations: [
        {
          title: "Vention — Senior Software Engineer",
          path: "roles/vention.md",
        },
      ],
      cards,
    };
    res.write(`data: ${JSON.stringify(final)}\n\n`);
    res.end();
  });
}).listen(PORT, () =>
  console.log(`mock /chat on http://localhost:${PORT}/chat`),
);
