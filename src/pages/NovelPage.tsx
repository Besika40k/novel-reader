import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDownUp,
  Bookmark,
  BookmarkCheck,
  BookmarkPlus,
  BookOpen,
  Download,
  EllipsisVertical,
  ExternalLink,
  Quote,
  RefreshCw,
  Trash,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { Button, IconButton, Spinner } from '@/components/Button';
import { ChapterRow } from '@/components/ChapterRow';
import { Cover } from '@/components/Cover';
import { DownloadStatus } from '@/components/DownloadStatus';
import { RoyalRoadSheet } from '@/components/RoyalRoadSheet';
import { Sheet } from '@/components/Sheet';
import { TopBar } from '@/components/TopBar';
import { chaptersOf, db, type Chapter } from '@/db/db';
import {
  addToLibrary,
  continueChapter,
  deleteDownloads,
  isRefreshing,
  markRead,
  readerPath,
  setBookmark,
  refreshNovel,
  removeFromLibrary,
  setCategory,
  subscribeRefreshing,
} from '@/db/library';
import { enqueueDownloads, useDownloads } from '@/downloads/queue';
import { errorMessage } from '@/lib/async';
import { usePageScroll } from '@/lib/scroll';
import { setPrefs, usePrefs } from '@/lib/prefs';
import { toast } from '@/lib/toast';
import { sources } from '@/sources';
import { plural } from '@/lib/format';
import styles from './NovelPage.module.scss';

// Opening a novel re-checks for new chapters when the last check is older than this.
const STALE_MS = 30 * 60 * 1000;

