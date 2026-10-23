# Jormungandr pet and ideas from LNReader (plan)

Nothing here is built. Two parts: features worth taking from LNReader, the best-known open-source
light-novel reader for Android (`lnreader/lnreader`), and a reading pet on its own tab, a snake
that grows into Jormungandr as chapters are read.

## Part 1: ideas from LNReader

What this app already has (library categories, History, Browse with site lists and filters,
search across sites, downloads, reader font/size/line height/justify/immersive, four themes, quote
repair, notice filtering) is left out. Listed by value for one reader on one phone.

| Idea                       | What it is in LNReader                                    | Fit here                                                                                                                                                     | Cost   |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Backup and restore         | Export the library, progress and settings to a file       | High. Everything lives in one IndexedDB; a lost phone or a reinstall with a different key loses it, and the pet makes it worse. Dexie export to JSON, shared via Capacitor Share; import merges. | Small  |
| Library updates            | An Updates list of new chapters, refreshed on a schedule  | High. `getChapterList` already fetches only new pages. Start with "refresh library" on demand plus a "new" badge; background refresh later (Android WorkManager plugin). | Medium |
| Text to speech             | Reads chapters aloud, keeps going with the screen off     | High for long novels. A Capacitor TTS plugin reads `readableParagraphs` with fixes applied; highlights the current paragraph; background play needs a media notification. | Large  |
| Reading statistics         | Chapters read, time, genres                               | High, and it's the pet's data source too (Part 2). Pairs with `docs/reader-insights.md`.                                                                      | Small  |
| Volume keys and tap zones  | Volume buttons scroll a page; tap left/right to page      | Medium. Needs a small native listener for volume keys; tap zones are pure web.                                                                               | Small  |
| Auto-download next chapters| Keep the next N chapters downloaded while reading          | Medium. Reading offline on the go without thinking about it.                                                                                                 | Small  |
| Swipe to next chapter / auto-scroll | Gestures at the chapter ends; a steady scroll speed | Medium. Auto-scroll must follow the rule against scroll-driven CSS: drive it from script.                                                                    | Small  |
| Source migration           | Move a novel to another site, keeping progress            | Medium. NovelPhoenix and NovelFire share a template; match chapters by number in the URL.                                                                     | Medium |
| Bookmarks                  | Mark a chapter or spot to come back to                    | Low to medium.                                                                                                                                               | Small  |
| Paragraph spacing, margins, custom CSS | Finer reader layout controls                  | Low to medium. Spacing and margins are two more prefs; custom CSS isn't worth it.                                                                             | Small  |
| Trackers (AniList, MAL)    | Sync progress to tracking sites                           | Low. Single user, no account use.                                                                                                                            | Skip   |

Text to speech only if a free voice sounds good enough. Candidates to try before building it:
the phone's own Android TTS engine with Google's offline neural voices (free, already on the
phone, `@capacitor-community/text-to-speech`); Piper or Kokoro running on the phone (open
voices, offline, but large models and heavier on the battery); Microsoft Edge's online neural
voices (free and very good, but an unofficial endpoint that can stop working). Compare a chapter
read by each on the phone first.

Suggested order: backup first (it protects everything after it), then reading statistics (the pet
needs them), then library updates (0.7.0). The pet, reader layout, download ahead, tap to turn and bookmarks
followed in 0.8.0. Auto-scroll and volume-button paging were dropped: the owner doesn't want them.

## Part 2: the Jormungandr pet

A snake on its own tab that hatches, grows and finally circles the world with its tail in its
mouth. It feeds on chapters read; outfits and colours unlock along the way.

### Rule one: the reader pays nothing

- **One write per chapter, in the write that already happens.** When a chapter is marked read
  (`src/db/library.ts`, and wherever the reader marks a chapter read at the end), the same Dexie
  transaction adds 1 to a single `pet` row. No extra reads, no rendering, no timers in the reader.
