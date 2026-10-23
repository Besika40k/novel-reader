import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  ChevronRight,
  HardDrive,
  Info,
  LibraryBig,
  Plus,
  Quote,
  Trash,
  type LucideIcon,
} from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router';
import { BackupSection } from '@/components/BackupSection';
import { Button, IconButton, Spinner } from '@/components/Button';
import { ReaderSettings } from '@/components/ReaderSettings';
import { SwitchRow } from '@/components/Switch';
import { TopBar } from '@/components/TopBar';
import { lastBackupAt } from '@/db/autoBackup';
import { addCategory, deleteCategory, renameCategory } from '@/db/categories';
import { db } from '@/db/db';
import { deleteDownloads } from '@/db/library';
import { formatNumber, plural } from '@/lib/format';
import { setPrefs, usePrefs } from '@/lib/prefs';
import { toast } from '@/lib/toast';
import { testProvider } from '@/quotes/ai';
import { aiProviders, setAiSettings, useAiSettings } from '@/quotes/settings';
import { sources } from '@/sources';
import styles from './SettingsPage.module.scss';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const THEME_NAMES = {
  system: 'Auto',
  light: 'Light',
  sepia: 'Sepia',
  dark: 'Dark',
  black: 'Black',
};
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** A settings sub-page: the menu row that opens it and what it shows. */
interface Page {
  id: string;
  title: string;
  Icon: LucideIcon;
  Content: () => ReactNode;
}

const PAGES: Page[] = [
  { id: 'reading', title: 'Reading', Icon: BookOpen, Content: ReaderSettings },
  { id: 'ai', title: 'Quotes & AI', Icon: Quote, Content: QuoteSettings },
  { id: 'library', title: 'Library & updates', Icon: LibraryBig, Content: LibrarySettings },
  { id: 'storage', title: 'Storage & backup', Icon: HardDrive, Content: StorageSettings },
  { id: 'about', title: 'About', Icon: Info, Content: About },
];

