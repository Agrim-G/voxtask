import type { Category, ParsedTask, Priority } from '../types';
import { addDays, formatTime, minutesToTime, toISODate } from './dates';

/*
 * Rule-based task parser. NOT AI: it only knows the patterns below.
 * Anything it cannot read is left in the title (or flagged in `notes`)
 * so the user can fix it in the review step.
 */

type Meridiem = 'am' | 'pm';

const MONTH_NAMES =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec';
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

const VERBS =
  'study|go|buy|call|email|write|finish|submit|send|read|pay|clean|cook|meet|attend|visit|book|schedule|practice|review|prepare|plan|work|do|make|pick|drop|take|get|fix|complete|start|revise|exercise|run|workout|renew|order|water|wash|pack|drive|walk|play|watch|check|update|return|collect|print|file|apply|register|organize|talk|speak|ask|learn|solve|research|set';

const LEAD =
  "(?:(?:i|we)\\s+(?:need|have|want|got|should|must|plan|ought)\\s+to\\s+|need\\s+to\\s+|have\\s+to\\s+|i'?d\\s+like\\s+to\\s+|remind\\s+me\\s+to\\s+|don'?t\\s+forget\\s+to\\s+)?";

const SENTENCE_SPLIT = /(?:[.!?;]+(?=\s|$))|\n+/;

const CLAUSE_SPLIT = new RegExp(
  `\\s*,\\s*(?:(?:and|then)\\s+)*(?=${LEAD}(?:${VERBS})\\b)|\\s+(?:and\\s+then|and\\s+also|and|then|also|after\\s+that|afterwards|plus)\\s+(?=${LEAD}(?:${VERBS})\\b)`,
  'i',
);

const LEAD_STRIP = new RegExp(`^(?:(?:and|then|also|plus|so|please|ok|okay)\\s+)*${LEAD}`, 'i');

const VAGUE =
  /\b(?:(?:sometime\s+)?(?:in\s+the\s+|this\s+)?(?:morning|afternoon|evening)|tonight|(?:after|before|around|during)\s+(?:lunch|dinner|breakfast))\b/i;

const CATEGORY_RULES: Array<[Category, RegExp]> = [
  ['Health', /\b(gym|workout|exercise|run|running|jog|yoga|doctor|dentist|medicine|walk|meditat\w*|swim\w*|physio)\b/],
  ['Study', /\b(study|revise|revision|homework|exam|test|learn|lecture|class|assignment|practice|aptitude|course|read|syllabus|quiz)\b/],
  ['Work', /\b(meeting|email|report|client|project|presentation|deadline|office|invoice|standup|sprint|proposal)\b/],
  ['Errands', /\b(buy|groceries|grocery|shop|shopping|pharmacy|bank|post office|pay|laundry|order|pick up|collect|errand)\b/],
  ['Personal', /\b(call|mom|mother|dad|father|friend|birthday|family|clean|cook|dinner|lunch|party)\b/],
];

/* ---------- helpers ---------- */

interface Taken {
  m: RegExpMatchArray | null;
  rest: string;
}

/** Remove the first match of `re` from `text`. */
function take(text: string, re: RegExp): Taken {
  const m = text.match(re);
  if (!m || m.index === undefined) return { m: null, rest: text };
  return { m, rest: `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}` };
}

function makeDate(y: number, m: number, d: number): string | null {
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return toISODate(dt);
}

/** Builds a date; without an explicit year, picks the next occurrence on/after today. */
function withYear(month: number, day: number, yearStr: string | undefined, now: Date): string | null {
  if (yearStr) {
    let y = Number(yearStr);
    if (y < 100) y += 2000;
    return makeDate(y, month, day);
  }
  const thisYear = makeDate(now.getFullYear(), month, day);
  if (!thisYear) return null;
  if (thisYear >= toISODate(now)) return thisYear;
  return makeDate(now.getFullYear() + 1, month, day);
}

const monthIndex = (name: string): number => MONTH_KEYS.indexOf(name.slice(0, 3).toLowerCase()) + 1;

/* ---------- dates ---------- */

interface DateResult {
  rest: string;
  date: string;
  notes: string[];
}

