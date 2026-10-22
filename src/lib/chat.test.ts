import { describe, expect, it } from "vitest";
import { CHAT_URL, MAX_CHARS, STARTER_PROMPTS, chatRequest } from "./chat";

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

describe("chat config", () => {
  it("defaults to the live backend and a 1,000-character limit", () => {
    expect(CHAT_URL).toBe("https://niconisoria-resume-agent.fly.dev/chat");
    expect(MAX_CHARS).toBe(1000);
  });

  it("offers three starter prompts", () => {
    expect(STARTER_PROMPTS).toHaveLength(3);
  });
});
