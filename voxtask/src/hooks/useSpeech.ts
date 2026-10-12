import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface AlternativeLike {
  transcript: string;
}
interface ResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: AlternativeLike;
}
interface RecognitionEventLike {
  resultIndex: number;
  results: { readonly length: number; [index: number]: ResultLike };
}
interface RecognitionErrorLike {
  error: string;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function describeError(code: string): string | null {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was denied. Allow it in your browser’s site settings, or type instead.';
    case 'no-speech':
      return 'No speech was detected. Try again, or type your tasks.';
    case 'audio-capture':
      return 'No microphone was found.';
    case 'network':
      return 'The speech service could not be reached. Chrome needs an internet connection for dictation.';
    case 'aborted':
      return null;
    default:
      return `Voice input failed (${code}). You can still type your tasks.`;
  }
}

/** Thin wrapper around the browser Web Speech API. `onFinal` receives each finalized phrase. */
export function useSpeech(onFinal: (text: string) => void) {
  const Ctor = useMemo(getCtor, []);
  const recRef = useRef<RecognitionLike | null>(null);
  const cbRef = useRef(onFinal);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cbRef.current = onFinal;
  });

  const start = useCallback(() => {
    if (!Ctor) {
      setError('Voice input is not supported in this browser.');
      return;
    }
    if (recRef.current) return;
    setError(null);
    setInterim('');
    setStarting(true);

    const rec = new Ctor();
    rec.lang = navigator.language || 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => {
      setStarting(false);
      setListening(true);
    };
    rec.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript;
        if (result.isFinal) cbRef.current(text.trim());
        else interimText += text;
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      const msg = describeError(e.error);
      if (msg) setError(msg);
      setStarting(false);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setStarting(false);
      setInterim('');
    };

    try {
      recRef.current = rec;
      rec.start();
    } catch {
      recRef.current = null;
      setStarting(false);
      setError('Could not start voice input. Please try again.');
    }
  }, [Ctor]);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  useEffect(() => {
    return () => {
      recRef.current?.abort();
    };
  }, []);

  return { supported: Ctor !== null, listening, starting, interim, error, start, stop };
}
