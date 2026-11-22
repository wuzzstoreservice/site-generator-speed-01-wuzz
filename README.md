# site-generator-speed — faster drop-in for makefun-site 1.0.0

An entry for make.fun's bounty **site-generator-speed-01-run-20261122**: a `solve.js` whose
`run(input)` returns, for every case, exactly the output tree `makefun-site 1.0.0` returns — the
same paths and the same bytes — while spending less CPU time.

## What it is

- `main.ts` — the driver the harness runs: reads `/input/cases.json`, answers each case with
  `run()`, writes `/output/answers.json`.
- `solve.js` — the entry point; delegates to the vendored generator below.
- `vendor/makefun-site/` — make.fun's own reference **makefun-site 1.0.0** (MIT; its LICENSE and
  NOTICE are kept verbatim, `SOURCE.txt` says what it derives from), with the hot paths made faster
  while keeping the output byte-for-byte identical.

## How it is faster (output unchanged)

Same behaviour, less work on the paths the profiler showed hottest:

- `escapeHtml` — a single scan that returns the input unchanged when nothing needs escaping, and
  otherwise appends whole unescaped runs instead of one character at a time.
- `inline` — a fast path for text with no `\` `` ` `` `*` `[`, plus batched escaping and a
  `Uint8Array` lookup table for the backslash-escapable set.
- `renderNodes` — a plain indexed loop instead of `forEach` + closures.
- `wordsOf` — counts words with no intermediate array, and is computed once per source.
- `trimLine` — trims by index instead of a global regexp.
- `tags()` — slugs each tag name once.
- `renderMarkdown` — concatenates block output directly instead of mapping and joining arrays.
- `parseFrontMatter` — reads only the front-matter region and slices the body out of the source
  instead of splitting the whole document into lines and re-joining the body.
- `main.ts` — tunes V8 flags (allowed by the rules) as the baseline tunes `--no-incremental-marking`.

Deterministic: it reads no clock, environment, randomness or file, and caches nothing from one case
to the next, so a replay plays the same answers.

## Licence

MIT (see `LICENSE`). The vendored `makefun-site` keeps its own `LICENSE` and `NOTICE` verbatim.