function extractDate(text: string, now: Date): DateResult {
  const base = toISODate(now);

  const relative: Array<[RegExp, number]> = [
    [/\bday after tomorrow\b/i, 2],
    [/\b(?:tomorrow|tmrw)\b/i, 1],
    [/\btoday\b/i, 0],
  ];
  for (const [re, offset] of relative) {
    const hit = take(text, re);
    if (hit.m) return { rest: hit.rest, date: addDays(base, offset), notes: [] };
  }

  let r = take(text, /\bin\s+(\d{1,3})\s+(day|days|week|weeks)\b/i);
  if (r.m) {
    const n = Number(r.m[1]) * (r.m[2].toLowerCase().startsWith('w') ? 7 : 1);
    return { rest: r.rest, date: addDays(base, n), notes: [] };
  }

  r = take(text, /\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (r.m) {
    const iso = makeDate(Number(r.m[1]), Number(r.m[2]), Number(r.m[3]));
    if (iso) return { rest: r.rest, date: iso, notes: [] };
  }

  r = take(text, /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (r.m) {
    const iso = withYear(Number(r.m[2]), Number(r.m[1]), r.m[3], now);
    if (iso) return { rest: r.rest, date: iso, notes: [`"${r.m[0]}" was read as day/month.`] };
  }

  r = take(text, new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_NAMES})\\b(?:,?\\s+(\\d{4}))?`, 'i'));
  if (r.m) {
    const iso = withYear(monthIndex(r.m[2]), Number(r.m[1]), r.m[3], now);
    if (iso) return { rest: r.rest, date: iso, notes: [] };
  }

  r = take(text, new RegExp(`\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, 'i'));
  if (r.m) {
    const iso = withYear(monthIndex(r.m[1]), Number(r.m[2]), r.m[3], now);
    if (iso) return { rest: r.rest, date: iso, notes: [] };
  }

  r = take(text, new RegExp(`\\b(?:(next|this|on)\\s+)?(${WEEKDAYS.join('|')})\\b`, 'i'));
  if (r.m) {
    const idx = WEEKDAYS.indexOf(r.m[2].toLowerCase());
    let diff = (idx - now.getDay() + 7) % 7;
    if (r.m[1] && r.m[1].toLowerCase() === 'next' && diff === 0) diff = 7;
    const iso = addDays(base, diff);
    return { rest: r.rest, date: iso, notes: [`"${r.m[0].trim()}" was resolved to ${iso}.`] };
  }

  return { rest: text, date: '', notes: [] };
}

/* ---------- durations ---------- */

