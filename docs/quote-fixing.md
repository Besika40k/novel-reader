# Quote fixing (phase 2)

Some NovelPhoenix chapters lost their curly quotes and apostrophes to the site's scraper:
`Ew, Maya says.` instead of `"Ew," Maya says.`, and `Ive` instead of `I've`. Often only part of
a chapter is affected. This feature puts them back. Status: built (`src/quotes/`). The best
source, where it exists, is the Internet Archive's copy of the Royal Road original (below); the
rules and AI cover the rest.

## Constraints

- **No paid APIs.** The owner won't buy API credits. AI fixing uses free tiers only: **Groq** by
  default, with **Gemini's free tier** (an AI Studio key) as an optional fallback. A Google One
  subscription doesn't include API access; the free tier is separate and open to any Google
  account.
- Keys live on the phone only (localStorage, entered in Settings). Never in the repo, never in
  a build.
- Stored chapter text stays untouched (see CLAUDE.md). Fixes are a separate layer, and the reader
  can show the original.

## Pipeline

For each chapter, at render time (`ReaderPage`):

1. `readableParagraphs` drops junk and returns `{ index, markup }`, keeping each paragraph's
   index in the stored array, because fixes are keyed by it.
2. **Detection**, `analyseChapter`, counts
   - unquoted speech paragraphs: no double quote, but a speech tag (`Ew, Maya says.`,
     `So I answer, See…`), and
   - stripped contractions (`Ive`, `dont`, …).

   A chapter needs fixing with at least 2 unquoted speech paragraphs, or 1 plus at least 3
   stripped contractions. Quoted paragraphs don't count against it: the scraper often strips only
   part of a chapter (chapter 252 has 9 quoted paragraphs and 5 tagged unquoted ones).

3. `applyFixes`: the stored fix of each paragraph, from the Archive or the AI (checked again by
   `acceptFix`); otherwise the rules, which also take the paragraphs an Archive fix `missed`.

## Archived originals (`archive.ts`, `transfer.ts`, free, no key)

Every mirror of this novel (NovelPhoenix, NovelFire, NovelFull, FreeWebNovel, ReadNovelFull)
has the same stripped text, and Royal Road removed chapters 12–695 when the novel went to Kindle.
The Internet Archive kept Royal Road's own pages, quotes intact: 446 of 456 chapters in 240–695
and all of 12–239 (checked 2026-10-07).

