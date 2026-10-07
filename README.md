# novel-reader

A personal light-novel reader for Android. It keeps a library of novels from web-novel sites,
downloads chapters for offline reading and cleans up the text the sites mangle. Built with
React, TypeScript and Vite, packaged as an Android app with Capacitor. There is no server: the
phone fetches pages itself.

## What it does

- **Library** with categories (Reading, Plan to read, Completed, Dropped, or your own), unread
  counts and a one-tap check for new chapters.
- **Browse** a site's search, or paste any novel or chapter link.
- **Reader** with resume-where-you-left-off, next-chapter prefetch, light / sepia / dark / black
  themes, Literata or sans text, adjustable size and spacing, and full-screen reading.
- **Offline downloads**: single chapters, the next 10 or 50, all unread, or everything. Chapters
  you open are kept too.
- **Text clean-up**: strips injected anti-piracy lines ("This content has been misappropriated
  from Royal Road…") and repairs paragraphs a site's scraper split mid-sentence. Stored text stays
  exactly as downloaded; fixes apply when a chapter is shown.
- **Quote repair** for chapters a site stripped of quotation marks and apostrophes
  (`Ew, Maya says.`, `Ive`). For a novel linked to its Royal Road original, the quotes come from
  the Internet Archive's copies of its chapters, exactly. Otherwise rules fix the clear cases
  offline, and with a free Groq key (and optionally a free Gemini key) an AI model restores the
  rest with one tap. The original is a tap away. Details in [docs/quote-fixing.md](docs/quote-fixing.md).

Long-press a chapter for more: mark it (and everything before it) read, or download or delete it.

Supported sites: NovelPhoenix. Adding one is a single file (see below).

## Develop

Requires Node 22+.

```bash
npm install
npm run dev      # http://localhost:5174 (fetches sites through a local proxy)
npm test         # parser and text tests
npm run lint
npm run build
```

The browser can't read other sites directly (CORS), so `npm run dev` proxies requests through
Vite. On the phone requests go out natively and need no proxy.

To try AI quote fixing in the browser, put free keys in `.env.local` (gitignored, never commit
it). The dev proxy adds them to AI requests, so they never reach the app:

```
GROQ_API_KEY=...
GEMINI_API_KEY=...
```

On the phone, enter the keys in Settings → AI quote fixing instead.

## Put it on the phone

One-time setup on the phone (a Poco F6, so HyperOS):

1. Settings → About phone → tap **OS version** seven times to unlock Developer options.
2. Settings → Additional settings → Developer options: turn on **USB debugging** and
   **Install via USB**. Xiaomi asks you to sign in to a Xiaomi account for the second one;
   without it installs fail with `INSTALL_FAILED_USER_RESTRICTED`.

One-time setup on the PC:

1. Install Android Studio, then point `JAVA_HOME` at the JDK it ships (Android builds need
   Java 17+, and an older Java on `PATH` breaks them). Open a new terminal afterwards.

   ```bash
   setx JAVA_HOME "C:\Program Files\Android\Android Studio\jbr"
   ```

2. Open the Android project once with `npm run android:open` and let Android Studio finish its
   Gradle sync. That records the SDK location in `android/local.properties`, which command-line
   builds need.

Then, with the phone connected and the USB debugging prompt accepted:

```bash
npm run android
```

That builds the app, copies it into the Android project and installs it. Run it again to update;
your library is kept.

Without a cable: build the APK, copy `android/app/build/outputs/apk/debug/app-debug.apk` to
the phone and open it there.

```bash
npm run sync && cd android && ./gradlew assembleDebug
```

**Keep the signing key.** Android only updates an app signed with the same key. Debug builds use
`%USERPROFILE%\.android\debug.keystore`; back it up. If it's lost, the next install needs an
uninstall, which deletes downloaded chapters. Never commit keystores (the repo is public, and
`.gitignore` blocks them).

## How it's built

```
src/sources/     one file per site: search, novel page, chapter list and chapter parsing
src/db/          IndexedDB (Dexie): novels, chapters, chapter text, categories
src/downloads/   download queue (two at a time, retries)
src/lib/         HTTP, HTML-to-text, junk filter, preferences, theme, Android back button
src/quotes/      quote and apostrophe repair: offline rules, AI client, stored fixes
src/pages/       Library, Browse, Novel, Reader, Settings
```

### Adding a site

1. Create `src/sources/<site>.ts` implementing `Source` (`src/sources/types.ts`). Keep the parse
   functions pure (Document in, data out) so they can be tested.
2. Register it in `src/sources/index.ts`.
3. Add tests with small hand-written fixtures in `src/sources/__fixtures__/`. Copy the site's
   markup structure, not its chapter text.

## Roadmap

- Thoughts unquoted and telepathy in parentheses, on top of the quote repair.
- Optional AI rewrite of machine-translated chapters, with a per-novel glossary.
- Several sources per novel, EPUB export, library backup, volume-key page turning.
