# CLAUDE.md

Personal light-novel reader for the owner's Android phone (Poco F6, HyperOS). Vite + React 19 +
TypeScript + Sass CSS modules, packaged with Capacitor 8. No backend: the phone fetches sites
natively. Public repo, single user.

## Commands

- `npm run dev`: dev server on port 5174, with a `/__proxy` for site requests (vite.config.ts)
- `npm test`: Vitest (jsdom) for parsers and text handling
- `npm run build`: `tsc -b` then `vite build`. Run build, lint and test before calling work done.
- `npm run android`: build, sync and install on a connected phone. Needs `JAVA_HOME` pointing at
  Android Studio's `jbr`; the PATH Java is 8.
- The Gradle wrapper is pinned to 9.1.0 (Capacitor's template ships 8.14.3): Android Studio's
  bundled JDK is 25, which Gradle 8 can't run ("Unsupported class file major version 69").

## Architecture

- `src/sources/`: one `Source` per site (`types.ts`). Parse functions are pure (Document in, data
  out) and tested with hand-written fixtures that copy the site's markup, never its chapter text.
  Everything outside `sources/` works with the shared shapes only.
- `src/db/`: Dexie. IndexedDB can't index booleans, so flags are `0 | 1`. Chapters are keyed by
  URL and ordered by `index` (position on the site, not the number in the title).
- Stored chapter text (`ChapterContent.paragraphs`) is the source's text exactly, in the inline
  markup of `src/lib/inline.ts` (escaped text plus `<b>`/`<i>`), rendered by `Inline` without
  innerHTML. Clean-ups (junk filter, and the planned quote fixes) run at render time
  (`readableParagraphs`), so improving a rule improves every stored chapter.
- All network access goes through `src/lib/http.ts`: CapacitorHttp on the phone, the dev proxy in
  the browser.
- Preferences live in localStorage (`src/lib/prefs.ts`); the inline script in index.html reads the
  same key to set the theme before first paint.

## Site notes (NovelPhoenix)

- Server-rendered; plain GET works behind Cloudflare. The chapter list is paginated at
  `/novel/<slug>/chapters?page=N` (100 per page); `getChapterList` only refetches pages that can
  hold new chapters.
- The URL number (`/chapter-252`) is the site position; titles have the author's numbering.
- Its scraper strips curly quotes and apostrophes in some chapter ranges ("Ive", dialogue without
  quotes), sometimes closes `<p>` mid-sentence, and injects Royal Road and NovelPhoenix
  anti-piracy lines. The search page also lists "Some Popular Novels", which the parser skips.

## Conventions

- React Compiler lint rules are on (`react-hooks` v7): no setState synchronously in effect
  bodies, no ref access or module-variable writes during render.
- Colours are role variables in `src/styles/global.scss` (themes: light, sepia, dark, black).
  Palette is the owner's: slate, sage, ice, abyss, ember, rose. Ember (`--accent`) marks active
  state and progress only, never text.
- Fonts are bundled (offline): Literata (reading), Schibsted Grotesk (UI), Grenze (page titles).
- The app draws edge to edge; use the `--safe-*` variables for system bars. The reader's text
  padding deliberately ignores the top inset (it changes when full-screen hides the bars).
- Never commit keystores, API keys or real chapter text.

## Git

- One topic branch per change (`feat/…`, `fix/…`, `chore/…`), merged into `main` with `--no-ff`;
  delete merged branches. Ask before merging.
- Commit messages: subject and body only. No AI co-author trailers or "generated with" lines.
