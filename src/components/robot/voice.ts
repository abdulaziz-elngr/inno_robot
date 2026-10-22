"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bcp47, type Locale } from "@/lib/i18n/shared";

/**
 * Voice input (Web Speech API) + output (speech synthesis).
 *
 * Both features are browser-dependent and may be missing (Firefox, insecure contexts)
 * or denied by the user. This hook never throws: it reports capability and error states
 * so the UI can clearly explain what happened and keep typed input fully usable.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  const ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | undefined;
  return ctor ?? null;
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && (getRecognitionCtor() !== null || "speechSynthesis" in window);
}

export type VoiceState = "idle" | "listening" | "unsupported" | "denied" | "error";

export function useVoice({ locale, onFinal }: { locale: Locale; onFinal: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<VoiceState>("idle");
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    // Keep the latest callback in a ref so an active recognition session never calls a
    // stale closure (refs must not be written during render).
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("unsupported");
      return;
    }
    try {
      recognitionRef.current?.abort();
      const rec = new Ctor();
      rec.lang = bcp47(locale);
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (event) => {
        const last = event.results[event.resultIndex];
        const text = last?.[0]?.transcript?.trim();
        if (text) onFinalRef.current(text);
      };
      rec.onerror = (event) => {
        setError(event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : "error");
        setListening(false);
      };
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
      setError("idle");
    } catch {
      setError("error");
      setListening(false);
    }
  }, [locale]);

  const speak = useCallback(
    (text: string, opts?: { lang?: Locale; onEnd?: () => void }) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        opts?.onEnd?.();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = bcp47(opts?.lang ?? locale);
        utterance.rate = 1;
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => {
          setSpeaking(false);
          opts?.onEnd?.();
        };
        utterance.onerror = () => {
          setSpeaking(false);
          opts?.onEnd?.();
        };
        window.speechSynthesis.speak(utterance);
      } catch {
        setSpeaking(false);
        opts?.onEnd?.();
      }
    },
    [locale],
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return {
    listening,
    speaking,
    error,
    recognitionAvailable: getRecognitionCtor() !== null,
    ttsAvailable: typeof window !== "undefined" && "speechSynthesis" in window,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
