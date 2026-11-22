// makefun-site's Markdown (README.md, "Markdown"): its own subset, lexed into block tokens and then rendered, in the
// shape of marked's lexer and parser. Blocks: ATX headings (each with an id), fenced code, thematic breaks,
// blockquotes, flat lists and paragraphs. Inline: code spans, strong, emphasis, links and backslash escapes. No raw
// HTML (every < is escaped), no setext headings, no indented code, no tables, no reference links, no underscore
// emphasis.

import { escapeHtml, slugify, uniqueSlug } from './text.js';

const BLANK = /^[ \t]*$/;
const FENCE_OPEN = /^```([A-Za-z0-9_+-]*)[ \t]*$/;
const FENCE_CLOSE = /^```[ \t]*$/;
const HEADING = /^(#{1,6})[ \t]+(.*?)[ \t]*$/;
const HR = /^(?:---|\*\*\*)[ \t]*$/;
const QUOTE = /^>/;
const BULLET = /^[-*] (.*)$/;
const ORDERED = /^(\d{1,9})\. (.*)$/;
const CONTINUED = /^ {2,}\S/;

/** A heading line's level and text, or null (a heading's text is never empty). */
function headingOf(line) {
  const m = HEADING.exec(line);
  return m === null || m[2] === '' ? null : { depth: m[1].length, text: m[2] };
}

/** Whether `line` ends a paragraph: a blank line, a fence, a heading or a thematic break. */
function endsParagraph(line) {
  return BLANK.test(line) || FENCE_OPEN.test(line) || headingOf(line) !== null || HR.test(line);
}

/** A paragraph line as it is rendered: spaces and tabs at either end dropped. */
const trimLine = (line) => {
  let a = 0, b = line.length;
  while (a < b) { const c = line.charCodeAt(a); if (c === 32 || c === 9) a++; else break; }
  while (b > a) { const c = line.charCodeAt(b - 1); if (c === 32 || c === 9) b--; else break; }
  return a === 0 && b === line.length ? line : line.slice(a, b);
};

/** `src`'s block tokens, in order. */
export function lex(src) {
  const lines = src.split('\n');
  const tokens = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (BLANK.test(line)) {
      i++;
      continue;
    }
    const fence = FENCE_OPEN.exec(line);
    if (fence !== null) {
      const body = [];
      i++;
      while (i < lines.length && !FENCE_CLOSE.test(lines[i])) body.push(lines[i++]);
      i++;
      tokens.push({ type: 'code', lang: fence[1], lines: body });
      continue;
    }
    const heading = headingOf(line);
    if (heading !== null) {
      tokens.push({ type: 'heading', depth: heading.depth, text: heading.text });
      i++;
      continue;
    }
    if (HR.test(line)) {
      tokens.push({ type: 'hr' });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      const body = [];
      while (i < lines.length && QUOTE.test(lines[i])) body.push(lines[i++].replace(/^> ?/, ''));
      tokens.push({ type: 'blockquote', lines: body.map(trimLine).filter((l) => l !== '') });
      continue;
    }
    const bullet = BULLET.exec(line);
    const ordered = bullet === null ? ORDERED.exec(line) : null;
    if (bullet !== null || ordered !== null) {
      const isOrdered = ordered !== null;
      const marker = isOrdered ? ORDERED : BULLET;
      const items = [];
      while (i < lines.length) {
        const m = marker.exec(lines[i]);
        if (m !== null) {
          items.push([trimLine(isOrdered ? m[2] : m[1])]);
          i++;
        } else if (CONTINUED.test(lines[i])) {
          items[items.length - 1].push(trimLine(lines[i]));
          i++;
        } else break;
      }
      tokens.push({ type: 'list', ordered: isOrdered, start: isOrdered ? Number(ordered[1]) : 1, items: items.map((parts) => parts.join('\n')) });
      continue;
    }
    const body = [trimLine(line)];
    i++;
    while (i < lines.length && !endsParagraph(lines[i])) body.push(trimLine(lines[i++]));
    tokens.push({ type: 'paragraph', text: body.join('\n') });
  }
  return tokens;
}

/** The characters a backslash escapes. */
const ESCAPABLE = new Set(['\\', '`', '*', '_', '[', ']', '(', ')', '#', '+', '-', '.', '!', '>']);
/** Same set as a 128-entry boolean table for a fast charCode lookup. */
const ESCAPABLE_TBL = (() => {
  const t = new Uint8Array(128);
  for (const ch of ESCAPABLE) t[ch.charCodeAt(0)] = 1;
  return t;
})();
const isEscapable = (ch) => { const c = ch.charCodeAt(0); return c < 128 && ESCAPABLE_TBL[c] === 1; };

/** The first index from `from` where `s` holds `what` outside a backslash escape, or -1. */
function findUnescaped(s, what, from) {
  const last = s.length - what.length;
  for (let j = from; j <= last; j++) {
    if (s.charCodeAt(j) === 92 /* \ */ && j + 1 < s.length && isEscapable(s[j + 1])) {
      j++;
      continue;
    }
    if (s.startsWith(what, j)) return j;
  }
  return -1;
}

