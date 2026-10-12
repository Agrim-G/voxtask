import type { Memory, MemoryCategory } from './types';
import { looksSecret, MAX_CONTENT, SECRET_MESSAGE } from './validate';
import { tokens } from './text';

export type MemoryCommand =
  | { kind: 'none'; text: string; skipMemory: boolean }
  | { kind: 'remember'; content: string; category: MemoryCategory }
  | { kind: 'clarify'; message: string }
  | { kind: 'list' }
  | { kind: 'forget'; query: string }
  | { kind: 'setEnabled'; enabled: boolean };

const norm = (s: string): string => s.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

export function inferCategory(content: string): MemoryCategory {
  const t = content.toLowerCase();
  if (/\b(prefer|prefers|like|likes|love|loves|hate|hates|dislike|favou?rite|rather|enjoy|enjoys)\b/.test(t)) return 'Preference';
  if (/\b(goal|goals|want to|wants to|aim|aims|plan to|plans to|hope to|trying to|target|working toward)\b/.test(t)) return 'Goal';
  if (/\b(project|app|startup|thesis|assignment|product|side project)\b/.test(t)) return 'Project';
  if (/\b(every|daily|usually|always|each|routine|weekly|takes?|lasts?|typically|session|sessions)\b/.test(t)) return 'Routine';
  return 'Other';
}

const RELATIVE_EVENT =
  /\b(today|tomorrow|tonight|yesterday|this (?:morning|afternoon|evening|week)|next (?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i;

const SKIP_RE =
  /[,;.\s]*\b(?:please\s+)?(?:don'?t|do not)\s+use\s+(?:my\s+)?memor(?:y|ies)(?:\s+(?:for|on)\s+(?:this|that)\s+(?:task|one|item))?\s*[.!]*/i;

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function parseMemoryCommand(input: string): MemoryCommand {
  const text = norm(input);

  let m = text.match(/^(?:please\s+)?(?:turn|switch)\s+(?:the\s+)?memory\s+(on|off)\s*[.!]*$/i);
  if (m) return { kind: 'setEnabled', enabled: m[1].toLowerCase() === 'on' };
  m = text.match(/^(?:please\s+)?(enable|disable)\s+(?:the\s+)?memory\s*[.!]*$/i);
  if (m) return { kind: 'setEnabled', enabled: m[1].toLowerCase() === 'enable' };

  if (
    /^(?:please\s+)?(?:what\s+(?:do\s+you\s+|have\s+you\s+)?(?:remember|know|saved|stored)(?:\s+about\s+me)?|show\s+(?:me\s+)?(?:my\s+)?memories|list\s+(?:my\s+)?memories)\s*[?.!]*$/i.test(
      text,
    )
  ) {
    return { kind: 'list' };
  }

  m =
    text.match(/^(?:please\s+)?forget\s+(?:about\s+)?(.+)$/i) ??
    text.match(/^(?:please\s+)?(?:delete|remove)\s+(?:my\s+|the\s+)?(?:memory|memories)\s+(?:about\s+|of\s+)?(.+)$/i);
  if (m) {
    const query = m[1].replace(/\b(?:memory|memories)\b/gi, ' ').replace(/^(?:my|the)\s+/i, '').replace(/[.!?\s]+$/g, '').trim();
    if (tokens(query).length === 0) {
      return {
        kind: 'clarify',
        message: 'Which memory should I forget? Try “Forget my study preference”. To remove everything, use Clear all in the Memory Center.',
      };
    }
    return { kind: 'forget', query };
  }

  m = text.match(/^(?:please\s+)?(?:remember|keep in mind|make a note)\b\s*(?:that\b)?\s*(.*)$/i);
  if (m) {
    const content = capitalize(m[1].replace(/[.!?\s]+$/g, '').trim());
    if (!content) {
      return { kind: 'clarify', message: 'What should I remember? Try “Remember that I prefer studying before noon”.' };
    }
    if (/^to\b/i.test(content)) {
      return {
        kind: 'clarify',
        message: 'That sounds like a task, not a lasting fact. To save a memory, say “Remember that …”. To add a task, leave out “remember”.',
      };
    }
    if (content.split(/\s+/).length < 3) {
      return { kind: 'clarify', message: 'That is too short to be a useful memory. Say a full sentence, such as “Remember that my gym session takes 90 minutes”.' };
    }
    if (content.length > MAX_CONTENT) {
      return { kind: 'clarify', message: `Please shorten that to ${MAX_CONTENT} characters or fewer.` };
    }
    if (looksSecret(content)) return { kind: 'clarify', message: SECRET_MESSAGE };
    if (RELATIVE_EVENT.test(content)) {
      return {
        kind: 'clarify',
        message: 'That sounds like a one-off event rather than a lasting fact. Add it as a task instead, or reword it (for example “Remember that I study best in the morning”).',
      };
    }
    return { kind: 'remember', content, category: inferCategory(content) };
  }

  if (SKIP_RE.test(text)) {
    const rest = text.replace(SKIP_RE, ' ').replace(/^[\s,;.]+|[\s,;]+$/g, '').trim();
    if (!/[a-z]/i.test(rest)) {
      return {
        kind: 'clarify',
        message: 'Add that to the task itself, for example “Study reasoning tomorrow. Don’t use memory for this task.” You can also turn memory off completely.',
      };
    }
    return { kind: 'none', text: rest, skipMemory: true };
  }

  return { kind: 'none', text, skipMemory: false };
}

/** Finds memories matching a "forget" phrase. Prefers memories matching every word. */
export function findForgetMatches(query: string, memories: Memory[]): Memory[] {
  const q = tokens(query);
  if (q.length === 0) return [];
  const scored = memories.map((m) => {
    const hay = new Set([...m.keywords, ...tokens(m.category), ...tokens(m.content)]);
    return { m, score: q.filter((t) => hay.has(t)).length };
  });
  const all = scored.filter((s) => s.score === q.length);
  const pool = all.length > 0 ? all : scored.filter((s) => s.score > 0);
  return pool.sort((a, b) => b.score - a.score).map((s) => s.m);
}
