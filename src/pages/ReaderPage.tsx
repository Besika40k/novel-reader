import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import { Capacitor, SystemBars } from '@capacitor/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ChevronLeft, ChevronRight, Type } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { Button, IconButton, Spinner } from '@/components/Button';
import { Inline } from '@/components/Inline';
import { QuoteNotice } from '@/components/QuoteNotice';
import { ReaderSettings } from '@/components/ReaderSettings';
import { Sheet } from '@/components/Sheet';
import { db, type Chapter, type ChapterContent } from '@/db/db';
import {
  loadChapterContent,
  markRead,
  neighbour,
  novelPath,
  readerPath,
  saveProgress,
  setLastRead,
} from '@/db/library';
import { errorMessage } from '@/lib/async';
import { inlineToText } from '@/lib/inline';
import { readableParagraphs } from '@/lib/junk';
import { usePrefs } from '@/lib/prefs';
import { fixAhead, fixChapter, isCurrentFix, useFixState } from '@/quotes/fixer';
import { analyseChapter, applyFixes } from '@/quotes/rules';
import { aiProviders, useAiSettings } from '@/quotes/settings';
import styles from './ReaderPage.module.scss';

interface Loaded {
  url: string;
  content?: ChapterContent;
  error?: string;
  /** Where to resume, 0–1. */
  startAt: number;
}

const native = Capacitor.isNativePlatform();

function scrollFraction(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1;
}

/** Words per minute behind "time left": a typical silent-reading pace. */
const READING_SPEED = 250;

const scrollPercent = () => Math.round(scrollFraction() * 100);

/** Percentage read and time left. Follows the scroll itself, so the chapter doesn't re-render. */
function ReadingMeter({ words }: { words: number }) {
  const [percent, setPercent] = useState(scrollPercent);
  useEffect(() => {
    const update = () => setPercent(scrollPercent());
    // The length changes without scrolling too: text laying out, fonts loading, a new text size.
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update);
    };
  }, []);
  const minutes = Math.ceil((words * (100 - percent)) / 100 / READING_SPEED);
  return (
    <span className={styles.meter}>
      {percent}%{minutes > 0 && ` · ${minutes} min left`}
    </span>
  );
}

