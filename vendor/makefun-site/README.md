# makefun-site 1.0.0

make.fun's own static site generator. `build(input)` (index.js) turns one site's sources into its output tree. The
code is the reference: where this file and the code differ, the code's answer is the answer. Everything here is
makefun-site's own dialect. It is not Jekyll's, Hugo's, Eleventy's or metalsmith's, and its Markdown is not
CommonMark.

## Input and output

    { site: { title, base_url, per_page, recent }, templates: { <name>: <source> }, files: [{ path, content }] }

The output is a JSON object: each output path (relative, "/"-separated) and the text of that file. A build reads no
clock, no environment, no randomness and no file: its output depends on its input alone.

## The build, in order

1. **Sources.** The files are sorted by path in code-unit order, whatever order they arrive in. A file whose path ends
   in `.md` is a source, its `\r\n` and lone `\r` made `\n`; any other file is static.
2. **Templates.** Every template is parsed, in code-unit order of its name. One that does not parse is reported and
   left out, as if it were not there.
3. **Front matter** (below). A source whose front matter is refused is reported (`refused <path>: <reason>`) and
   dropped. So is a source under `tags/` or `page/` (`<dir>/ is the generator's own`), a post (a source under `posts/`)
   with no date, and a source whose layout is no template that parses. A source with `draft: true` is reported
   (`draft <path>`) and dropped. The checks run in that order, and the first one that fails is the one reported.
4. **Permalinks.** A post's directory is `posts/`; a page's is its source's directory (`docs/a/x.md` is in `docs/a`).
   Its slug is its `slug` key, or the slug of its title (below), made unique in its directory in source order: the
   first of `s`, `s-2`, `s-3` and so on not yet taken. At the root, `posts`, `tags` and `page` are taken from the start.
   The page is written to `<directory>/<slug>/index.html`, and its url is `<base>/<directory>/<slug>/`, where `<base>`
   is `site.base_url` with its trailing slashes dropped.
5. **Markdown** (below), each source's body rendered to HTML, its links resolved.
6. **Collections.** The posts, newest date first, and equal dates by slug in code-unit order. Each post's `newer` is
   the one before it in that order and its `older` the one after (null at either end).
7. **Tags.** Each post's tags, each slug once (the first spelling kept), in its own order. A tag is all the posts
   whose tags have its slug, named as it is first met walking the posts in collection order; its url is
   `<base>/tags/<slug>/`. Tags are ordered by their count of posts, most first, then by slug. A page's tags link to the
   tag of the same slug, or have the url "" where no post has that tag.
8. **Layouts.** Every page through its layout (its `layout` key, else `post` for a post and `page` for a page), with
   `page`. The index through `index`, `site.per_page` posts a page: `index.html`, then `page/2/index.html` and on (at
   least one, even with no posts), with `posts` and `pager`. Each tag through `tag` at `tags/<slug>/index.html`, with
   `tag`; and `tags/index.html` through `tags`. An index, tag or tags page whose template is missing is not written.
   Every template also sees `site`, `tags` and `recent`. Then each static file at its own path, its text as given,
   unless a built page has that path (reported: `shadowed <path>: a built page has its path`).
9. **The report**, `build-report.txt`: every line reported above and each broken link
   (`broken-link <source> -> <target>`, each once), sorted in code-unit order, then
   `built <n> pages, <n> posts, <n> tags and <n> static files`, every line ending in `\n`.

## What templates see

- `site`: `title`, `base_url` (`<base>`).
- `tags`: every tag, each `name`, `slug`, `url`, `count`.
- `recent`: the first `site.recent` posts, as cards.
- A card: `title`, `url`, `date` (the string, or ""), `date_long`, `summary` (its `summary` key, or ""), `excerpt`
  (the HTML of its body's first paragraph, or ""), `reading_minutes` (the body's words, runs of characters other than
  whitespace, over 200, rounded up, at least 1) and `tags` (each `name`, `slug`, `url`).
- `page`: a card of the page, and `slug`, `content` (its body's HTML), `toc` (each level 2 and 3 heading: `level`,
  `id`, `html`), `newer` and `older` (each `title`, `url`, `date`, `date_long`, or null; null for a page) and
  `is_post`.
- On an index page, `posts` (that page's cards) and `pager`: `number`, `total`, `url`, `newer_url` and `older_url` (""
  where there is none). On a tag page, `tag`: `name`, `slug`, `url`, `count` and `posts` (its cards).

## Front matter

A source opens on the line `---`, and its front matter runs to the next line that is exactly `---`. Every line
between is blank (spaces and tabs only), a comment (opening on `#`), or `key: value`: a key of a-z and `_`, a colon,
one space and the value, its trailing spaces and tabs dropped. The first line that fails refuses the source with its
reason: `no front matter`, `the front matter is not closed`, `line <n> is not "key: value"` (n counted from 1 at the
opening `---`), `unknown key "<k>"`, `key "<k>" is given twice`, `key "<k>" has no value`, or the key's own reason
below. Then a source with no title is refused (`no title`). The keys:

- `title`, `summary`: a string, either quoted (`"..."`, whose only escapes are `\"` and `\\`, with no other quote
  inside) or bare (the rest of the line, never opening on `"` or `[`).
