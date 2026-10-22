// Chat with the resume agent (resume-agent repo). The backend takes {message} and
// streams `data: {"text": ...}` events, which Deep Chat renders natively; its
// `{error}` bodies (422/429) and `{error}` stream frames surface via
// `errorMessages.displayServiceErrorMessages`.
// The live backend rejects localhost (CORS), so `astro dev` talks to
// `npm run mock:chat`; PUBLIC_CHAT_URL overrides either default.
export const CHAT_URL: string =
  import.meta.env.PUBLIC_CHAT_URL ??
  (import.meta.env.MODE === "development"
    ? "http://localhost:8787/chat"
    : "https://niconisoria-resume-agent.fly.dev/chat");

export const MAX_CHARS = 1000;

export const STARTER_PROMPTS = [
  "Who is Nicolas?",
  "What did he build at Vention?",
  "What's his tech stack?",
];

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
  return { ...details, body: { message: text } };
}
