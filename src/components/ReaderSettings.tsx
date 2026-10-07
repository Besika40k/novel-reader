import { Minus, Plus } from 'lucide-react';
import { setPrefs, usePrefs, type Prefs } from '@/lib/prefs';
import { IconButton } from './Button';
import styles from './ReaderSettings.module.scss';

// Swatch colours preview each theme's page and text, whichever theme is active.
const THEMES: { value: Prefs['theme']; label: string; bg: string; ink: string }[] = [
  {
    value: 'system',
    label: 'Auto',
    bg: 'linear-gradient(135deg, #eef4f4 50%, #141a19 50%)',
    ink: '#8aa3a6',
  },
  { value: 'light', label: 'Light', bg: '#eef4f4', ink: '#1f2a2c' },
  { value: 'sepia', label: 'Sepia', bg: '#f4ecdc', ink: '#3d3125' },
  { value: 'dark', label: 'Dark', bg: '#141a19', ink: '#e3ecec' },
  { value: 'black', label: 'Black', bg: '#000000', ink: '#d5dfdf' },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function ReaderSettings() {
  const prefs = usePrefs();
  return (
    <div className={styles.group}>
      <div className={styles.themes} role="group" aria-label="Theme">
        {THEMES.map((theme) => (
          <button
            key={theme.value}
            type="button"
            className={styles.theme}
            aria-pressed={prefs.theme === theme.value}
            onClick={() => setPrefs({ theme: theme.value })}
          >
            <span className={styles.swatch} style={{ background: theme.bg, color: theme.ink }}>
              Aa
            </span>
            {theme.label}
          </button>
        ))}
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Font</span>
        <div className={styles.segmented} role="group" aria-label="Font">
          <button
            type="button"
            className={`${styles.segment} ${styles.serif}`}
            aria-pressed={prefs.readerFont === 'serif'}
            onClick={() => setPrefs({ readerFont: 'serif' })}
          >
            Serif
          </button>
          <button
            type="button"
            className={styles.segment}
            aria-pressed={prefs.readerFont === 'sans'}
            onClick={() => setPrefs({ readerFont: 'sans' })}
          >
            Sans
          </button>
        </div>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Text size</span>
        <div className={styles.stepper}>
          <IconButton
            label="Smaller text"
            disabled={prefs.fontSize <= 14}
            onClick={() => setPrefs({ fontSize: clamp(prefs.fontSize - 1, 14, 30) })}
          >
            <Minus />
          </IconButton>
          <span className={styles.value}>{prefs.fontSize}</span>
          <IconButton
            label="Larger text"
            disabled={prefs.fontSize >= 30}
            onClick={() => setPrefs({ fontSize: clamp(prefs.fontSize + 1, 14, 30) })}
          >
            <Plus />
          </IconButton>
        </div>
      </div>

      <div className={styles.row}>
        <span className={styles.label}>Line spacing</span>
        <div className={styles.stepper}>
          <IconButton
            label="Tighter lines"
            disabled={prefs.lineHeight <= 1.3}
            onClick={() =>
              setPrefs({
                lineHeight: clamp(Math.round((prefs.lineHeight - 0.1) * 10) / 10, 1.3, 2.2),
              })
            }
          >
            <Minus />
          </IconButton>
          <span className={styles.value}>{prefs.lineHeight.toFixed(1)}</span>
          <IconButton
            label="Looser lines"
            disabled={prefs.lineHeight >= 2.2}
            onClick={() =>
              setPrefs({
                lineHeight: clamp(Math.round((prefs.lineHeight + 0.1) * 10) / 10, 1.3, 2.2),
              })
            }
          >
            <Plus />
          </IconButton>
        </div>
      </div>

      <label className={styles.row}>
        <span className={styles.label}>Justify text</span>
        <input
          type="checkbox"
          className={styles.switch}
          checked={prefs.justify}
          onChange={(event) => setPrefs({ justify: event.target.checked })}
        />
      </label>

      <label className={styles.row}>
        <span className={styles.label}>
          Full-screen reading
          <span className={styles.hint}>Hides the phone&apos;s status and navigation bars</span>
        </span>
        <input
          type="checkbox"
          className={styles.switch}
          checked={prefs.immersive}
          onChange={(event) => setPrefs({ immersive: event.target.checked })}
        />
      </label>
    </div>
  );
}