- `date`: `YYYY-MM-DD`, a real day from 1970-01-01 to 2099-12-31. It stays a string.
- `tags`: `[a, b, c]`, each name trimmed, none empty or holding `"`, `[` or `]`; `[]` is no tags.
- `draft`: `true` or `false`.
- `layout`: a template's name (a-z, 0-9 and `-`).
- `slug`: a slug (a-z and 0-9, single `-` between), at most 64 characters.

## Text

- HTML escaping replaces `&` `<` `>` `"` `'` with `&amp;` `&lt;` `&gt;` `&quot;` `&#39;`, and nothing else.
- A slug: the text in Unicode NFKD, its combining marks (`\p{M}`) dropped; A-Z lowered; each run of characters other
  than a-z and 0-9 one `-`, none at either end; cut to 64 characters, a `-` left at the cut dropped; `untitled` when
  nothing is left.
- `date_long`: the date in words from the string alone: `2026-11-09` is `9 November 2026`.

## Markdown

The body is read line by line. A block starts at each line that is not blank:

- A **fence**: a line of three backticks and an optional language (A-Z, a-z, 0-9, `_`, `+`, `-`), then spaces or
  tabs only. Its body runs to a line of three backticks (spaces or tabs after them), or to the end. Each body line is
  escaped and ends in `\n`: `<pre><code class="language-<lang>">...</code></pre>`, no class without a language.
- A **heading**: 1 to 6 `#`, at least one space or tab, then text (spaces and tabs at its end dropped; closing `#`s are
  kept as text). `<hN id="<id>">inline</hN>`: the id is the slug of the heading's text as written, made unique in the
  page as slugs are (`-2`, `-3`). With no text after the `#`s, or 7 or more `#`, the line is not a heading.
- A **thematic break**: `---` or `***`, then spaces or tabs only: `<hr>`.
- A **blockquote**: the lines opening on `>`, each with the `>` and one space after it dropped, then trimmed; the
  empty ones dropped. `<blockquote>\n<p>inline</p>\n</blockquote>`, or `<blockquote>\n</blockquote>` when none is left.
- A **list**: a line `- `, `* ` (a bullet list) or digits and `. ` (an ordered list), and each following line of the
  same kind is another item; a line of two or more spaces then a non-space continues the item (trimmed, after a `\n`).
  Any other line ends the list. No nesting. `<ul>\n<li>inline</li>\n...</ul>`; an ordered list whose first number
  is not 1 opens `<ol start="n">`.
- A **paragraph**, any other line, and the lines after it up to a blank line, a fence, a heading or a thematic break
  (so a `---` under text is a break, never a heading). Each line is trimmed of spaces and tabs at both ends, and the
  lines are joined by `\n`: `<p>inline</p>`.

The blocks are written in order, each followed by `\n`. Indented lines are not code; `=` underlines are text.

Inline, left to right:

- `\` before one of `` \ ` * _ [ ] ( ) # + - . ! > `` writes that character (escaped); any other `\` is itself.
- A backtick opens a code span closed by the next backtick, with at least one character between:
  `<code>escaped</code>`. A backtick with no closer is itself.
- `**` opens strong, closed by the next `**` not escaped, with at least one character between:
  `<strong>inline</strong>`; with no closer, `**` is itself.
- A single `*` opens emphasis, closed by the next single `*` (one not beside another `*`) not escaped, with at least
  one character between: `<em>inline</em>`; with no closer, `*` is itself. `_` is always itself.
- `[text](target)`: the first `]` not escaped closes the text, `(` must follow at once, and the next `)` closes the
  target, which must not be empty or hold whitespace. Else `[` is itself. `<a href="escaped href">inline text</a>`.
- Every other character is written escaped. Raw HTML is text.

A link's href: a target with a scheme (`https:`, `mailto:` ...), opening on `/` or opening on `#` is kept as written.
Any other is a path from the source's directory (`.` and `..` steps, never above the root), with an optional `#`
fragment: the url of the page built from that source, or `<base>/<path>` of a static file, the fragment after it. A
target that names neither is reported as a broken link and kept as written.

## Templates

- `{{ path }}` writes the value, escaped; `{{{ path }}}` writes it raw. A path is names joined by `.` (a-z, A-Z, 0-9 and
  `_`, from a letter or `_`), with spaces allowed inside the braces around it.
- `{% for x in path %}...{% endfor %}` renders its body for each element of an array (anything else renders nothing),
  with `x` bound to the element and `loop` to `index` (from 1), `first`, `last` and `length`.
- `{% if path %}...{% else %}...{% endif %}`, and `{% if not path %}`; the else is optional. Undefined, null, false,
  "", 0 and an empty array are false; anything else is true.
- `{% include "name" %}` renders the template `name` in the same scope; a missing one, or one nested more than 8 deep,
  renders nothing.
- A `{% %}` tag alone on its line (only spaces or tabs beside it) takes the whole line with it, its `\n` included.
  Text, `{{ }}` and `{{{ }}}` never do.
- A path's first name is read from the innermost loop that binds it (`loop` before the element), else from the page's
  values; each next name is an own property of the value so far, or the path is undefined. A value is written as: a
  string itself; a number in JavaScript's own digits; `true` or `false`; an array as its items written and joined by
  `, `; anything else as "".
- A template does not parse when a `{{`, `{{{` or `{%` is not closed, a path is not one, a tag is none of the above,
  or a for or if is not closed or closed out of order; the report names it: `template "<name>": <reason>`.
