import { Inline } from '@/components/Inline';
import { sheetLines } from '@/lib/sheet';
import styles from './StatusSheet.module.scss';

/** A table from a chapter (usually a status sheet), as one column that fits a phone. */
export function StatusSheet({ markup }: { markup: string }) {
  return (
    <div className={styles.sheet}>
      {sheetLines(markup).map((line, i) => {
        if (line.kind === 'heading') {
          return (
            <div key={i} className={styles.heading}>
              <Inline markup={line.markup} />
            </div>
          );
        }
        if (line.kind === 'value') {
          return (
            <div key={i} className={styles.value}>
              <span>
                <Inline markup={line.label} />
              </span>
              <span>
                <Inline markup={line.value} />
              </span>
            </div>
          );
        }
        return (
          <div key={i}>
            <Inline markup={line.markup} />
          </div>
        );
      })}
    </div>
  );
}
