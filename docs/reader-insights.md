# Reader insights (plan)

Goal: learn what the owner likes to read (genres, tags, ratings, length, status) from what the app
already sees, so later features can use it: "more like this" in Browse, sorting a site's lists by
fit, a short "your taste" summary in Settings. Nothing here is built yet; this is the plan and the
types in `src/insights/types.ts`.

## Signals the app already has

| Signal                                       | Where                                                      | Strength                    |
| -------------------------------------------- | ---------------------------------------------------------- | --------------------------- |
| Chapters read, progress per chapter          | `chapters.read`, `chapters.progress`                       | strong: time actually spent |
| Days a novel was read                        | `history` (one row per novel per day, kept 30 days)        | strong, recent              |
| Novel in the library, its category           | `novels.inLibrary`, `categoryId` ("Dropped" is a negative) | medium                      |
| Opened from search or a list but never added | `novels` with `inLibrary: 0`                               | weak interest               |
| Genres and status                            | `novels.genres`, `novels.status`                           | traits                      |

## Gaps to fill first

1. **Tags and site rating** aren't stored: the novel page shows a rating (`.rating .nub`) and
   NovelFire/NovelPhoenix tag pages exist. Parse both in `parseNovel` into `NovelDetails.tags` and
   `NovelDetails.rating`, and keep them on `Novel` (optional fields, no migration needed).
2. **History older than 30 days** is pruned. For long-term taste, fold each day into a per-novel
   tally before pruning (`NovelEngagement` below) rather than keeping every row.
3. **Drops**: moving a novel to "Dropped" or removing it is the clearest dislike; record when and
   after how many chapters (`NovelEngagement.droppedAt`).

## Model

- `NovelEngagement` per novel: chapters read, days read, first and last read, whether it's in the
  library or dropped. Derived from the tables above; recomputed, never edited by hand.
- `TasteProfile`: a weight per genre and per tag, plus preferred rating range, length and status.
  Each novel adds its engagement score to its traits' weights; dropped novels subtract. Scores
  decay with age so the profile follows current taste.
- Computation is pure (`engagement + traits -> profile`) and runs on demand, so it's testable with
  plain fixtures and needs no background work on the phone.

## Uses, later

- Badge or sort key "fits your taste" on site list rows (score = sum of trait weights).
- Filter defaults for the planned tag filter (see the to-do): pre-select liked genres.
- A Settings section showing the top genres and tags, with a reset.

All of it stays on the phone, like the rest of the app's data.
