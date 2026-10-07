import { useState, type FormEvent } from 'react';
import { db, type Novel } from '@/db/db';
import { errorMessage } from '@/lib/async';
import { toast } from '@/lib/toast';
import { royalRoadFictionId, searchRoyalRoad } from '@/quotes/archive';
import { Button, Spinner } from './Button';
import { Sheet } from './Sheet';
import styles from './RoyalRoadSheet.module.scss';

interface RoyalRoadSheetProps {
  novel: Novel;
  open: boolean;
  onClose: () => void;
}

/** Links a novel to its Royal Road original, whose archived chapters restore lost quotes. */
export function RoyalRoadSheet({ novel, open, onClose }: RoyalRoadSheetProps) {
  const [link, setLink] = useState(novel.royalRoadUrl ?? '');
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string>();

  const find = async () => {
    setSearching(true);
    setMessage(undefined);
    try {
      const found = await searchRoyalRoad(novel.title);
      if (found) setLink(found);
      else setMessage(`Royal Road has no novel called “${novel.title}”. Paste its link instead.`);
    } catch (error) {
      // Royal Road's bot protection turns some requests away; a pasted link needs no request.
      setMessage(`${errorMessage(error)} Paste the novel’s link instead.`);
    } finally {
      setSearching(false);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const url = link.trim();
    if (!royalRoadFictionId(url)) {
      setMessage('That isn’t a Royal Road novel link (royalroad.com/fiction/…).');
      return;
    }
    await db.novels.update(novel.id, { royalRoadUrl: url });
    toast('Linked to Royal Road');
    onClose();
  };

  const unlink = async () => {
    await db.novels.update(novel.id, { royalRoadUrl: undefined });
    await db.archives.delete(novel.id);
    setLink('');
    toast('Royal Road link removed');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Quotes from Royal Road">
      <form className={styles.form} onSubmit={save}>
        <p className={styles.hint}>
          If this novel came from Royal Road, the Internet Archive&apos;s copies of its chapters
          still have every quote. Chapters that lost theirs here take them from those copies,
          including chapters Royal Road has since removed.
        </p>
        <label className={styles.field}>
          Royal Road link
          <input
            type="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://www.royalroad.com/fiction/…"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>
        {message && (
          <p className={styles.message} role="alert">
            {message}
          </p>
        )}
        <div className={styles.buttons}>
          <Button
            onClick={find}
            disabled={searching}
            icon={searching ? <Spinner size={18} /> : undefined}
          >
            Find by title
          </Button>
          <Button type="submit" variant="primary" disabled={!link.trim()}>
            Save
          </Button>
        </div>
        {novel.royalRoadUrl && (
          <Button variant="ghost" onClick={unlink}>
            Remove the link
          </Button>
        )}
      </form>
    </Sheet>
  );
}