function extractDuration(text: string): { rest: string; minutes: number | null } {
  const specials: Array<[RegExp, number]> = [
    [/\b(?:for\s+)?(?:an?\s+hour\s+and\s+a\s+half|one\s+and\s+a\s+half\s+hours?)\b/i, 90],
    [/\b(?:for\s+)?half\s+an?\s+hour\b/i, 30],
  ];
  for (const [re, minutes] of specials) {
    const hit = take(text, re);
    if (hit.m) return { rest: hit.rest, minutes };
  }

  const r = take(text, /\b(?:for\s+)?(an?|one|two|three|four|five|six|\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/i);
  if (r.m) {
    const raw = r.m[1].toLowerCase();
    const qty = raw in NUMBER_WORDS ? NUMBER_WORDS[raw] : Number(raw);
    const minutes = Math.round(qty * (r.m[2].toLowerCase().startsWith('h') ? 60 : 1));
    if (minutes >= 1 && minutes <= 1440) return { rest: r.rest, minutes };
  }
  return { rest: text, minutes: null };
}

/* ---------- times ---------- */

interface TimeResult {
  rest: string;
  start: string;
  durationFromRange: number | null;
  notes: string[];
}

const toMinutes = (h: number, mi: number, mer: Meridiem): number => ((h % 12) + (mer === 'pm' ? 12 : 0)) * 60 + mi;
const guessMeridiem = (h: number): Meridiem => (h >= 7 && h <= 11 ? 'am' : 'pm');
const flip = (m: Meridiem): Meridiem => (m === 'am' ? 'pm' : 'am');
const asMeridiem = (s: string): Meridiem => (s.toLowerCase() === 'pm' ? 'pm' : 'am');
const showTime = (mins: number): string => formatTime(minutesToTime(mins));

function extractTime(text: string): TimeResult | null {
  // 1) Ranges: "from 9 to 11", "9 AM to 11 AM", "between 2 and 4 pm", "9-11am"
  const rangeRe =
    /\b(?:(from|between)\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(to|until|till|and|-|–)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/gi;

  for (const m of text.matchAll(rangeRe)) {
    const prefix = m[1] ? m[1].toLowerCase() : '';
    const sep = m[5].toLowerCase();
    const ap1: Meridiem | null = m[4] ? asMeridiem(m[4]) : null;
    const ap2: Meridiem | null = m[8] ? asMeridiem(m[8]) : null;
    if (sep === 'and' && prefix !== 'between') continue;
    if (!prefix && !ap1 && !ap2) continue; // avoid things like "2 to 3 chapters"

    const h1 = Number(m[2]);
    const h2 = Number(m[6]);
    const mi1 = m[3] ? Number(m[3]) : 0;
    const mi2 = m[7] ? Number(m[7]) : 0;
    if (mi1 > 59 || mi2 > 59) continue;

    const notes: string[] = [];
    let s = 0;
    let e: number | null = null;

    if (ap1 || ap2) {
      if (h1 < 1 || h1 > 12 || h2 < 1 || h2 > 12) continue;
      let a1: Meridiem = ap1 ?? ap2 ?? 'am';
      let a2: Meridiem = ap2 ?? ap1 ?? 'am';
      s = toMinutes(h1, mi1, a1);
      e = toMinutes(h2, mi2, a2);
      if (e <= s) {
        if (!ap1) {
          a1 = flip(a1);
          s = toMinutes(h1, mi1, a1);
        } else if (!ap2) {
          a2 = flip(a2);
          e = toMinutes(h2, mi2, a2);
        }
        if (e <= s) e = null;
      }
    } else if (m[3] || m[7]) {
      if (h1 > 23 || h2 > 23) continue;
      s = h1 * 60 + mi1;
      e = h2 * 60 + mi2;
      if (e <= s) e = null;
    } else {
      if (h1 < 1 || h1 > 23 || h2 < 1 || h2 > 23) continue;
      s = h1 > 12 ? h1 * 60 : toMinutes(h1, 0, guessMeridiem(h1));
      e = h2 > 12 ? h2 * 60 : toMinutes(h2, 0, guessMeridiem(h2));
      if (e <= s) e = null;
      notes.push(
        `AM/PM wasn't stated, so I assumed ${showTime(s)}${e !== null ? ` to ${showTime(e)}` : ''}. Please verify.`,
      );
    }
    if (e === null) notes.push("I couldn't read a valid end time, so only the start time was kept.");

    const idx = m.index ?? 0;
    return {
      rest: `${text.slice(0, idx)} ${text.slice(idx + m[0].length)}`,
      start: minutesToTime(s),
      durationFromRange: e !== null ? e - s : null,
      notes,
    };
  }

  const done = (r: Taken, minutes: number, notes: string[] = []): TimeResult => ({
    rest: r.rest,
    start: minutesToTime(minutes),
    durationFromRange: null,
    notes,
  });

  // 2) "6 PM", "at 6:30 pm"
  let r = take(text, /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (r.m) {
    const h = Number(r.m[1]);
    const mi = r.m[2] ? Number(r.m[2]) : 0;
    if (h >= 1 && h <= 12 && mi <= 59) return done(r, toMinutes(h, mi, asMeridiem(r.m[3])));
  }

  // 3) "18:00", "9:30"
  r = take(text, /\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (r.m) {
    const h = Number(r.m[1]);
    const mi = Number(r.m[2]);
    if (h > 12 || h === 0 || r.m[1].startsWith('0')) return done(r, h * 60 + mi);
    const mins = toMinutes(h, mi, guessMeridiem(h));
    return done(r, mins, [`AM/PM wasn't stated, so I assumed ${showTime(mins)}. Please verify.`]);
  }

  // 4) "at 5"
  r = take(text, /\bat\s+(\d{1,2})\b/i);
  if (r.m) {
    const h = Number(r.m[1]);
    if (h >= 1 && h <= 23) {
      if (h > 12) return done(r, h * 60);
      const mins = toMinutes(h, 0, guessMeridiem(h));
      return done(r, mins, [`AM/PM wasn't stated, so I assumed ${showTime(mins)}. Please verify.`]);
    }
  }

  // 5) "noon"
  r = take(text, /\b(?:at\s+)?noon\b/i);
  if (r.m) return done(r, 720);

  return null;
}

/* ---------- title / category / priority ---------- */

function cleanTitle(raw: string): string {
  let t = raw.replace(/\s+/g, ' ').trim().replace(LEAD_STRIP, '').trim();
  let prev = '';
  while (prev !== t) {
    prev = t;
    t = t
      .replace(/^[\s,;:.\-–]+|[\s,;:.\-–]+$/g, '')
      .replace(/\s+(?:at|on|from|for|by|in|to|until|till|between|around|and|then)$/i, '')
      .trim();
  }
  t = t.replace(/\s{2,}/g, ' ');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

function detectCategory(lower: string): Category {
  for (const [category, re] of CATEGORY_RULES) if (re.test(lower)) return category;
  return 'Other';
}

function detectPriority(lower: string): Priority {
  if (/\b(urgent|asap|important|critical|high priority|top priority)\b/.test(lower)) return 'high';
  if (/\b(low priority|whenever|someday|no rush|if i have time)\b/.test(lower)) return 'low';
  return 'medium';
}

/* ---------- segments ---------- */

interface Segment {
  title: string;
  description: string;
  date: string;
  startTime: string;
  duration: number | null;
  category: Category;
  priority: Priority;
  notes: string[];
}

function parseSegment(source: string, now: Date): Segment {
  const notes: string[] = [];
  let text = ` ${source} `;

  const d = extractDate(text, now);
  text = d.rest;
  notes.push(...d.notes);
  let date = d.date;

  const dur = extractDuration(text);
  text = dur.rest;
  let duration = dur.minutes;

  let startTime = '';
  const t = extractTime(text);
  if (t) {
    text = t.rest;
    startTime = t.start;
    notes.push(...t.notes);
    if (duration === null) duration = t.durationFromRange;
  }

  let description = '';
  const v = take(text, VAGUE);
  if (v.m) {
    text = v.rest;
    const phrase = v.m[0].trim().toLowerCase();
    if (!date && (phrase === 'tonight' || phrase.startsWith('this '))) date = toISODate(now);
    if (!startTime) {
      description = `Timing: ${phrase}`;
      notes.push(`"${phrase}" is vague, so no exact time was set. It is kept in the description.`);
    }
  }

  const lower = source.toLowerCase();
  return {
    title: cleanTitle(text),
    description,
    date,
    startTime,
    duration,
    category: detectCategory(lower),
    priority: detectPriority(lower),
    notes,
  };
}

function splitSegments(input: string): string[] {
  const normalized = input
    .replace(/\b([ap])\.m\.(?=\s+[A-Z])/g, '$1m.')
    .replace(/\b([ap])\.m\.?/gi, '$1m');
  return normalized
    .split(SENTENCE_SPLIT)
    .flatMap((s) => s.split(CLAUSE_SPLIT))
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => /[a-z]/i.test(s));
}

interface Carry {
  date: string;
  startTime: string;
  duration: number | null;
  description: string;
}

/** Turns free text into proposed tasks. Uses `now` for relative dates. */
export function parseTasks(input: string, now: Date = new Date()): ParsedTask[] {
  const today = toISODate(now);
  const out: ParsedTask[] = [];
  let lastDate = '';
  let carry: Carry | null = null;

  for (const source of splitSegments(input)) {
    const p = parseSegment(source, now);

    // A bare phrase such as "Tomorrow," applies to the next task.
    if (!p.title) {
      if (p.date || p.startTime || p.duration !== null || p.description) {
        carry = { date: p.date, startTime: p.startTime, duration: p.duration, description: p.description };
      }
      continue;
    }

    if (carry) {
      if (!p.date && carry.date) {
        p.date = carry.date;
        p.notes.push('Date taken from the phrase just before this task.');
      }
      if (!p.startTime && carry.startTime) {
        p.startTime = carry.startTime;
        p.notes.push('Time taken from the phrase just before this task.');
      }
      if (p.duration === null && carry.duration !== null) p.duration = carry.duration;
      if (!p.description && carry.description) p.description = carry.description;
      carry = null;
    }

    if (p.date) {
      lastDate = p.date;
    } else if (lastDate) {
      p.date = lastDate;
      p.notes.push("No date in this phrase, so I reused the previous task's date. Edit it if that's wrong.");
    } else if (p.startTime) {
      p.date = today;
      p.notes.push('A time was given without a date, so I defaulted to today.');
    }

    if (!p.date && !p.startTime) {
      p.notes.push('No date or time found. This task stays unscheduled unless you add one.');
    }

    out.push({
      title: p.title,
      description: p.description,
      date: p.date,
      startTime: p.startTime,
      duration: p.duration !== null ? String(p.duration) : '',
      category: p.category,
      priority: p.priority,
      notes: p.notes,
      source,
    });
  }
  return out;
}
