import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

// Minimal typing for the browser's Web Speech API (Chrome, Edge, Safari incl. iPhone).
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface SpeechRecognizer {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognizerCtor = new () => SpeechRecognizer;

function getRecognizer(): RecognizerCtor | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognizerCtor;
    webkitSpeechRecognition?: RecognizerCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Voice notes via the device's own speech recognition. Free, no extra AI service.
 * `onFinal` gets the full transcript when the person stops talking.
 */
export function useVoiceInput(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognizer | null>(null);
  const textRef = useRef("");
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const supported = getRecognizer() !== null;

  useEffect(() => () => recRef.current?.abort(), []);

  const start = useCallback(() => {
    const Ctor = getRecognizer();
    if (!Ctor || recRef.current) return;
    const rec = new Ctor();
    rec.lang = typeof navigator !== "undefined" ? navigator.language || "en-GB" : "en-GB";
    rec.interimResults = true;
    rec.continuous = true;
    textRef.current = "";
    setTranscript("");
    setError(null);
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      textRef.current = text;
      setTranscript(text);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError(
          "Microphone access was blocked. Allow it in your browser settings to send voice notes."
        );
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError("Couldn't hear that. Try again or type instead.");
      }
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      const text = textRef.current.trim();
      if (text) onFinalRef.current(text);
      setTranscript("");
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setListening(false);
      setError("Couldn't start the microphone.");
    }
  }, []);

  /** Stop listening and send what was heard. */
  const stop = useCallback(() => recRef.current?.stop(), []);

  /** Stop listening and throw away what was heard. */
  const cancel = useCallback(() => {
    textRef.current = "";
    recRef.current?.abort();
  }, []);

  return { supported, listening, transcript, error, start, stop, cancel };
}
