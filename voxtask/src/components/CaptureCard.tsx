import { useCallback, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { useSpeech } from '../hooks/useSpeech';

const EXAMPLE =
  'Tomorrow I need to study quantitative aptitude from 9 to 11, go to the gym at 6 PM for an hour, and buy groceries after lunch.';

interface Props {
  /** Resolves to an error message, or null when the text was handled. */
  onAnalyze: (text: string) => string | null | Promise<string | null>;
}

export function CaptureCard({ onAnalyze }: Props) {
  const [text, setText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFinal = useCallback((chunk: string) => {
    if (!chunk) return;
    setTranscript((prev) => (prev ? `${prev} ${chunk}` : chunk));
    setText((prev) => (prev.trim() ? `${prev.trim()} ${chunk}` : chunk));
    setError(null);
  }, []);

  const speech = useSpeech(handleFinal);

  const toggleMic = () => {
    if (speech.listening) {
      speech.stop();
    } else {
      setTranscript('');
      speech.start();
    }
  };

  const submit = async () => {
    if (busy) return;
    if (speech.listening) speech.stop();
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Type or dictate something first.');
      return;
    }
    setBusy(true);
    let problem: string | null;
    try {
      problem = await onAnalyze(trimmed);
    } catch {
      problem = 'Something went wrong while handling that. Please try again.';
    }
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    setText('');
    setTranscript('');
    setError(null);
  };

  const status = !speech.supported
    ? "Voice input isn't available in this browser (try Chrome, Edge or Safari). You can still type below."
    : speech.starting
      ? 'Connecting to microphone…'
      : speech.listening
        ? 'Listening… speak naturally, then press stop.'
        : 'Press the mic to dictate, or type below.';

  const message = error ?? speech.error;

  return (
    <section className="card p-5" aria-label="Capture tasks">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-50">Capture tasks</h2>
        <span className="chip text-zinc-400">Rule-based parser · not AI</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          {speech.listening && (
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/30" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={toggleMic}
            disabled={!speech.supported || speech.starting}
            aria-pressed={speech.listening}
            aria-label={speech.listening ? 'Stop recording' : 'Start voice input'}
            className={`relative flex h-14 w-14 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              speech.listening
                ? 'border-emerald-400 bg-emerald-500 text-ink-950'
                : 'border-ink-600 bg-ink-800 text-emerald-400 hover:bg-ink-700'
            }`}
          >
            {speech.listening ? <Square size={20} fill="currentColor" /> : <Mic size={22} />}
          </button>
        </div>
        <p role="status" aria-live="polite" className={`text-sm ${speech.listening ? 'text-emerald-300' : 'text-zinc-400'}`}>
          {status}
        </p>
      </div>

      {(transcript || speech.interim) && (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2">
          <p className="label">Transcribed text</p>
          <p className="text-sm text-zinc-200">
            {transcript}
            {speech.interim && <span className="text-zinc-500"> {speech.interim}</span>}
          </p>
        </div>
      )}

      <label className="label mt-4" htmlFor="capture-text">
        Your tasks
      </label>
      <textarea
        id="capture-text"
        rows={3}
        className="input resize-y"
        placeholder="e.g. Call the bank tomorrow at 3 PM and pay the electricity bill on 15 March"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit();
        }}
      />

      {message && (
        <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {message}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setText(EXAMPLE);
            setError(null);
          }}
        >
          Try an example
        </button>
        <button type="button" className="btn-primary" onClick={() => void submit()} disabled={busy}>
          Analyze &amp; review
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-500">Tip: Ctrl/⌘ + Enter also analyzes. Nothing is saved until you confirm. You can also say “Remember that …” or “What do you remember about me?”</p>
    </section>
  );
}