/** "Chapter 250: Surrounded" → "Chapter 250", for compact labels. */
export function NovelPage() {
  const { novelId = '' } = useParams();
  const navigate = useNavigate();
  const novel = useLiveQuery(
    () => db.novels.get(novelId).then((found) => found ?? null),
    [novelId],
  );
  const chapters = useLiveQuery(() => chaptersOf(novelId).toArray(), [novelId]);
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []);
  const downloads = useDownloads();
  const refreshing = useSyncExternalStore(subscribeRefreshing, () => isRefreshing(novelId));
  const [error, setError] = useState<string>();
  const { chaptersNewestFirst: newestFirst } = usePrefs();
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [sheet, setSheet] = useState<'library' | 'download' | 'royalRoad' | 'menu'>();
  const [actionsFor, setActionsFor] = useState<Chapter>();
  const [flashIndex, setFlashIndex] = useState<number>();
  usePageScroll(`novel:${novelId}`, novel !== undefined && chapters !== undefined);

  const refresh = useCallback(
    (announce: boolean) => {
      refreshNovel(novelId).then(
        (added) => {
          setError(undefined);
          if (added > 0) toast(`${plural(added, 'new chapter')} found`);
          else if (announce) toast('No new chapters');
        },
        (reason) => setError(errorMessage(reason)),
      );
    },
    [novelId],
  );

  // Fetch everything on the first visit, then look for new chapters when the data is stale.
  useEffect(() => {
    if (!novel) return;
    if (novel.checkedAt && Date.now() - novel.checkedAt < STALE_MS) return;
    refresh(false);
  }, [novel, refresh]);

  const openChapter = useCallback(
    (chapter: Chapter) => navigate(readerPath(chapter.novelId, chapter.index)),
    [navigate],
  );
  const downloadOne = useCallback((chapter: Chapter) => enqueueDownloads([chapter]), []);
  const closeSheet = useCallback(() => setSheet(undefined), []);
  const closeActions = useCallback(() => setActionsFor(undefined), []);

  if (novel === null) {
    return (
      <>
        <TopBar back="/" title="Novel" />
        <p className={styles.notice}>This novel is no longer stored on the phone.</p>
      </>
    );
  }

  const list = chapters ?? [];
  const shown = bookmarksOnly ? list.filter((chapter) => chapter.bookmarked) : list;
  const ordered = newestFirst ? [...shown].reverse() : shown;
  const hasBookmarks = list.some((chapter) => chapter.bookmarked);
  const next = novel ? continueChapter(list, novel.lastReadUrl) : undefined;
  const started = list.some((chapter) => chapter.read || chapter.progress > 0);
  const category = categories?.find((c) => c.id === novel?.categoryId);
  const sourceName = sources.find((source) => source.id === novel?.sourceId)?.name;

  const toggleLibrary = async () => {
    if (!novel) return;
    if (novel.inLibrary) {
      setSheet('library');
      return;
    }
    const first = categories?.[0];
    if (!first) return;
    await addToLibrary(novel.id, first.id);
    toast(`Added to ${first.name}`);
  };

  const jumpTo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = new FormData(event.currentTarget).get('chapter');
    const number = Number(input);
    if (!input || !Number.isFinite(number)) return;
    // Match the number in the title first ("Chapter 250"), then the position on the site.
    const target =
      list.find((chapter) =>
        new RegExp(`^chapter\\s+${number}(?![\\d.])`, 'i').test(chapter.title),
      ) ?? list.find((chapter) => chapter.index === number);
    if (!target) {
      toast(`There is no chapter ${number} yet`);
      return;
    }
    document.getElementById(`chapter-${target.index}`)?.scrollIntoView({ block: 'center' });
    setFlashIndex(target.index);
    setTimeout(() => setFlashIndex(undefined), 1200);
  };

  // Download choices start at the chapter "Continue" would open.
  const fromNext = next ? list.slice(list.indexOf(next)) : list;
  const notDownloaded = (chapters: Chapter[]) => chapters.filter((chapter) => !chapter.downloaded);
  const downloadChoices = [
    { label: 'Next 10 chapters', chapters: notDownloaded(fromNext.slice(0, 10)) },
    { label: 'Next 50 chapters', chapters: notDownloaded(fromNext.slice(0, 50)) },
    {
      label: 'All unread chapters',
      chapters: notDownloaded(list.filter((chapter) => !chapter.read)),
    },
    { label: 'All chapters', chapters: notDownloaded(list) },
  ];
  const downloaded = list.filter((chapter) => chapter.downloaded);

  const download = (chosen: Chapter[]) => {
    const added = enqueueDownloads(chosen);
    toast(
      added ? `Downloading ${plural(added, 'chapter')}` : 'Those chapters are already downloaded',
    );
    closeSheet();
  };

  return (
    <div className={styles.page}>
      <TopBar
        back="/"
        title={novel?.title}
        actions={
          <>
            <IconButton
              label="Check for new chapters"
              disabled={refreshing}
              onClick={() => refresh(true)}
            >
              {refreshing ? <Spinner /> : <RefreshCw />}
            </IconButton>
            <IconButton label="More" disabled={!novel} onClick={() => setSheet('menu')}>
              <EllipsisVertical />
            </IconButton>
          </>
        }
      />

      {novel && (
        <>
          <section className={styles.hero}>
            <Cover
              src={novel.coverData ?? novel.coverUrl}
              title={novel.title}
              className={styles.cover}
            />
            <div className={styles.meta}>
              <h2 className={styles.title}>{novel.title}</h2>
              {novel.author && <p className={styles.author}>{novel.author}</p>}
              <p className={styles.facts}>
                {[novel.status, list.length > 0 && plural(list.length, 'chapter'), sourceName]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </section>

          <div className={styles.actions}>
            <Button
              variant="primary"
              icon={<BookOpen />}
              disabled={!next}
              onClick={() => next && openChapter(next)}
              className={styles.continue}
            >
              {next && started ? (
                // Two lines, so the chapter is never cut down to "Chapter 7…".
                <span className={styles.continueText}>
                  Continue
                  <span className={styles.continueChapter}>{next.title}</span>
                </span>
              ) : (
                'Start reading'
              )}
            </Button>
            <Button
              icon={novel.inLibrary ? <BookmarkCheck /> : <BookmarkPlus />}
              onClick={toggleLibrary}
              disabled={!categories}
            >
              {novel.inLibrary ? (category?.name ?? 'In library') : 'Add to library'}
            </Button>
          </div>

          {error && (
            <div className={styles.error} role="alert">
              <p>{error}</p>
              <Button variant="ghost" onClick={() => refresh(true)}>
                Try again
              </Button>
            </div>
          )}

          {novel.summary && (
            <button
              type="button"
              className={styles.summary}
              data-open={summaryOpen}
              onClick={() => setSummaryOpen((open) => !open)}
            >
              {novel.summary}
            </button>
          )}

          {novel.genres.length > 0 && (
            <ul className={styles.genres}>
              {novel.genres.map((genre) => (
                <li key={genre}>{genre}</li>
              ))}
            </ul>
          )}

          {/* Offered on the page until linked; after that it's managed from the ⋮ menu. */}
          {!novel.royalRoadUrl && (
            <button
              type="button"
              className={styles.royalRoad}
              onClick={() => setSheet('royalRoad')}
            >
              <Quote aria-hidden />
              <span>Quotes from Royal Road</span>
              <span className={styles.count}>Not linked</span>
            </button>
          )}
        </>
      )}

      <div className={styles.listHeader}>
        <h3 className={styles.listTitle}>Chapters</h3>
        <form className={styles.jump} onSubmit={jumpTo}>
          <input
            name="chapter"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Go to #"
            aria-label="Go to chapter number"
          />
        </form>
        <IconButton
          label={newestFirst ? 'Show oldest first' : 'Show newest first'}
          aria-pressed={newestFirst}
          onClick={() => setPrefs({ chaptersNewestFirst: !newestFirst })}
        >
          <ArrowDownUp />
        </IconButton>
        {(hasBookmarks || bookmarksOnly) && (
          <IconButton
            label={bookmarksOnly ? 'Show all chapters' : 'Show bookmarked chapters'}
            aria-pressed={bookmarksOnly}
            onClick={() => setBookmarksOnly((value) => !value)}
          >
            <Bookmark fill={bookmarksOnly ? 'currentColor' : 'none'} />
          </IconButton>
        )}
        <IconButton
          label="Download chapters"
          disabled={list.length === 0}
          onClick={() => setSheet('download')}
        >
          <Download />
        </IconButton>
      </div>

      {list.length === 0 ? (
        <div className={styles.notice}>
          {refreshing || chapters === undefined ? (
            <Spinner label="Loading chapters" />
          ) : (
            'No chapters yet.'
          )}
        </div>
      ) : (
        <ol className={styles.chapters}>
          {ordered.map((chapter) => (
            <ChapterRow
              key={chapter.url}
              chapter={chapter}
              job={downloads.states.get(chapter.url)}
              current={chapter.url === novel?.lastReadUrl}
              flash={chapter.index === flashIndex}
              onOpen={openChapter}
              onActions={setActionsFor}
              onDownload={downloadOne}
            />
          ))}
        </ol>
      )}

      <DownloadStatus />

      <Sheet open={sheet === 'download'} onClose={closeSheet} title="Download for offline reading">
        <div className={styles.sheetList}>
          {downloadChoices.map((choice) => (
            <Button
              key={choice.label}
              block
              disabled={choice.chapters.length === 0}
              onClick={() => download(choice.chapters)}
              className={styles.sheetButton}
            >
              <span>{choice.label}</span>
              <span className={styles.count}>
                {choice.chapters.length ? `${choice.chapters.length} to get` : 'all saved'}
              </span>
            </Button>
          ))}
          <Button
            block
            variant="danger"
            icon={<Trash />}
            disabled={downloaded.length === 0}
            onClick={async () => {
              await deleteDownloads(downloaded.map((chapter) => chapter.url));
              toast(`Deleted ${plural(downloaded.length, 'downloaded chapter')}`);
              closeSheet();
            }}
          >
            Delete {plural(downloaded.length, 'downloaded chapter')}
          </Button>
        </div>
      </Sheet>

      {novel && (
        <RoyalRoadSheet
          key={novel.royalRoadUrl ?? ''}
          novel={novel}
          open={sheet === 'royalRoad'}
          onClose={closeSheet}
        />
      )}

      <Sheet open={sheet === 'menu'} onClose={closeSheet} title={novel?.title}>
        <div className={styles.sheetList}>
          <Button
            block
            icon={<Quote />}
            className={styles.sheetButton}
            onClick={() => setSheet('royalRoad')}
          >
            Quotes from Royal Road
            <span className={styles.count}>{novel?.royalRoadUrl ? 'Linked' : 'Not linked'}</span>
          </Button>
          {novel && (
            <Button
              block
              icon={<ExternalLink />}
              className={styles.sheetButton}
              onClick={() => {
                window.open(novel.url, '_blank', 'noreferrer');
                closeSheet();
              }}
            >
              Open on {sourceName ?? 'the site'}
              <span />
            </Button>
          )}
        </div>
      </Sheet>

      <Sheet open={sheet === 'library'} onClose={closeSheet} title="Category">
        <div className={styles.sheetList}>
          {categories?.map((option) => (
            <Button
              key={option.id}
              block
              variant={option.id === novel?.categoryId ? 'primary' : 'secondary'}
              onClick={async () => {
                await setCategory(novelId, option.id);
                closeSheet();
              }}
            >
              {option.name}
            </Button>
          ))}
          <Button
            block
            variant="danger"
            onClick={async () => {
              await removeFromLibrary(novelId);
              toast('Removed from the library');
              closeSheet();
            }}
          >
            Remove from library
          </Button>
        </div>
      </Sheet>

      <Sheet open={actionsFor !== undefined} onClose={closeActions} title={actionsFor?.title}>
        {actionsFor && (
          <div className={styles.sheetList}>
            <Button
              block
              variant="primary"
              onClick={() => {
                closeActions();
                openChapter(actionsFor);
              }}
            >
              Read
            </Button>
            <Button
              block
              onClick={async () => {
                await markRead([actionsFor.url], !actionsFor.read);
                closeActions();
              }}
            >
              {actionsFor.read ? 'Mark as unread' : 'Mark as read'}
            </Button>
            <Button
              block
              onClick={async () => {
                await setBookmark(actionsFor.url, !actionsFor.bookmarked);
                closeActions();
              }}
            >
              {actionsFor.bookmarked ? 'Remove bookmark' : 'Bookmark'}
            </Button>
            <Button
              block
              onClick={async () => {
                const upTo = list.filter((chapter) => chapter.index <= actionsFor.index);
                await markRead(
                  upTo.map((chapter) => chapter.url),
                  true,
                );
                toast(`Marked ${plural(upTo.length, 'chapter')} as read`);
                closeActions();
              }}
            >
              Mark this and all earlier as read
            </Button>
            {actionsFor.downloaded ? (
              <Button
                block
                variant="danger"
                onClick={async () => {
                  await deleteDownloads([actionsFor.url]);
                  closeActions();
                }}
              >
                Delete download
              </Button>
            ) : (
              <Button
                block
                onClick={() => {
                  enqueueDownloads([actionsFor]);
                  closeActions();
                }}
              >
                Download
              </Button>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
