#!/usr/bin/env node
// Local stand-in for the resume-agent /chat backend (which rejects localhost via
// CORS). Same contract: POST {message, conversation_id?} → SSE `data: {"text"}`
// chunks, then a final {conversation_id, message_id, citations, cards} event; 422/429
// `{error}` bodies. Keywords: "fail" → `{error}` frame, "limit" → 429 chat limit,
// "outage" → 503, "talk"/"call" → booking card, "cv" → CV card.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = 8787;
const LIMIT_PER_MINUTE = 10;
const hits = [];

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.writeHead(200).end();
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
    if (/talk|call/i.test(message))
      cards.push({
        type: "booking",
        label: "Book a call with Nicolas",
        url: "https://calendar.google.com/",
      });
    if (/cv/i.test(message))
      cards.push({
        type: "cv",
        label: "Download CV (EN)",
        url: "https://niconisoria.github.io/resume/",
        language: "en",
      });
    const final = {
      conversation_id: conversationId ?? randomUUID(),
      message_id: failed ? null : randomUUID(),
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
