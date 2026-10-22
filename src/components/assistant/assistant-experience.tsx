"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Mic, MicOff, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { RobotFace } from "@/components/robot/face";
import { useRobotFace } from "@/components/robot/use-face";
import { useVoice } from "@/components/robot/voice";

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  intent?: string;
  origin?: string;
  unverified?: boolean;
  sources?: string[];
  spoken?: string;
  pendingNavigation?: { destinationId: string; destinationName: string } | null;
};

type Identification = { identified: boolean; student: { id: string; firstNameEn: string; firstNameAr: string } | null };

type AIStatus = { configured: boolean; provider: string | null; model: string | null; knowledgeArticles: number; fallbackMode: boolean };

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * The shared assistant experience used by `/assistant` (production) and
 * `/assistant/demo` (development). All robot-face animation is driven by real
 * platform events; nothing is faked.
 */
export function AssistantExperience({ demo = false }: { demo?: boolean }) {
  const { t, locale, setLocale } = useI18n();
  const face = useRobotFace();

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [identification, setIdentification] = useState<Identification>({ identified: false, student: null });
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [speakingEnabled, setSpeakingEnabled] = useState(true);
  const [navPrompt, setNavPrompt] = useState<{ destinationId: string; destinationName: string } | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const voice = useVoice({ locale, onFinal: (text) => send(text) });

  const displayName = useMemo(() => {
    if (!identification.student) return null;
    return locale === "ar" ? identification.student.firstNameAr : identification.student.firstNameEn;
  }, [identification, locale]);

  /* ── initial data ───────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statusRes, identRes] = await Promise.all([fetch("/api/assistant/status"), fetch("/api/assistant/identification")]);
        if (!cancelled && statusRes.ok) setStatus((await statusRes.json()) as AIStatus);
        if (!cancelled && identRes.ok) {
          const data = (await identRes.json()) as Identification;
          setIdentification(data);
          if (data.identified) face.emit({ type: "GREET" });
        }
      } catch {
        /* status is best-effort; the chat still works against the knowledge fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [face]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const greeting = useCallback(() => {
    const name = displayName ?? "";
    const base = locale === "ar" ? (name ? `أهلاً ${name}!` : "أهلاً!") : name ? `Welcome, ${name}!` : "Welcome!";
    return base;
  }, [displayName, locale]);

  /* ── sending a message ──────────────────────────────────────────────────── */
  const send = useCallback(
    async (rawText: string, opts?: { confirmNavigation?: boolean }) => {
      const text = rawText.trim();
      if (!text || busy) return;
      setInput("");
      setBusy(true);
      face.emit({ type: "THINK_START" });

      const userTurn: ChatTurn = { id: uid(), role: "user", text };
      setTurns((current) => [...current, userTurn]);

      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversationId,
            language: locale,
            confirmNavigation: opts?.confirmNavigation ?? false,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? t("assistant.aiUnavailable"));
        }
        const data = (await res.json()) as {
          conversationId?: string;
          response: { message: string; spokenResponse: string; intent: string; unverified: boolean; sources: string[]; destinationId: string | null; requiresConfirmation: boolean };
          origin: string;
        };
        if (data.conversationId) setConversationId(data.conversationId);

        const assistantTurn: ChatTurn = {
          id: uid(),
          role: "assistant",
          text: data.response.message,
          intent: data.response.intent,
          origin: data.origin,
          unverified: data.response.unverified,
          sources: data.response.sources,
          spoken: data.response.spokenResponse,
        };
        setTurns((current) => [...current, assistantTurn]);

        if (data.response.requiresConfirmation && data.response.destinationId) {
          setNavPrompt({ destinationId: data.response.destinationId, destinationName: data.response.message.slice(0, 60) });
          face.emit({ type: "WARNING", message: "confirm" });
        } else {
          face.emit({ type: "SPEAK_START" });
          if (speakingEnabled) {
            voice.speak(data.response.spokenResponse, { onEnd: () => face.emit({ type: "SPEAK_END" }) });
          } else {
            face.emit({ type: "SPEAK_END" });
          }
        }
      } catch (error) {
        face.emit({ type: "COMMAND_FAILED" });
        const message = error instanceof Error ? error.message : t("assistant.aiUnavailable");
        setTurns((current) => [...current, { id: uid(), role: "assistant", text: message, unverified: true }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, conversationId, face, locale, speakingEnabled, t, voice],
  );

  /* ── NFC (demo only) ────────────────────────────────────────────────────── */
  const simulateScan = useCallback(
    async (cardUid: string) => {
      if (scanBusy) return;
      setScanBusy(true);
      face.emit({ type: "NFC_SCAN_STARTED" });
      try {
        const res = await fetch("/api/assistant/demo/identify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cardUid, language: locale }),
        });
        if (!res.ok) throw new Error(t("assistant.aiUnavailable"));
        const data = (await res.json()) as { identification: Identification & { messageAr?: string; messageEn?: string } };
        setIdentification(data.identification);
        face.emit({ type: "NFC_CARD_READ", identified: data.identification.identified });
        const message = locale === "ar" ? data.identification.messageAr : data.identification.messageEn;
        if (message) setTurns((current) => [...current, { id: uid(), role: "assistant", text: message }]);
      } catch {
        face.emit({ type: "COMMAND_FAILED" });
      } finally {
        setScanBusy(false);
      }
    },
    [face, locale, scanBusy, t],
  );

  const resetIdentification = useCallback(async () => {
    await fetch(demo ? "/api/assistant/demo/reset" : "/api/assistant/identification", { method: "DELETE" }).catch(() => undefined);
    setIdentification({ identified: false, student: null });
    setTurns([]);
    setConversationId(undefined);
    face.emit({ type: "RESET" });
  }, [face, demo]);

  const clearConversation = useCallback(() => {
    setTurns([]);
    setConversationId(undefined);
    voice.stopSpeaking();
    face.emit({ type: "RESET" });
  }, [face, voice]);

  const toggleMic = useCallback(() => {
    if (voice.listening) {
      voice.stopListening();
      face.emit({ type: "LISTEN_STOP" });
    } else {
      face.emit({ type: "LISTEN_START" });
      voice.startListening();
    }
  }, [face, voice]);

  const toggleSpeaking = useCallback(() => {
    if (speakingEnabled) voice.stopSpeaking();
    setSpeakingEnabled((v) => !v);
  }, [speakingEnabled, voice]);

  const stateLabel = t(`assistant.faceStates.${face.state}`);
  const aiNotice = status && !status.configured;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* ── Face + status ─────────────────────────────────────────────────── */}
      <section className="surface flex flex-col items-center gap-4 p-6">
        <div className="flex w-full items-center justify-between">
          <Badge variant={status?.configured ? "success" : "outline"}>
            <span className={cn("size-1.5 rounded-full", status?.configured ? "bg-success" : "bg-subtle")} aria-hidden />
            {status?.configured ? t("assistant.statusOnline") : t("assistant.statusOffline")}
          </Badge>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setLocale("ar")} className={cn(locale === "ar" && "text-primary")} aria-pressed={locale === "ar"}>
              ع
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocale("en")} className={cn(locale === "en" && "text-primary")} aria-pressed={locale === "en"}>
              EN
            </Button>
          </div>
        </div>

        <RobotFace state={face.state} size={240} title={stateLabel} />

        <div className="text-center">
          <p className="text-lg font-semibold text-fg">{displayName ? greeting() : stateLabel}</p>
          {displayName && <p className="text-sm text-muted">{stateLabel}</p>}
        </div>

        {aiNotice && (
          <div className="w-full rounded-xl border border-warning/30 bg-warning/8 px-4 py-3 text-sm text-muted">
            <p className="font-medium text-warning">{t("assistant.aiNotConfigured")}</p>
            <p className="mt-1">{t("assistant.aiNotConfiguredHint")}</p>
          </div>
        )}

        {/* Identification */}
        <div className="w-full rounded-xl border border-border bg-bg/60 px-4 py-3">
          {identification.identified ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="success">{t("assistant.identified")}</Badge>
                <span className="font-medium text-fg">{displayName}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={resetIdentification}>
                <RotateCcw className="size-3.5" aria-hidden />
                {t("assistant.newConversation")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
              <span>{demo ? t("assistant.demoNotice") : t("assistant.tapCard")}</span>
              <Badge variant="outline">{t("assistant.notIdentified")}</Badge>
            </div>
          )}
        </div>

        {/* Demo NFC controls */}
        {demo && (
          <div className="flex w-full flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={scanBusy} onClick={() => simulateScan("04A1B2C3D4E5F6")}>
              {t("assistant.demoScan")}
            </Button>
            <Button variant="outline" size="sm" disabled={scanBusy} onClick={() => simulateScan("04A1B2C3D4E5F9")}>
              {t("assistant.demoRevokedCard")}
            </Button>
            <Button variant="outline" size="sm" disabled={scanBusy} onClick={() => simulateScan("00000000DEAD00")}>
              {t("assistant.demoUnknownCard")}
            </Button>
          </div>
        )}
      </section>

      {/* ── Transcript + input ────────────────────────────────────────────── */}
      <section className="surface flex min-h-[28rem] flex-col">
        <header className="flex items-center justify-between border-b border-border/70 px-5 py-3">
          <h2 className="text-sm font-semibold text-fg">{t("assistant.transcriptTitle")}</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleSpeaking} aria-pressed={speakingEnabled} title={speakingEnabled ? t("assistant.stopSpeaking") : t("assistant.repeat")}>
              {speakingEnabled ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
            </Button>
            <Button variant="ghost" size="icon" onClick={clearConversation} title={t("assistant.clear")}>
              <RotateCcw className="size-4" aria-hidden />
            </Button>
          </div>
        </header>

        <div ref={transcriptRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
          {turns.length === 0 && <p className="text-sm text-subtle">{t("assistant.emptyTranscript")}</p>}
          {turns.map((turn) => (
            <div key={turn.id} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed", turn.role === "user" ? "bg-primary text-white" : "bg-border/50 text-fg")}>
                <p className="whitespace-pre-wrap">{turn.text}</p>
                {turn.role === "assistant" && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {turn.origin === "knowledge-fallback" && <Badge variant="info">{t("assistant.knowledgeFallback")}</Badge>}
                    {turn.unverified && <Badge variant="warning">{t("assistant.unverified")}</Badge>}
                    {turn.sources?.map((source) => (
                      <Badge key={source} variant="outline">{source}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <p className="text-sm text-subtle">{t("assistant.thinking")}</p>}
        </div>

        {/* Navigation confirmation */}
        {navPrompt && (
          <div className="border-t border-border/70 bg-lavender/40 px-5 py-3 dark:bg-primary/10">
            <p className="text-sm font-medium text-fg">{t("assistant.confirmNavigation", { destination: navPrompt.destinationName })}</p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setNavPrompt(null);
                  send(navPrompt.destinationName, { confirmNavigation: true });
                }}
              >
                {t("assistant.confirm")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setNavPrompt(null)}>
                {t("assistant.decline")}
              </Button>
            </div>
          </div>
        )}

        {/* Input */}
        <form
          className="flex items-center gap-2 border-t border-border/70 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Button
            variant={voice.listening ? "danger" : "outline"}
            size="icon"
            onClick={toggleMic}
            disabled={!voice.recognitionAvailable}
            aria-label={voice.listening ? t("assistant.micListening") : t("assistant.mic")}
            title={!voice.recognitionAvailable ? t("assistant.micUnsupported") : t("assistant.mic")}
          >
            {voice.listening ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={locale === "ar" ? t("assistant.placeholderAr") : t("assistant.placeholderEn")}
            aria-label={t("assistant.send")}
            disabled={busy}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label={t("assistant.send")}>
            <ArrowUp className="size-4" aria-hidden />
          </Button>
        </form>
        {voice.error === "denied" && <p className="px-5 pb-3 text-xs text-error">{t("assistant.micDenied")}</p>}
        {voice.error === "unsupported" && <p className="px-5 pb-3 text-xs text-muted">{t("assistant.micUnsupported")}</p>}
      </section>
    </div>
  );
}
