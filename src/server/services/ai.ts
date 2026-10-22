import { eq } from "drizzle-orm";
import { ApiError } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { campusLocations, navigationDestinations } from "@/server/db/schema";
import { aiResponseSchema, type AIResponse, type AIStatus, type ChatRequest } from "@/lib/validation/assistant";
import { appendMessage, getOrCreateConversation, getRecentMessages } from "./conversations";
import { countPublishedKnowledge, searchPublishedKnowledge } from "./knowledge";
import { getNavigationRoute } from "./commands";
import { resolveLocationMention } from "./locations";
import { getSettings } from "./settings";

export type AIOrigin = "provider" | "knowledge-fallback" | "unconfigured" | "error";

export type AssistantResult = {
  response: AIResponse;
  origin: AIOrigin;
  conversationId: string;
  /** Number of published knowledge entries included as context. */
  contextItems: number;
};

const MESSAGES = {
  ar: {
    disabled: "المساعد متوقف مؤقتاً بطلب من إدارة الجامعة.",
    unconfigured:
      "مساعد الذكاء الاصطناعي لم يتم ربطه بعد. يمكنني عرض المعلومات المنشورة من دليل الجامعة، وللتفعيل الكامل يرجى ضبط مفتاح الخدمة من لوحة الإدارة.",
    unavailable: "تعذّر الوصول لخدمة الذكاء الاصطناعي الآن. جرّب مرة أخرى بعد قليل أو اسأل عن إحدى المواقع المنشورة.",
    unverified: "لم أتمكن من تأكيد هذه المعلومة من مصادر الجامعة الرسمية.",
    humanHelp: "يمكنني تحويلك لمكتب خدمة الطلاب أو المساعدة البشرية.",
  },
  en: {
    disabled: "The assistant is temporarily disabled by the university administration.",
    unconfigured:
      "The AI assistant is not connected yet. I can still answer from the published university directory; enable it by setting the provider key in the admin settings.",
    unavailable: "I can't reach the AI service right now. Please try again shortly, or ask about one of the published campus locations.",
    unverified: "I could not confirm this from official university sources.",
    humanHelp: "I can point you to the student services desk for human assistance.",
  },
} as const;

export type Language = keyof typeof MESSAGES;

/* ── Provider configuration ─────────────────────────────────────────────────── */

export type AIConfig = {
  configured: boolean;
  apiKey: string | null;
  model: string | null;
  baseUrl: string;
  provider: string;
  timeoutMs: number;
  maxTokens: number;
  contextTurns: number;
};

/** Reads provider configuration strictly from the server environment. */
export function getAIConfig(): AIConfig {
  const apiKey = process.env.AI_API_KEY?.trim() || null;
  const model = process.env.AI_MODEL?.trim() || null;
  const baseUrl = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  let provider = "custom";
  try {
    const host = new URL(baseUrl).hostname;
    provider = host.includes("openai.com") ? "openai" : host.includes("openrouter") ? "openrouter" : host.includes("groq") ? "groq" : host.includes("azure") ? "azure-openai" : host;
  } catch {
    /* keep "custom" */
  }
  return {
    configured: Boolean(apiKey && model),
    apiKey,
    model,
    baseUrl,
    provider,
    timeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 15_000),
    maxTokens: Number(process.env.AI_MAX_TOKENS ?? 600),
    contextTurns: Number(process.env.AI_MAX_CONTEXT_MESSAGES ?? 12),
  };
}

/** Public, secret-free description of the assistant's configuration state. */
export async function getAIStatus(): Promise<AIStatus> {
  const config = getAIConfig();
  return {
    configured: config.configured,
    provider: config.configured ? config.provider : null,
    model: config.configured ? config.model : null,
    knowledgeArticles: await countPublishedKnowledge(),
    fallbackMode: !config.configured,
  };
}

/* ── Abuse prevention (per IP, per day) ─────────────────────────────────────── */

const dailyUsage = new Map<string, { day: string; count: number }>();

