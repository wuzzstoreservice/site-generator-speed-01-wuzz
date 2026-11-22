// makefun-site's text rules: the HTML escape table, the slug rule and the long date (README.md, "Text").

/** The HTML escape table, in this order: & < > " ' (README.md). */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** `text` with & < > " and ' escaped. Fast path: a scan returns the input unchanged when it holds none. */
export function escapeHtml(text) {
  const len = text.length;
  let i = 0;
  for (; i < len; i++) {
    const c = text.charCodeAt(i);
    // & 38  < 60  > 62  " 34  ' 39
    if (c === 38 || c === 60 || c === 62 || c === 34 || c === 39) break;
  }
  if (i === len) return text;
  let out = text.slice(0, i);
  let runStart = i;
  for (; i < len; i++) {
    const c = text.charCodeAt(i);
    let repl = null;
    if (c === 38) repl = '&amp;';
    else if (c === 60) repl = '&lt;';
    else if (c === 62) repl = '&gt;';
    else if (c === 34) repl = '&quot;';
    else if (c === 39) repl = '&#39;';
    if (repl !== null) {
      if (i > runStart) out += text.slice(runStart, i);
      out += repl;
      runStart = i + 1;
    }
  }
  if (runStart < len) out += text.slice(runStart);
  return out;
}

/** The most characters a slug keeps before a collision suffix. */
export const SLUG_MAX = 64;

/**
 * The slug of `text`: NFKD, combining marks dropped, A-Z lowered, every run of characters other than a-z and 0-9 one
 * "-", none at either end, at most SLUG_MAX characters (a "-" left at the cut dropped), and "untitled" when nothing is
 * left.
 */
export function slugify(text) {
  const plain = text.normalize('NFKD').replace(/\p{M}/gu, '');
  let out = '';
  let gap = false;
  for (const ch of plain) {
    let keep = null;
    if (ch >= 'A' && ch <= 'Z') keep = ch.toLowerCase();
    else if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) keep = ch;
    if (keep === null) {
      gap = out.length > 0;
      continue;
    }
    if (gap) out += '-';
    gap = false;
    out += keep;
  }
  out = out.slice(0, SLUG_MAX).replace(/-+$/, '');
  return out === '' ? 'untitled' : out;
}

/** `slug` made unique against `taken` (and added to it): the first of slug, slug-2, slug-3 ... not taken. */
export function uniqueSlug(slug, taken) {
  let out = slug;
  for (let n = 2; taken.has(out); n++) out = `${slug}-${n}`;
  taken.add(out);
  return out;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A YYYY-MM-DD date in words, from the string alone: "2026-11-09" is "9 November 2026". */
export function longDate(date) {
  const [y, m, d] = date.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}