/** The first single * from `from` (one whose run is not **), outside an escape, or -1. */
function findSingleStar(s, from) {
  for (let j = from; j < s.length; j++) {
    const c = s.charCodeAt(j);
    if (c === 92 /* \ */ && j + 1 < s.length && isEscapable(s[j + 1])) {
      j++;
      continue;
    }
    if (c !== 42 /* * */) continue;
    if (s[j + 1] === '*') {
      j++;
      continue;
    }
    return j;
  }
  return -1;
}

/** Whether `s` holds any char that `inline` must treat as special (so the fast path can be skipped). */
function hasInlineSpecial(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 92 || c === 96 || c === 42 || c === 91) return true; // \ ` * [
  }
  return false;
}

/** `s` rendered inline; `env.link(target)` is a link's href. */
export function inline(s, env) {
  // Fast path: no \ ` * [ at all -> only HTML escaping remains.
  if (!hasInlineSpecial(s)) return escapeHtml(s);
  let out = '';
  let i = 0;
  const n = s.length;
  let runStart = 0;
  while (i < n) {
    const c = s[i];
    if (c === '\\' && i + 1 < n && isEscapable(s[i + 1])) {
      out += escapeHtml(s.slice(runStart, i)) + escapeHtml(s[i + 1]);
      i += 2;
      runStart = i;
      continue;
    }
    if (c === '`') {
      const j = s.indexOf('`', i + 1);
      if (j > i + 1) {
        out += escapeHtml(s.slice(runStart, i)) + `<code>${escapeHtml(s.slice(i + 1, j))}</code>`;
        i = j + 1;
        runStart = i;
      } else {
        i++;
      }
      continue;
    }
    if (c === '*') {
      if (s[i + 1] === '*') {
        const j = findUnescaped(s, '**', i + 2);
        if (j > i + 2) {
          out += escapeHtml(s.slice(runStart, i)) + `<strong>${inline(s.slice(i + 2, j), env)}</strong>`;
          i = j + 2;
          runStart = i;
        } else {
          i += 2;
        }
        continue;
      }
      const j = findSingleStar(s, i + 1);
      if (j > i + 1) {
        out += escapeHtml(s.slice(runStart, i)) + `<em>${inline(s.slice(i + 1, j), env)}</em>`;
        i = j + 1;
        runStart = i;
      } else {
        i++;
      }
      continue;
    }
    if (c === '[') {
      const k = findUnescaped(s, ']', i + 1);
      const m = k !== -1 && s[k + 1] === '(' ? s.indexOf(')', k + 2) : -1;
      const target = m === -1 ? '' : s.slice(k + 2, m);
      if (target !== '' && !/\s/.test(target)) {
        out += escapeHtml(s.slice(runStart, i)) + `<a href="${escapeHtml(env.link(target))}">${inline(s.slice(i + 1, k), env)}</a>`;
        i = m + 1;
        runStart = i;
        continue;
      }
      i++;
      continue;
    }
    i++;
  }
  if (runStart < n) out += escapeHtml(s.slice(runStart));
  return out;
}

/**
 * `src` rendered: its HTML (each block on its own lines, a "\n" after the last), its table of contents (every level 2
 * and 3 heading: level, id and its inline HTML) and its excerpt (the first paragraph's inline HTML, or "").
 */
export function renderMarkdown(src, env) {
  const ids = new Set();
  let html = '';
  const toc = [];
  let excerpt = null;
  for (const t of lex(src)) {
    switch (t.type) {
      case 'heading': {
        const id = uniqueSlug(slugify(t.text), ids);
        const h = inline(t.text, env);
        html += `<h${t.depth} id="${id}">${h}</h${t.depth}>\n`;
        if (t.depth === 2 || t.depth === 3) toc.push({ level: t.depth, id, html: h });
        break;
      }
      case 'code': {
        const cls = t.lang === '' ? '' : ` class="language-${escapeHtml(t.lang)}"`;
        let inner = '';
        for (let k = 0; k < t.lines.length; k++) inner += `${escapeHtml(t.lines[k])}\n`;
        html += `<pre><code${cls}>${inner}</code></pre>\n`;
        break;
      }
      case 'hr':
        html += '<hr>\n';
        break;
      case 'blockquote':
        html += t.lines.length === 0 ? '<blockquote>\n</blockquote>\n' : `<blockquote>\n<p>${inline(t.lines.join('\n'), env)}</p>\n</blockquote>\n`;
        break;
      case 'list': {
        const tag = t.ordered ? 'ol' : 'ul';
        const open = t.ordered && t.start !== 1 ? `<ol start="${t.start}">` : `<${tag}>`;
        let items = '';
        for (let k = 0; k < t.items.length; k++) items += `<li>${inline(t.items[k], env)}</li>\n`;
        html += `${open}\n${items}</${tag}>\n`;
        break;
      }
      case 'paragraph': {
        const h = inline(t.text, env);
        if (excerpt === null) excerpt = h;
        html += `<p>${h}</p>\n`;
        break;
      }
    }
  }
  return { html, toc, excerpt: excerpt ?? '' };
}