export function assertAssistantQuota(ip: string | null): void {
  const limit = Number(process.env.AI_DAILY_LIMIT_PER_IP ?? 60);
  if (!ip || limit <= 0) return;
  const day = new Date().toISOString().slice(0, 10);
  const entry = dailyUsage.get(ip);
  const current = entry && entry.day === day ? entry : { day, count: 0 };
  if (current.count >= limit) {
    throw new ApiError(429, "Daily assistant request limit reached. Please try again tomorrow.", "AI_QUOTA_EXCEEDED");
  }
  current.count += 1;
  dailyUsage.set(ip, current);
}

/* ── Prompt & provider call ─────────────────────────────────────────────────── */

function systemPrompt(language: Language, hasStudent: boolean): string {
  return [
    "You are Inno Robot, a friendly university assistant robot mounted on a campus tablet. You help students with university facilities and information in Arabic (including Egyptian Arabic), and English.",
    hasStudent
      ? "The student standing in front of you has been identified by their university card; you may greet them by first name only."
      : "The student is a guest; do not assume any identity.",
    "STRICT RULES:",
    "1. Only state university facts that appear in the KNOWLEDGE context provided. If it is not there, say you could not confirm it and suggest the help desk. Never invent opening hours, room numbers, fees, rules, or personal student data.",
    "2. Never claim the robot moved, stopped, or is navigating by itself. You may only set intent=NAVIGATION_REQUEST with a destinationId that exists in the DESTINATIONS list.",
    "3. Do not reveal personal data (IDs, grades, addresses, phone numbers, card numbers).",
    "4. Answer in the requested language. Keep answers short enough to speak aloud (max ~60 words).",
    '5. Reply with ONLY a JSON object, no markdown fences, exactly this shape: {"message": string, "language": "ar"|"en", "intent": "GENERAL_QUESTION"|"LOCATION_LOOKUP"|"NAVIGATION_REQUEST"|"UNIVERSITY_INFORMATION"|"STUDENT_INFORMATION"|"HUMAN_ASSISTANCE_REQUEST", "destinationId": string|null, "requiresConfirmation": boolean, "spokenResponse": string, "unverified": boolean, "sources": string[]}',
    `Requested language: ${language}.`,
  ].join("\n");
}

type ProviderMessage = { role: "system" | "user" | "assistant"; content: string };

