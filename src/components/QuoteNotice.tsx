import type { QuoteFix } from '@/db/db';
import { isArchiveFix, type FixState } from '@/quotes/fixer';
import { Button, Spinner } from './Button';
import styles from './QuoteNotice.module.scss';

interface QuoteNoticeProps {
  /** The chapter's fix, when there is a current one. */
  fix?: QuoteFix;
  state?: FixState;
  /** What a fix would come from: the novel's archived Royal Road chapters, AI, or nothing yet. */
  fixWith?: 'Royal Road' | 'AI';
  showOriginal: boolean;
  onFix: () => void;
  onSetUp: () => void;
  onToggleOriginal: () => void;
}

/** The reader's line about a chapter's dialogue quotes: missing, being fixed, or fixed. */
export function QuoteNotice({
  fix,
  state,
  fixWith,
  showOriginal,
  onFix,
  onSetUp,
  onToggleOriginal,
}: QuoteNoticeProps) {
  if (state?.running) {
    return (
      <div className={styles.notice} role="status">
        <Spinner size={18} />
        <span className={styles.text}>
          Fixing quotes…{state.total > 1 && ` ${state.done + 1}/${state.total}`}
        </span>
      </div>
    );
  }

  const fixButton = (label: string) =>
    fixWith ? <Button onClick={onFix}>{label}</Button> : <Button onClick={onSetUp}>Set up</Button>;

  if (state?.error) {
    return (
      <div className={styles.notice} role="alert">
        <span className={styles.text}>{state.error}</span>
        {fixButton('Try again')}
      </div>
    );
  }

  if (fix) {
    return (
      <div className={styles.notice}>
        <span className={styles.text}>
          {showOriginal
            ? 'Showing the original text'
            : isArchiveFix(fix)
              ? 'Quotes from Royal Road'
              : fix.complete
                ? 'Quotes fixed by AI'
                : 'Quotes fixed in part of this chapter'}
        </span>
        {!fix.complete && !showOriginal && fixButton('Finish')}
        <Button variant="ghost" onClick={onToggleOriginal}>
          {showOriginal ? 'Show fixed' : 'Show original'}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.notice}>
      <span className={styles.text}>Dialogue quotes are missing in this chapter.</span>
      {fixButton(fixWith === 'Royal Road' ? 'Fix from Royal Road' : 'Fix with AI')}
    </div>
  );
}