export function ReaderPage() {
  const { novelId = '', index = '' } = useParams();
  const position = Number(index);
  const navigate = useNavigate();
  const prefs = usePrefs();
  const novel = useLiveQuery(() => db.novels.get(novelId), [novelId]);
  const chapter = useLiveQuery(
    () =>
      db.chapters
        .where('[novelId+index]')
        .equals([novelId, position])
        .first()
        .then((found) => found ?? null),
    [novelId, position],
  );
  const previous = useLiveQuery(
    () => neighbour(novelId, position, 'previous'),
    [novelId, position],
  );
  const next = useLiveQuery(() => neighbour(novelId, position, 'next'), [novelId, position]);
  const [loaded, setLoaded] = useState<Loaded>();
  const [attempt, setAttempt] = useState(0);
  const [chrome, setChrome] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [originalOf, setOriginalOf] = useState<string>();
  const aiSettings = useAiSettings();
  const canFix = aiProviders(aiSettings).length > 0;
  const autoFix = aiSettings.auto && canFix;

  const url = chapter?.url;
  const current = loaded?.url === url ? loaded : undefined;
  const ready = current?.content ? current.url : undefined;
  const startAt = current?.startAt ?? 0;

  const stored = useLiveQuery(
    async () => (url ? { url, fix: await db.fixes.get(url) } : undefined),
    [url],
  );
  const fixLoaded = stored !== undefined && stored.url === url;
  const fix = fixLoaded && isCurrentFix(stored.fix) ? stored.fix : undefined;
  const fixState = useFixState(ready);
  const title = current?.content?.title || chapter?.title || '';
  const content = current?.content;
  const readable = useMemo(
    () => (content ? readableParagraphs(title, content.paragraphs) : []),
    [content, title],
  );
  const needsFix = useMemo(() => analyseChapter(readable).needsFix, [readable]);
  const showOriginal = url !== undefined && originalOf === url;
  const paragraphs = useMemo(
    () => (showOriginal ? readable : applyFixes(readable, needsFix, fix)),
    [readable, needsFix, fix, showOriginal],
  );
  const words = useMemo(
    () =>
      paragraphs.reduce(
        (sum, paragraph) =>
          sum + inlineToText(paragraph.markup).split(/\s+/).filter(Boolean).length,
        0,
      ),
    [paragraphs],
  );

  // Load the text: from storage when downloaded, otherwise from the site (and keep it).
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void setLastRead(novelId, url);
    Promise.all([db.chapters.get(url), loadChapterContent(url)]).then(
      ([row, content]) => {
        if (cancelled) return;
        // A finished chapter opens at the top again; anything else resumes where it was left.
        const finished = row?.read === 1 && row.progress >= 0.98;
        setLoaded({ url, content, startAt: finished ? 0 : (row?.progress ?? 0) });
      },
      (error) => {
        if (!cancelled) setLoaded({ url, error: errorMessage(error), startAt: 0 });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url, novelId, attempt]);

  // Resume position, once the text is on screen and again once its fonts have loaded.
  useLayoutEffect(() => {
    if (!ready) return;
    const restore = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.max(0, Math.round(startAt * max)));
    };
    restore();
    let frame = 0;
    void document.fonts.ready.then(() => {
      frame = requestAnimationFrame(restore);
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, startAt]);

  // Save the position while reading. Scrolling down also tucks the bars away.
  useEffect(() => {
    if (!ready) return;
    let latest = startAt;
    let saved = startAt;
    let timer: number | undefined;
    let lastY = window.scrollY;
    const flush = () => {
      timer = undefined;
      if (Math.abs(latest - saved) < 0.001) return;
      saved = latest;
      void saveProgress(ready, latest);
    };
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastY + 12) setChrome(false);
      lastY = y;
      latest = scrollFraction();
      timer ??= window.setTimeout(flush, 600);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
      flush();
    };
  }, [ready, startAt]);

  // Fetch the next chapter in the background so turning the page is instant.
  const nextUrl = next?.url;
  const nextStored = next?.downloaded === 1;
  useEffect(() => {
    if (!ready || !nextUrl || nextStored) return;
    const timer = setTimeout(() => {
      loadChapterContent(nextUrl).catch(() => undefined);
    }, 1500);
    return () => clearTimeout(timer);
  }, [ready, nextUrl, nextStored]);

  // Automatic quote fixing: the open chapter once, then the next stored one in the background.
  const fixComplete = fix?.complete === true;
  const attempted = fixState !== undefined;
  const settled = !fixState?.running && (!needsFix || fixComplete || attempted);
  useEffect(() => {
    if (!ready || !fixLoaded || !needsFix || fixComplete || attempted || !autoFix) return;
    fixChapter(ready).catch(() => undefined);
  }, [ready, fixLoaded, needsFix, fixComplete, attempted, autoFix]);
  useEffect(() => {
    if (!ready || !nextUrl || !nextStored || !settled || !autoFix) return;
    return fixAhead(nextUrl);
  }, [ready, nextUrl, nextStored, settled, autoFix]);

  // Full-screen reading: the phone's bars follow the reader's own bars.
  useEffect(() => {
    if (!native) return;
    void (prefs.immersive && !chrome ? SystemBars.hide() : SystemBars.show());
  }, [chrome, prefs.immersive]);
  useEffect(
    () => () => {
      if (native) void SystemBars.show();
    },
    [],
  );

  const goTo = (target: Chapter | undefined) => {
    if (target) navigate(readerPath(novelId, target.index), { replace: true });
  };
  const goNext = () => {
    if (url) void markRead([url], true);
    goTo(next);
  };
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(novelPath(novelId), { replace: true });
  };
  const retry = () => {
    setLoaded(undefined);
    setAttempt((value) => value + 1);
  };
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const onTextClick = (event: MouseEvent) => {
    if ((event.target as Element).closest('button, a')) return;
    if (window.getSelection()?.toString()) return;
    setChrome((visible) => !visible);
  };

  const style = {
    '--reader-size': `${prefs.fontSize}px`,
    '--reader-leading': prefs.lineHeight,
    '--reader-font': prefs.readerFont === 'serif' ? 'var(--font-serif)' : 'var(--font-ui)',
  } as CSSProperties;

  return (
    <div className={styles.reader} style={style} data-chrome={chrome} data-justify={prefs.justify}>
      <header className={styles.top} inert={!chrome}>
        <IconButton label="Back" onClick={goBack}>
          <ArrowLeft />
        </IconButton>
        <div className={styles.heading}>
          <span className={styles.novelTitle}>{novel?.title}</span>
          <span className={styles.chapterTitle}>{chapter?.title}</span>
        </div>
        <IconButton label="Reading settings" onClick={() => setSettingsOpen(true)}>
          <Type />
        </IconButton>
        <div className={styles.progress} aria-hidden />
      </header>

      <article className={styles.article} lang="en" onClick={onTextClick}>
        {chapter === null ? (
          <div className={styles.status}>
            <p>This chapter isn&apos;t in the list anymore.</p>
            <Button onClick={() => navigate(novelPath(novelId), { replace: true })}>
              Back to the novel
            </Button>
          </div>
        ) : (
          <>
            <h1 className={styles.title}>{title}</h1>
            {current?.error ? (
              <div className={styles.status} role="alert">
                <p>{current.error}</p>
                <Button variant="primary" onClick={retry}>
                  Try again
                </Button>
              </div>
            ) : !current ? (
              <div className={styles.status}>
                <Spinner label="Loading chapter" />
              </div>
            ) : (
              <>
                {(needsFix || fix) && (
                  <QuoteNotice
                    fix={fix}
                    state={fixState}
                    canFix={canFix}
                    showOriginal={showOriginal}
                    onFix={() => {
                      if (ready) fixChapter(ready).catch(() => undefined);
                    }}
                    onSetUp={() => navigate('/settings#ai')}
                    onToggleOriginal={() => setOriginalOf(showOriginal ? undefined : url)}
                  />
                )}
                {paragraphs.map((paragraph) => (
                  <p key={paragraph.index}>
                    <Inline markup={paragraph.markup} />
                  </p>
                ))}
              </>
            )}
            {current?.content && (
              <nav className={styles.end} aria-label="Chapters">
                {next ? (
                  <Button variant="primary" block onClick={goNext} icon={<ChevronRight />}>
                    <span className={styles.ellipsis}>{next.title}</span>
                  </Button>
                ) : (
                  <p className={styles.caughtUp}>
                    That&apos;s the latest chapter. New ones show up on the novel page.
                  </p>
                )}
                {previous && (
                  <Button variant="ghost" onClick={() => goTo(previous)} icon={<ChevronLeft />}>
                    Previous chapter
                  </Button>
                )}
              </nav>
            )}
          </>
        )}
      </article>

      <footer className={styles.bottom} inert={!chrome}>
        <IconButton label="Previous chapter" disabled={!previous} onClick={() => goTo(previous)}>
          <ChevronLeft />
        </IconButton>
        <div className={styles.middle}>
          {content && <ReadingMeter words={words} />}
          <button type="button" className={styles.toNovel} onClick={goBack}>
            Chapter list
          </button>
        </div>
        <IconButton label="Next chapter" disabled={!next} onClick={goNext}>
          <ChevronRight />
        </IconButton>
      </footer>

      <Sheet open={settingsOpen} onClose={closeSettings} title="Reading settings">
        <ReaderSettings />
      </Sheet>
    </div>
  );
}