function buildKnowledgeBlock(hits: Awaited<ReturnType<typeof searchPublishedKnowledge>>): string {
  if (!hits.length) return "KNOWLEDGE: (no verified university content matched this question)";
  return hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.title} (${h.language}${h.categoryName ? `, ${h.categoryName}` : ""})\n${h.content.slice(0, 900)}`,
    )
    .join("\n---\n");
}

async function callProvider(config: AIConfig, messages: ProviderMessage[]): Promise<string> {
  if (!config.apiKey || !config.model) throw new Error("AI provider is not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.3,
        max_tokens: config.maxTokens,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(`Provider responded ${res.status}: ${detail}`);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Provider returned an empty completion");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** Extracts and validates the structured answer; unparsable output is an error, never rendered. */
export function parseAssistantOutput(raw: string, language: Language): AIResponse {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let jsonText = trimmed;
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) jsonText = trimmed.slice(first, last + 1);

  const parsed: unknown = JSON.parse(jsonText);
  const result = aiResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Assistant output failed schema validation: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  const value = result.data;
  return { ...value, language: value.language || language };
}

/* ── Destination safety: the model can only pick real, published destinations ─ */

async function sanitizeDestination(destinationId: string | null, request: ChatRequest): Promise<{ destinationId: string | null; requiresConfirmation: boolean }> {
  if (destinationId) {
    const key = destinationId.trim().toUpperCase();
    const [destination] = await db
      .select({ key: navigationDestinations.key, requiresConfirmation: navigationDestinations.requiresConfirmation, active: navigationDestinations.active })
      .from(navigationDestinations)
      .where(eq(navigationDestinations.key, key))
      .limit(1);
    if (destination?.active) return { destinationId: destination.key, requiresConfirmation: destination.requiresConfirmation };

    const [location] = await db
      .select({ key: campusLocations.key, navigable: campusLocations.navigable })
      .from(campusLocations)
      .where(eq(campusLocations.key, key))
      .limit(1);
    if (location?.navigable) return { destinationId: location.key, requiresConfirmation: true };
  }

  // Fall back to the wording of the question itself, resolved against published locations.
  const mentioned = await resolveLocationMention(request.message, request.language);
  if (mentioned?.navigable && (request.message.includes("؟") || /navigate|direction|how do i get|route|reach|أوصل|أروح|الطريقة/i.test(request.message))) {
    return { destinationId: mentioned.key, requiresConfirmation: true };
  }
  return { destinationId: null, requiresConfirmation: false };
}

/* ── Deterministic knowledge fallback (no model involved) ───────────────────── */

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

async function knowledgeFallback(request: ChatRequest, contextItems: number): Promise<AIResponse> {
  const lang = request.language;
  const t = MESSAGES[lang];
  const location = await resolveLocationMention(request.message, lang);

  if (location) {
    const nav = await getNavigationRoute(location.key);
    const route = nav?.route ?? null;
    const name = lang === "ar" ? location.nameAr : location.nameEn;
    const directions = lang === "ar" ? location.directionsAr : location.directionsEn;
    const description = lang === "ar" ? location.descriptionAr : location.descriptionEn;
    const roomLabel = location.room ? `${lang === "ar" ? "الغرفة" : "Room"} ${location.room}` : "";
    const message = truncate(`${name}${roomLabel ? ` — ${roomLabel}` : ""}. ${directions || description || ""}`.trim(), 600);
    const stepList = route?.steps?.length ? route.steps.map((s) => (lang === "ar" ? s.ar : s.en)) : [];
    const spoken = truncate(stepList.length ? `${name}. ${stepList.slice(0, 2).join(" ")}` : message, 600);
    return {
      message,
      language: lang,
      intent: "LOCATION_LOOKUP",
      destinationId: location.navigable ? location.key : null,
      requiresConfirmation: location.navigable,
      spokenResponse: spoken,
      unverified: false,
      sources: [lang === "ar" ? "دليل الحرم الجامعي المنشور" : "Published campus directory"],
    };
  }

  const hits = await searchPublishedKnowledge({ query: request.message, language: lang, limit: 3 });
  if (hits.length) {
    const hit = hits[0]!;
    const body = truncate(hit.content, 700);
    return {
      message: body,
      language: lang,
      intent: "UNIVERSITY_INFORMATION",
      destinationId: null,
      requiresConfirmation: false,
      spokenResponse: truncate(body, 600),
      unverified: false,
      sources: [hit.title],
    };
  }

  void contextItems;
  const hasConfigured = getAIConfig().configured;
  return {
    message: hasConfigured ? t.unavailable : t.unconfigured,
    language: lang,
    intent: "GENERAL_QUESTION",
    destinationId: null,
    requiresConfirmation: false,
    spokenResponse: hasConfigured ? t.unavailable : t.unconfigured,
    unverified: true,
    sources: [],
  };
}

/* ── Main entry point ───────────────────────────────────────────────────────── */

export async function runAssistant(request: ChatRequest, ctx: { ip?: string | null; studentFirstName?: string | null }): Promise<AssistantResult> {
  const settings = await getSettings();
  if (!settings.assistantEnabled) {
    throw new ApiError(403, MESSAGES[request.language].disabled, "ASSISTANT_DISABLED");
  }

  const conversationId = await getOrCreateConversation({
    conversationId: request.conversationId,
    guestId: request.guestId,
    studentId: request.studentId,
    language: request.language,
  });

  const config = getAIConfig();
  const history = config.contextTurns > 0 && request.conversationId ? await getRecentMessages(conversationId, config.contextTurns) : [];
  const knowledge = await searchPublishedKnowledge({ query: request.message, language: request.language, limit: 5 });
  const location = await resolveLocationMention(request.message, request.language);

  // Knowledge/location context is always available, even without a model.
  const contextItems = knowledge.length + (location ? 1 : 0);

  if (!config.configured) {
    const response = await knowledgeFallback(request, contextItems);
    await appendMessage(conversationId, { role: "USER", content: request.message }, null);
    await appendMessage(conversationId, { role: "ASSISTANT", content: response.message, origin: response.destinationId || knowledge.length ? "knowledge-fallback" : "unconfigured" }, response.intent);
    return { response, origin: response.destinationId || knowledge.length ? "knowledge-fallback" : "unconfigured", conversationId, contextItems };
  }

  const locationContext = location
    ? `MATCHED LOCATION: ${location.key} | ${location.nameEn} / ${location.nameAr} | room=${location.room ?? "-"} | navigable=${location.navigable} | directions: ${location.directionsEn ?? "-"} / ${location.directionsAr ?? "-"}`
    : "MATCHED LOCATION: none";

  const messages: ProviderMessage[] = [
    { role: "system", content: systemPrompt(request.language, Boolean(ctx.studentFirstName)) },
    { role: "system", content: `KNOWLEDGE CONTEXT (published only):\n${buildKnowledgeBlock(knowledge)}\n${locationContext}\nDESTINATIONS: reply only with destinationId values that appear above or in KNOWLEDGE CONTEXT.` },
    ...history.map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.content })),
    { role: "user", content: ctx.studentFirstName ? `Student first name: ${ctx.studentFirstName}\nMessage: ${request.message}` : request.message },
  ];

  await appendMessage(conversationId, { role: "USER", content: request.message }, null);

  let response: AIResponse;
  let origin: AIOrigin;

  try {
    const raw = await callProvider(config, messages);
    response = parseAssistantOutput(raw, request.language);
    const safe = await sanitizeDestination(response.destinationId, request);
    response = { ...response, ...safe };
    if (safe.destinationId) response = { ...response, intent: response.intent === "GENERAL_QUESTION" ? "LOCATION_LOOKUP" : response.intent };
    origin = "provider";
  } catch (error) {
    console.error("[ai] provider call failed:", error instanceof Error ? error.message : error);
    // Never fabricate an answer when the configured provider fails: fall back to the
    // published knowledge base, or report the failure honestly.
    const fallback = await knowledgeFallback(request, contextItems);
    const failed = getAIConfig().configured && !fallback.destinationId && !fallback.sources.length;
    response = failed
      ? {
          ...fallback,
          message: MESSAGES[request.language].unavailable,
          spokenResponse: MESSAGES[request.language].unavailable,
          unverified: true,
        }
      : fallback;
    origin = failed ? "error" : "knowledge-fallback";
  }

  await appendMessage(conversationId, { role: "ASSISTANT", content: response.message, origin }, response.intent);

  // Opportunistic retention pruning keeps conversation data within the configured window.
  if (Math.random() < 0.05) {
    void (await import("./conversations")).pruneConversations(settings.conversationRetentionDays).catch(() => 0);
  }

  return { response, origin, conversationId, contextItems };
}

/** Structured reply used by the demo page before a conversation exists. */
export function greetingFor(language: Language, firstName?: string | null): AIResponse {
  const ar = firstName
    ? `أهلاً ${firstName}! أنا Inno Robot، مساعدك الذكي داخل الجامعة. مرر الكارت الجامعي أو ابدأ المحادثة عشان أساعدك.`
    : "أهلاً بيك! أنا Inno Robot، مساعدك الذكي داخل الجامعة. مرر الكارت الجامعي أو ابدأ المحادثة علشان أساعدك.";
  const en = firstName
    ? `Hello ${firstName}! I'm Inno Robot, your intelligent university assistant. Tap your university card or start a conversation and I'll help you.`
    : "Hello! I'm Inno Robot, your intelligent university assistant. Tap your university card or start a conversation and I'll help you.";
  const message = language === "ar" ? ar : en;
  return {
    message,
    language,
    intent: "GENERAL_QUESTION",
    destinationId: null,
    requiresConfirmation: false,
    spokenResponse: message,
    unverified: false,
    sources: [],
  };
}