- **Feeding happens on the Pet tab.** The tab compares `chaptersRead` with `lastSeenChapters`, plays
  a short "eats N morsels" animation (capped, so 300 chapters doesn't mean 300 bites), then shows
  any level-ups and unlocks, and saves `lastSeenChapters`.
- **The tab is lazy-loaded** (`React.lazy`), so its code and art aren't in the bundle the reader
  starts with.
- **Animation only while visible.** CSS keyframes on `transform`/`opacity` only (they run on the
  compositor), paused when the tab unmounts or the app goes to the background
  (`visibilitychange`), and off for `prefers-reduced-motion`. No canvas loop, no physics.
- **Art is SVG built from parts**, not images per stage: a body path whose length, thickness and
  curl come from the level, plus layers for head, eyes, scales pattern, outfit. A few KB, sharp at
  any size, and colours come from theme variables.

### Data

One row in a new Dexie table (`db.version(n).stores({ pet: 'id' })`, a single row with id `'me'`):

```ts
interface Pet {
  id: 'me';
  name: string;               // "Jormungandr" until renamed
  chaptersRead: number;       // the food; only grows
  lastSeenChapters: number;   // what the Pet tab has already animated
  hatchedAt: number;
  unlocked: string[];         // catalog ids
  equipped: { skin: string; pattern: string; head?: string; neck?: string; aura?: string; scene: string };
}
```

- **Backfill once** when the table is created: count chapters already read (`chapters` where
  `read = 1`) so the snake starts at the stage the library has earned. `lastSeenChapters` starts at
  the same number, so the first visit doesn't replay the whole history.
- **What counts as a chapter:** a chapter finished in the reader (marked read at the end or
  scrolled past ~90%). "Mark all previous as read" on the novel page changes the library but
  doesn't feed the snake, or catching up on a novel read elsewhere would make it a giant on day one.
- **Streaks** come from `history` (one row per novel per day), read on the Pet tab only.
- The catalog (stages, outfits, unlock rules) is a static file, `src/pet/catalog.ts`, so adding an
  outfit is a code change, not a migration.

### Growth

Level from chapters read, steep enough that the last stage is a long-term goal (the owner reads
novels of 700+ chapters): `level = floor(sqrt(chaptersRead / 2))`, so level 10 is 200 chapters,
level 30 is 1,800, level 50 is 5,000.

| Stage | Level | ~Chapters | Look                                                                 |
| ----- | ----- | --------- | -------------------------------------------------------------------- |
| Egg   | 0     | 0         | A rune-marked egg that wobbles and cracks as the first chapters land |
| Hatchling | 1 | 2         | Tiny, big eyes, a few body segments                                  |
| Snake | 8     | 130       | Longer, scales visible, flicks its tongue                            |
| Serpent | 18  | 650       | Thick coils, horns start, can wear neck and head pieces              |
| Sea serpent | 30 | 1,800  | Fins, the scene turns to ocean, it coils around a ship or island     |
| World Serpent | 45 | 4,000 | Circles a small Midgard, the coil closes as levels rise            |
| Jormungandr | 60 | 7,200  | The ring closes: tail in its mouth around the world, slow drift and glow |

Within a stage, each level adds length and girth, so there's visible growth every few chapters,
not only at the jumps.

### Personalisation

Unlocks are earned, never bought. Rules are plain functions over the pet row, `history` and the
library, checked only on the Pet tab.

- **Skins** from the owner's palette: slate, sage, ice, abyss, ember, rose, unlocked by stage.
  Ember stays a highlight (eyes, runes), in keeping with the rule that it marks active state.
- **Patterns:** plain, bands, diamond back, runes along the spine (reuse `Rune`), starfield
  (late).
- **Head and neck:** horns, a crown, a Viking helm, a torc, a scarf; a "Fenrir's chain" for a long
  streak.
- **Auras and scenes:** mist, embers, northern lights; scenes: forest floor, cave, fjord, deep
  sea, Midgard.
- **Milestone unlocks:** first novel finished, 7- and 30-day streaks, 100 chapters of one novel, a
  chapter read after midnight, five genres read (ties into `docs/reader-insights.md`).
- **Wardrobe sheet** on the tab: tap a slot, pick from what's unlocked, locked items show what
  earns them.

### Small touches (optional, off by default)

- A one-line toast at the end of a chapter when it causes a level-up.
- The snake reacts when tapped (a hiss, a curl); it sleeps when nothing was read for a few days and
  wakes when you come back.
- A shareable PNG of the snake (SVG to canvas, only when asked).

### Build order

1. `pet` table, backfill, the +1 in the mark-read transaction, tests for "counted once" and "bulk
   mark-read doesn't count".
2. Pet tab (lazy) with the stage renderer: body path from level, head and eyes, idle animation.
3. Feeding animation and level-up/unlock reveal.
4. Catalog, unlock rules, wardrobe sheet.
5. Late stages and scenes (sea, Midgard, the closed ring).
6. Backup (Part 1) includes the pet row.

Check on the phone at each step: open a chapter, scroll fast and make sure frames don't drop, and
look at the Pet tab with the app backgrounded and brought back.
