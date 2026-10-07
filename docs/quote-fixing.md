# Quote fixing (phase 2)

Some NovelPhoenix chapters lost their curly quotes and apostrophes to the site's scraper:
`Ew, Maya says.` instead of `"Ew," Maya says.`, and `Ive` instead of `I've`. This feature puts
them back. Status: designed, not built yet.

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

For each chapter, at render time:

1. `readableParagraphs` drops junk. It must now return `{ index, markup }`, keeping each
   paragraph's index in the stored array, because fixes are keyed by that index.
2. **Detection**: `analyseChapter(paragraphs)` counts
   - unquoted speech paragraphs: no quote character, but a speech tag
     (`<speaker> <verb>` or `<verb> <speaker>`, or `I answer, …`), and
   - stripped contractions (`Ive`, `dont`, `isnt`, …).

   A chapter needs quote fixing when it has at least 2 unquoted speech paragraphs.

3. **AI fix**, when one is stored: use the AI text for the paragraphs it changed.
4. **Rules**, always on, offline, no key:
   - Apostrophes, everywhere: an unambiguous dictionary only. `dont doesnt didnt isnt arent
wasnt werent hasnt havent hadnt cant couldnt wouldnt shouldnt mustnt neednt wont aint Ive
Im youre youve youll youd theyre theyve theyll theyd weve hes shes thats whats wheres theres
heres whos itll thatll wouldve couldve shouldve mightve mustve`. Keep the original
     capitalisation and use straight `'` to match the source. Skip ambiguous words (`its well
were wed ill id lets`) and possessives; those are left to the AI.
   - Quotes, only in chapters flagged by detection and only when no AI fix exists:
     - `Speech[,!?…] Speaker verb…` → `"Speech[,!?…]" Speaker verb…`
     - `…Speaker verb, Speech` → `…Speaker verb, "Speech"` (the quote runs to the end of the
       paragraph)
     - Speakers: `I he she they we`, capitalised names, `the <noun>`. Verbs: say(s), ask(s),
       reply/replies, answer(s), shout(s), yell(s), whisper(s), mutter(s), murmur(s), mumble(s),
       scream(s), exclaim(s), continue(s), add(s), respond(s), retort(s), snap(s), growl(s),
       hiss(es), grumble(s), and their past tenses.
     - Never when the verb is followed by `nothing` or `anything` ("he says nothing").
   - Rules work on the text between `<b>`/`<i>` tags and never move tags.

## AI fix

- **One OpenAI-compatible client** (`POST {baseUrl}/chat/completions`) with presets:
  - Groq: `https://api.groq.com/openai/v1`. Models tried in order: `openai/gpt-oss-120b`, then
    `openai/gpt-oss-20b`. Groq limits are per model, so falling back doubles the daily capacity.
    Send `reasoning_effort: "low"` for gpt-oss models and `response_format: { type:
"json_object" }`.
  - Gemini: `https://generativelanguage.googleapis.com/v1beta/openai`, model
    `gemini-flash-lite-latest`. Parse JSON out of plain text; don't rely on response_format.
  - Model lists are editable in Settings, because free tiers change.
- **Free limits** as of 2026-10: Groq gives 8K tokens/minute, 200K tokens/day and 1K
  requests/day per model, so about 30 chapters/day per model. Only flagged chapters are sent.
- **Chunking**: send at most ~8,000 characters of paragraphs per request (about 2K tokens). A
  whole chapter plus its answer would exceed Groq's 8K tokens/minute.
- **429 handling**: read `retry-after`. If it's 60 s or less, wait and retry the same model.
  Otherwise the daily limit is reached: move to the next model, then the next provider, and
  finally show "Free limit reached for today".
- **Request**: numbered paragraphs (`<index>: <markup>`) under this system prompt:

  > You restore punctuation in one part of an English web-novel chapter. A broken scraper
  > removed its double quotation marks and some apostrophes. Add double quotation marks around
  > spoken dialogue and apostrophes to contractions and possessives. Change nothing else: no
  > rewording, spelling or grammar fixes, and no other punctuation. Keep `<b>`, `<i>` and
  > `&amp;`-style entities exactly as given. Thoughts and narration stay unquoted; telepathic
  > speech already in parentheses stays as it is. Reply with JSON only:
  > `{"paragraphs": [{"n": <index>, "text": "<fixed paragraph>"}]}`, listing only the
  > paragraphs you changed.

- **Verification**, per returned paragraph: accept it only if, after removing every quote and
  apostrophe character (`" “ ” „ ' ‘ ’`) and collapsing whitespace, it equals the original, and
  it has at least as many quote characters as before. Convert curly quotes to straight ones.
  A rejected paragraph keeps the original text, so a weak model can't damage the text.
- **Storage**: Dexie version 2 adds `fixes: 'url'` with `{ url, provider, model, version,
paragraphs: Record<index, markup>, complete, createdAt }`. Bump `version` when the prompt
  changes, so old fixes can be redone.

## UI

- **Settings → AI quote fixing**:
  - Groq key and models, Gemini key and model
  - "Fix automatically when a chapter needs it" (on by default once a key is set)
  - "Test key", which sends one tiny request
- **Reader**, on a flagged chapter:
  - Without a fix, a banner reads "Dialogue quotes are missing in this chapter", with **Fix
    with AI**, or **Set up** when there's no key.
  - While fixing, show "Fixing quotes… 2/3".
  - When fixed, a chip reads "Quotes fixed · Show original" and toggles the view.
- **Auto mode**: fix the open chapter, then the next downloaded chapter in the background, at
  most one chapter a minute.

## Development

- `.env.local` (gitignored) can hold `GROQ_API_KEY` and `GEMINI_API_KEY`. The dev proxy in
  vite.config.ts must forward POST bodies and response headers (`retry-after`), and add
  `Authorization` for api.groq.com and generativelanguage.googleapis.com from those variables
  when the request has none. The browser app never sees the keys.
- `src/lib/http.ts` gets `postJson()`: CapacitorHttp.post on the phone, the proxy in the browser.
- Tests:
  - rules: apostrophes, both quote patterns, the `says nothing` exclusion, tags untouched
  - detection: a stripped synthetic chapter vs a normal one
  - verification: accepts quote-only changes, rejects rewording or dropped tags
  - response parsing and chunking
  - the 429 fallback, with a mocked `postJson`
