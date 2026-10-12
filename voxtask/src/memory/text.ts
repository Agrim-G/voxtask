/* Plain keyword utilities. This is simple word matching, not AI or semantic search. */

const STOPWORDS = new Set(
  (
    'i me my mine we our you your the a an and or but if then so to of in on at for from by with without about as is are was were be been being am ' +
    'it its this that these those there here do does did doing done have has had having will would can could should must may might ' +
    'not no yes dont does please also just very really more most some any all each every always usually typically often sometimes never ' +
    'before after during until till around between over under into out up down off than too much many ' +
    'noon morning afternoon evening night today tomorrow tonight yesterday week month year day days time times ' +
    'prefer prefers like likes love loves want wants need needs take takes took long lasts last ' +
    'minute minutes hour hours hr hrs min mins session sessions task tasks thing things stuff get gets go goes going ' +
    'everything anything something nothing remember that what who which when where why how also still own personal'
  ).split(' '),
);

export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith('ing') && w.length > 5) {
    let base = w.slice(0, -3);
    if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) base = base.slice(0, -1);
    if (base.length >= 3) w = base;
  } else if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) {
    w = w.slice(0, -1);
  }
  return w;
}

/** Lower-cased, de-duplicated stems of meaningful words. */
export function tokens(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z0-9'-]*/g) ?? [];
  const out: string[] = [];
  for (const raw of words) {
    const clean = raw.replace(/'s$/, '').replace(/['-]/g, '');
    if (clean.length < 3 || STOPWORDS.has(clean)) continue;
    const s = stem(clean);
    if (s.length < 3 || STOPWORDS.has(s)) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

export function extractKeywords(text: string, max = 12): string[] {
  return tokens(text).slice(0, max);
}

export function normalizeContent(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