- **Link**: a novel stores `royalRoadUrl` (novel page → "Quotes from Royal Road"). The sheet can
  find it with Royal Road's title search, but Royal Road's bot protection rejects some clients
  (Node's fetch and so the dev proxy get 403), so pasting the link always works too.
- **Index**: one CDX query per novel lists the archived chapter pages (`cdxUrl`, filtered to
  `/chapter/<id>/<slug>` with status 200; about 2,200 lines for this novel). `parseCdx` groups
  them by Royal Road's chapter id, which survives the novel's URL changing, and takes the number
  from the slug. The index is cached in the `archives` table and fetched again, at most weekly,
  when a chapter isn't in it.
- **Chapter**: `findArchivedChapter` matches the number in the chapter title (Royal Road's
  "Chapter 250 - Surrounded" is NovelPhoenix's "Chapter 250: Surrounded"), then the words. The
  page comes from `web.archive.org/web/<timestamp>id_/<url>` (the page as served, no toolbar),
  newest copy first; the text is `.chapter-inner`.
- **Transfer** (`transferQuotes`): each copy paragraph is found in the original by its letters
  and digits alone, on word boundaries and in order, so paragraph breaks, Royal Road's extra
  anti-theft lines and punctuation differences don't matter. Short paragraphs only count near
  the previous match. A paragraph the original words slightly differently ("staring" vs
  "starting", a dropped word) is aligned character by character (longest common subsequence)
  within the gap its neighbours leave, if 85% of its letters line up. Then only quotation marks
  and apostrophes move: each run of marks is attached to its neighbouring character in the
  original (opening marks to the next, closing marks and apostrophes to the previous) and
  placed at that character's partner in the copy, outside adjacent `<b>`/`<i>` tags. Every
  paragraph still passes `acceptFix`.
- **Measured** on chapters 130, 250, 420 and 610: every story paragraph placed (the only miss was
  NovelPhoenix's own "Read the official version…" line), including the 5 reworded paragraphs of
  chapter 420. Chapter 250 got 21 quoted paragraphs where the rules found 14. Chapter 130 was
  flagged by detection but its copy already had the quotes, so nothing changed.
- Stored as a `QuoteFix` with `models: ['Royal Road']`, `through` covering the chapter and the
  unplaced paragraphs in `missed`. It replaces an AI fix (`isSettledFix`).

## Rules (`rules.ts`, offline, no key)

- **Apostrophes**, in every chapter: an unambiguous dictionary only (`dont doesnt … mustve`, plus
  `Id`/`Ill` before a lower-case word). Keeps the original capitalisation and uses straight `'`.
  Skips `its well were wed lets hell shell` and possessives; those are left to the AI.
- **Quotes**, only in chapters that need fixing and in paragraphs the AI hasn't been through:
  - `Speech[,!?…] Speaker verb…` → `"Speech[,!?…]" Speaker verb…`, also `verb Speaker`.
  - `…Speaker verb, Speech` → `…Speaker verb, "Speech"`; the quote runs to the end of the
    paragraph. Also `and verb,` (`He turns and says, We go.`).
  - Speakers: `I he she they we`, capitalised names (`Min-Jae`), `the/my/his/her/their/our` plus
    one or two words. Verbs: say, ask, reply, answer, shout, yell, whisper, mutter, murmur,
    mumble, scream, exclaim, continue, add, respond, retort, snap, growl, hiss, grumble, tell, in
    their present and past forms.
  - Guards against narration: what follows the tag must end it (`he says.`, `he asks quietly,`,
    `I say and …`), so `he says nothing` and `she says she will come` don't match. No
    quote when the text before the tag holds a full sentence (`I look at him. Why? I ask.`),
    starts with a narration opener (`After a moment,`, `Seeing this,`) or is one adverb
    (`Still,`, `Slowly,`); nor after `as I said,` or in a clause like `When they ask, I answer.`
  - Quotes go outside `<b>`/`<i>`; tags never move. Paragraphs with any double quote, or a line
    break, are left alone.

On chapter 252 the rules quote exactly the 5 tagged lines, with no false positives.

## AI fix (`ai.ts`, `fixer.ts`)

- **One OpenAI-compatible client** (`POST {baseUrl}/chat/completions`), providers tried in order:
  - Groq, `https://api.groq.com/openai/v1`: `openai/gpt-oss-120b`, then `openai/gpt-oss-20b`.
    Groq limits each model separately. gpt-oss gets `reasoning_effort: "medium"`; "low" missed
    most of the untagged speech in testing.
  - Gemini, `https://generativelanguage.googleapis.com/v1beta/openai`,
    `gemini-flash-lite-latest`.
  - Model lists are editable in Settings, because free tiers change. (Groq's `qwen/qwen3.8-27b`
    did well in one test, but its free tier allows only 1,000 output tokens a minute.)
- **Input**: the text with the rules already applied, so the model only has the hard cases. Lines
  of `<index>: <markup>`, with line breaks inside a paragraph sent as `<br>`.
- **Output**: every paragraph back in the same line format. Asking for JSON with only the changed
  paragraphs made models return fragments of sentences.
- **Chunks** of at most 5,000 characters. With medium reasoning a request uses about one token
  per character, under Groq's 8,000 tokens a minute.
- **Rate limits**: on a 429, `retry-after` (or "try again in 7m12s" in the message) of 60 s or
  less means wait and retry the same model; longer means the daily limit: that model rests until
  then and the next one is tried. When all are resting: "Free AI limit reached. It frees up again
  in about …". A refused key skips to the next provider.
- **System prompt**: in `ai.ts`. It asks for quotes around words spoken aloud and apostrophes,
  nothing else; narration and inner monologue unquoted; telepathy in parentheses unchanged; with a
  six-line example.
- **Verification**, `acceptFix`, per paragraph: after removing every quote and apostrophe
  (`" “ ” „ ' ‘ ’`) and collapsing spaces, it must equal the original, with at least as many
  quote marks. Curly quotes become straight ones and entities are normalised. A refused paragraph
  keeps the rules' version.
- **Storage**: Dexie version 2 adds `fixes: 'url'` holding `QuoteFix` (`db.ts`): the changed
  paragraphs by index, `through`, `complete`, `models` and `version`. It's saved after every
  request; a fix cut short by the limit resumes after `through`. `FIX_VERSION` in `fixer.ts` is
  bumped when the prompt or rules change, so old fixes are redone. Deleting a chapter's download
  deletes its fix.
- **Measured** (2026-10-07, chapter 252, 14K characters): 3 requests, about 30 seconds, about
  6K tokens each. Groq's 200K tokens a day per model is about 12 such chapters per model, so
  about 25 a day with both gpt-oss models. A Gemini key adds more. The model quoted 8 lines, all
  correctly, including untagged ones, and still missed about 5 lines of speech that follow an
  action beat (`I jump to my feet. We should test…`).

## UI

- **Novel page → Quotes from Royal Road**: link, find by title, or remove the link.
- **Settings → AI quote fixing**: Groq key and models, Gemini key and models, "Fix with AI
  automatically" (`aiAuto`, off by default since the Archive fix: the free limits run out after
  a few chapters and the AI's quotes were often wrong), and "Test keys".
- **Reader**, on a chapter that needs fixing, a line under the title:
  - "Dialogue quotes are missing in this chapter." with **Fix from Royal Road** for a linked
    novel, **Fix with AI** with a key, or **Set up** without either (it opens Settings at the AI
    section).
  - "Fixing quotes… 2/3" while it runs; the rules' version shows meanwhile.
  - "Quotes from Royal Road" or "Quotes fixed by AI" with **Show original**, which shows the
    source text without any fixes.
  - Errors, with **Try again**.
- **Automatic mode** fixes the open chapter once per session, then the next chapter when it's
  stored (the reader prefetches it), at most one chapter a minute. A linked novel always uses it
  (from the Archive); AI joins in only with `aiAuto` on.

## Development

- `.env.local` (gitignored) can hold `GROQ_API_KEY` and `GEMINI_API_KEY`. The dev proxy in
  vite.config.ts forwards POST bodies and `retry-after`, and adds `Authorization` for
  api.groq.com and generativelanguage.googleapis.com when the request has none. The app learns
  only which providers have a key (`__DEV_AI_PROVIDERS__`, empty in builds), never the keys.
- `postJson()` in `src/lib/http.ts`: CapacitorHttp.post on the phone, the proxy in the browser.
  It returns every status, since API errors carry the retry details.
- Tests: `rules.test.ts` (apostrophes, both quote patterns and their guards, tags, detection,
  verification, applyFixes), `ai.test.ts` (chunking, prompt and reply parsing, and the 429
  fallbacks with a mocked `postJson`), `transfer.test.ts` (placement, reworded paragraphs,
  markup) and `archive.test.ts` (CDX parsing, chapter matching, page and search parsing).

## Next

- Thoughts unquoted and telepathy in parentheses (the owner's original request), probably as
  prompt and rule changes plus a `FIX_VERSION` bump.
- A Royal Road source would give chapters 696+ of this novel with quotes intact (they're free
  there; the Archive may lack the newest).
- The junk filter misses notices without a site name ("The narrative has been taken without
  permission. Report any sightings.", "Read the official version to support the creator.").
  An Archive fix could mark copy paragraphs it can't place that look like notices.
- Novels with no Archive copy: the test bench and on-device statistical model (option B) from the
  owner's plan, if the rules aren't enough.
