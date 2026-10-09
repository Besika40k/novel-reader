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
  innerHTML. Clean-ups run at render time (`readableParagraphs`, then `applyFixes`), so
  improving a rule improves every stored chapter.
- `src/quotes/`: quote repair, designed and measured in `docs/quote-fixing.md`. Best source: the
  Internet Archive's copy of the Royal Road original, for novels linked to Royal Road
  (`archive.ts` finds it, `transfer.ts` copies only its quote marks onto our text). Otherwise
  offline rules (`rules.ts`) and an OpenAI-compatible client for free tiers (`ai.ts`, automatic
  only when `aiAuto` is on). Fixes live in the `fixes` table by chapter URL and paragraph index
  (`fixer.ts`), and every fixed paragraph must pass `acceptFix` (only quotes and apostrophes
  added). Bump `FIX_VERSION` when the prompt or rules change. Keys live in localStorage on the
  phone; in dev the proxy adds them from `.env.local`.
- All network access goes through `src/lib/http.ts`: CapacitorHttp on the phone, the dev proxy in
  the browser. The phone sends the WebView's own user agent; Royal Road answers 403 to a made-up
  one, and to the dev proxy whatever it sends.
- Preferences live in localStorage (`src/lib/prefs.ts`); the inline script in index.html reads the
  same key to set the theme before first paint.

## Site notes (NovelPhoenix, NovelFire)

- Both run the same site template (LightNovelPub's), parsed once in `src/sources/lightnovelpub.ts`;
  each site is a few lines of config. NovelFire has novels under `/book/` instead of `/novel/` and numbered chapter-list page links instead of a range picker. Their ranking pages
  (`/ranking/most-read`, `/ranking/ratings`) feed the site lists in Browse.
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
- No CSS scroll-driven animations (`animation-timeline: scroll()`): the phone's WebView runs them
  on the main thread in step with the scroll, and fast scrolling missed frames. Follow the scroll
  from script instead (`useScrollPercent` in the reader).
- Never commit keystores, API keys or real chapter text.

## Current work

- 0.4.0 (2026-10-10): History tab; NovelFire as a second source; each site's Most read and Top
  rated lists in Browse; downloads also fetch the quote fix from the Archive; a back-to-top button
  in place of the reading meter; transient system bars, so the status bar hides with the reader's
  bars; a squarer unread badge. Checked in the browser, not yet on the phone. Next: thoughts
  unquoted and telepathy in parentheses (see the doc's "Next").
- No paid APIs: the owner won't buy API credits. AI features use free tiers only (Groq by
  default, Gemini's free tier as a fallback).
- The owner's Claude plan has usage limits, so keep sessions lean: targeted reads and few
  screenshots.

## Releases

- The version lives only in `package.json` (`npm version <x.y.z> --no-git-tag-version`). Gradle
  derives versionName and versionCode from it, and Settings shows it. The owner's scheme: patch
  for visual changes, minor for features, major for a stable release (1.0.0).
- Bump the version on the change's topic branch. After merging: `npm run sync`, then
  `./gradlew assembleDebug` in `android/`; tag `vX.Y.Z` on main and push the tag; publish a
  GitHub release `vX.Y.Z` with short notes and the APK attached as `LN-Jormungandr-X.Y.Z.apk`.
- Release APKs are debug builds signed with this PC's `~/.android/debug.keystore`, the key of the
  owner's install, so updates keep the library. A few friends may install them; personal use,
  not on any store, never commercial.

## Git

- One topic branch per change (`feat/…`, `fix/…`, `chore/…`), merged into `main` with `--no-ff`;
  delete merged branches. Ask before merging.
- Commit messages: subject and body only. No AI co-author trailers or "generated with" lines.
