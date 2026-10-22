#!/usr/bin/env node
// Local stand-in for the resume-agent /chat backend (which rejects localhost via
// CORS). Same contract: POST {message} → SSE `data: {"text"}` chunks; 422/429
// `{error}` bodies; a final `data: {"error"}` frame when the message contains "fail".
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
    try {
      message = JSON.parse(raw).message ?? "";
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

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    });
    const reply = `Mock reply to "${message}". Nicolas is a senior software engineer who builds large-scale systems end to end.`;
    for (const word of reply.split(/(?<= )/)) {
      res.write(`data: ${JSON.stringify({ text: word })}\n\n`);
      await new Promise((r) => setTimeout(r, 40));
    }
    if (/fail/i.test(message)) {
      res.write(
        `data: ${JSON.stringify({ error: "Sorry, something went wrong while answering. Please try again." })}\n\n`,
      );
    }
    res.end();
  });
}).listen(PORT, () =>
  console.log(`mock /chat on http://localhost:${PORT}/chat`),
);
