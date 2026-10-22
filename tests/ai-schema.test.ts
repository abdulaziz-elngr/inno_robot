import { describe, expect, it } from "vitest";

/**
 * The assistant never renders raw model output: every provider answer must parse
 * against `aiResponseSchema` first. An unparsable answer is treated as an error,
 * so these boundaries are safety-relevant.
 */

const valid = {
  message: "The Main Library is open until 10 PM.",
  language: "en",
  intent: "LOCATION_LOOKUP",
  spokenResponse: "The Main Library is open until 10 PM.",
};

describe("aiResponseSchema", () => {
  it("accepts a well-formed provider answer and fills defaults", async () => {
    const { aiResponseSchema } = await import("@/lib/validation/assistant");
    const parsed = aiResponseSchema.parse(valid);

    expect(parsed.intent).toBe("LOCATION_LOOKUP");
    // Defaults keep the client from ever reading undefined.
    expect(parsed.destinationId).toBeNull();
    expect(parsed.requiresConfirmation).toBe(false);
    expect(parsed.unverified).toBe(false);
    expect(parsed.sources).toEqual([]);
  });

  it("accepts an Arabic answer with a navigation destination and confirmation", async () => {
    const { aiResponseSchema } = await import("@/lib/validation/assistant");
    const parsed = aiResponseSchema.parse({
      ...valid,
      message: "المكتبة الرئيسية مفتوحة حتى العاشرة مساءً.",
      language: "ar",
      intent: "NAVIGATION_REQUEST",
      destinationId: "dest-123",
      requiresConfirmation: true,
      sources: ["Library hours"],
    });

    expect(parsed.language).toBe("ar");
    expect(parsed.destinationId).toBe("dest-123");
    expect(parsed.requiresConfirmation).toBe(true);
    expect(parsed.sources).toHaveLength(1);
  });

  it("rejects an empty or oversized message", async () => {
    const { aiResponseSchema } = await import("@/lib/validation/assistant");
    expect(aiResponseSchema.safeParse({ ...valid, message: "" }).success).toBe(false);
    expect(aiResponseSchema.safeParse({ ...valid, message: "x".repeat(4_001) }).success).toBe(false);
  });

  it("rejects an empty spokenResponse (voice would announce nothing)", async () => {
    const { aiResponseSchema } = await import("@/lib/validation/assistant");
    expect(aiResponseSchema.safeParse({ ...valid, spokenResponse: "" }).success).toBe(false);
  });

  it("rejects an unknown language or intent", async () => {
    const { aiResponseSchema } = await import("@/lib/validation/assistant");
    expect(aiResponseSchema.safeParse({ ...valid, language: "fr" }).success).toBe(false);
    expect(aiResponseSchema.safeParse({ ...valid, intent: "MAKE_IT_COFFEE" }).success).toBe(false);
  });

  it("rejects more than 5 sources", async () => {
    const { aiResponseSchema } = await import("@/lib/validation/assistant");
    expect(aiResponseSchema.safeParse({ ...valid, sources: ["a", "b", "c", "d", "e"] }).success).toBe(true);
    expect(aiResponseSchema.safeParse({ ...valid, sources: ["a", "b", "c", "d", "e", "f"] }).success).toBe(false);
  });

  it("treats a totally unparsable model answer as an error", async () => {
    const { aiResponseSchema } = await import("@/lib/validation/assistant");
    // e.g. the model returned prose instead of structured JSON.
    expect(aiResponseSchema.safeParse({ reply: "Sure, here you go!" }).success).toBe(false);
  });
});

describe("chatRequestSchema", () => {
  it("trims messages and rejects blank ones", async () => {
    const { chatRequestSchema } = await import("@/lib/validation/assistant");
    const parsed = chatRequestSchema.parse({ message: "  Where is the library?  ", language: "en" });
    expect(parsed.message).toBe("Where is the library?");
    expect(parsed.confirmNavigation).toBe(false);
    expect(chatRequestSchema.safeParse({ message: "   ", language: "en" }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ message: "", language: "en" }).success).toBe(false);
  });

  it("caps the message at 2000 characters", async () => {
    const { chatRequestSchema } = await import("@/lib/validation/assistant");
    expect(chatRequestSchema.safeParse({ message: "x".repeat(2_000), language: "ar" }).success).toBe(true);
    expect(chatRequestSchema.safeParse({ message: "x".repeat(2_001), language: "ar" }).success).toBe(false);
  });

  it("requires a supported language", async () => {
    const { chatRequestSchema } = await import("@/lib/validation/assistant");
    expect(chatRequestSchema.safeParse({ message: "hi" }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ message: "hi", language: "de" }).success).toBe(false);
  });
});