/** Settings: a short menu of sub-pages, each row saying how things are set now. */
export function SettingsPage() {
  const prefs = usePrefs();
  const ai = useAiSettings();
  const categories = useLiveQuery(() => db.categories.count(), []);
  const downloaded = useLiveQuery(() => db.contents.count(), []);
  const [lastBackup] = useState(lastBackupAt);
  const providers = aiProviders(ai).map((provider) => provider.name);

  const summaries: Record<string, string> = {
    reading: `${THEME_NAMES[prefs.theme]} · ${prefs.readerFont === 'serif' ? 'Serif' : 'Sans'}, ${prefs.fontSize} px`,
    ai: providers.length
      ? `${ai.aiAuto ? 'Fixes automatically' : 'Fixes when asked'} · ${providers.join(', ')}`
      : 'No AI key yet; Royal Road links still work',
    library: [
      prefs.autoUpdate ? 'Checks every 12 hours' : 'Checks by hand',
      categories !== undefined && `${categories} ${categories === 1 ? 'category' : 'categories'}`,
    ]
      .filter(Boolean)
      .join(' · '),
    storage: [
      downloaded !== undefined && `${plural(downloaded, 'chapter')} downloaded`,
      lastBackup ? `backed up ${shortDate.format(lastBackup)}` : 'never backed up',
    ]
      .filter(Boolean)
      .join(' · '),
    about: `Version ${__APP_VERSION__}`,
  };

  return (
    <>
      <TopBar display title="Settings" rune="tiwaz" />
      <ul className={styles.menu}>
        {PAGES.map(({ id, title, Icon }) => (
          <li key={id}>
            <Link to={`/settings/${id}`} className={styles.menuRow}>
              <Icon aria-hidden className={styles.menuIcon} />
              <span className={styles.menuText}>
                {title}
                <span className={styles.menuSummary}>{summaries[id]}</span>
              </span>
              <ChevronRight aria-hidden className={styles.chevron} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** One settings sub-page, at /settings/:section. */
export function SettingsSectionPage() {
  const { section } = useParams();
  const page = PAGES.find((candidate) => candidate.id === section);
  if (!page) return <Navigate to="/settings" replace />;
  const { title, Content } = page;
  return (
    <>
      <TopBar back="/settings" title={title} />
      <div className={styles.section}>
        <Content />
      </div>
    </>
  );
}

function QuoteSettings() {
  const ai = useAiSettings();
  const [testing, setTesting] = useState(false);

  const testKeys = async () => {
    const providers = aiProviders(ai);
    if (!providers.length) {
      toast('Add a Groq or Gemini key first');
      return;
    }
    setTesting(true);
    const results = await Promise.all(
      providers.map(async (provider) => ({
        name: provider.name,
        ...(await testProvider(provider)),
      })),
    );
    setTesting(false);
    toast(
      results.map(({ name, message }) => `${name}: ${message}`).join(' · '),
      results.every(({ ok }) => ok) ? 'info' : 'error',
    );
  };

  return (
    <>
      <p className={styles.hint}>
        Some chapters lose their dialogue quotes on the site. For a novel from Royal Road, link it
        on the novel page and the quotes come from archived copies of the original. Otherwise simple
        rules put back the clear cases, and an AI model can put back the rest. Free keys are enough:
        one from{' '}
        <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
          Groq
        </a>
        , and optionally one from{' '}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
          Google AI Studio
        </a>{' '}
        for when Groq&apos;s daily limit runs out. Keys stay on this phone.
      </p>
      <label className={styles.field}>
        Groq key
        <input
          type="password"
          value={ai.groqKey}
          onChange={(event) => setAiSettings({ groqKey: event.target.value })}
          placeholder="gsk_…"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className={styles.field}>
        Groq models, in order
        <input
          value={ai.groqModels}
          onChange={(event) => setAiSettings({ groqModels: event.target.value })}
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>
      <label className={styles.field}>
        Gemini key (optional)
        <input
          type="password"
          value={ai.geminiKey}
          onChange={(event) => setAiSettings({ geminiKey: event.target.value })}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className={styles.field}>
        Gemini models, in order
        <input
          value={ai.geminiModels}
          onChange={(event) => setAiSettings({ geminiModels: event.target.value })}
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>
      <SwitchRow
        label="Fix with AI automatically"
        hint="When a chapter that needs it opens, and the next downloaded one in the background. Uses up the free limit quickly."
        checked={ai.aiAuto}
        onChange={(aiAuto) => setAiSettings({ aiAuto })}
      />
      <Button
        onClick={testKeys}
        disabled={testing}
        icon={testing ? <Spinner size={18} /> : undefined}
      >
        Test keys
      </Button>
    </>
  );
}

function LibrarySettings() {
  const prefs = usePrefs();
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []);
  const [newCategory, setNewCategory] = useState('');

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    await addCategory(name);
    setNewCategory('');
  };

  return (
    <>
      <SwitchRow
        label="Check for new chapters automatically"
        hint="Every 12 hours, when the app opens or comes back, never while reading. New chapters are listed under Updates (the bell in Library)."
        checked={prefs.autoUpdate}
        onChange={(autoUpdate) => setPrefs({ autoUpdate })}
      />
      <h2 className={styles.heading}>Categories</h2>
      <ul className={styles.categories}>
        {categories?.map((category) => (
          <li key={category.id} className={styles.category}>
            <input
              defaultValue={category.name}
              aria-label="Category name"
              onBlur={(event) => {
                const name = event.target.value.trim();
                if (name && name !== category.name) void renameCategory(category.id, name);
                else event.target.value = category.name;
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
            />
            <IconButton
              label={`Delete ${category.name}`}
              disabled={categories.length <= 1}
              onClick={() => deleteCategory(category.id)}
            >
              <Trash />
            </IconButton>
          </li>
        ))}
      </ul>
      <form className={styles.addCategory} onSubmit={add}>
        <input
          value={newCategory}
          onChange={(event) => setNewCategory(event.target.value)}
          placeholder="New category"
          aria-label="New category name"
        />
        <IconButton label="Add category" type="submit" disabled={!newCategory.trim()}>
          <Plus />
        </IconButton>
      </form>
      <p className={styles.hint}>
        Novels in a deleted category move to the first one. Tap a name to rename it.
      </p>
    </>
  );
}

function StorageSettings() {
  const downloaded = useLiveQuery(() => db.contents.count(), []);
  const [storage, setStorage] = useState<{ persisted?: boolean; usage?: number }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([navigator.storage?.persisted?.(), navigator.storage?.estimate?.()]).then(
      ([persisted, estimate]) => {
        if (!cancelled) setStorage({ persisted, usage: estimate?.usage });
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [downloaded]);

  const deleteAll = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    const urls = (await db.contents.toCollection().primaryKeys()) as string[];
    await deleteDownloads(urls);
    setConfirmDelete(false);
    toast(`Deleted ${plural(urls.length, 'downloaded chapter')}`);
  };

  return (
    <>
      <h2 className={styles.heading}>Downloads</h2>
      <dl className={styles.facts}>
        <div>
          <dt>Downloaded chapters</dt>
          <dd>{downloaded === undefined ? '…' : formatNumber(downloaded)}</dd>
        </div>
        {storage.usage !== undefined && (
          <div>
            <dt>Space used</dt>
            <dd>{formatBytes(storage.usage)}</dd>
          </div>
        )}
        {storage.persisted !== undefined && (
          <div>
            <dt>Protected from clean-up</dt>
            <dd>{storage.persisted ? 'Yes' : 'No'}</dd>
          </div>
        )}
      </dl>
      <Button variant="danger" icon={<Trash />} disabled={!downloaded} onClick={deleteAll}>
        {confirmDelete ? 'Tap again to delete them all' : 'Delete all downloaded chapters'}
      </Button>
      <BackupSection />
    </>
  );
}

function About() {
  return (
    <dl className={styles.facts}>
      <div>
        <dt>Version</dt>
        <dd>{__APP_VERSION__}</dd>
      </div>
      <div>
        <dt>Sites</dt>
        <dd>{sources.map((source) => source.name).join(', ')}</dd>
      </div>
    </dl>
  );
}
