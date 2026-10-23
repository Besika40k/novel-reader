import { Minus, Plus } from 'lucide-react';
import { setPrefs, usePrefs, type Prefs } from '@/lib/prefs';
import { IconButton } from './Button';
import { SwitchRow } from './Switch';
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

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Labels for the minus and plus buttons. */
  less: string;
  more: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

function Stepper({ label, value, min, max, step, less, more, format, onChange }: StepperProps) {
  // Rounded to the step's decimals, so 0.1 steps don't drift into 1.7000000000000002.
  const decimals = step < 1 ? 1 : 0;
  const change = (by: number) => onChange(clamp(Number((value + by).toFixed(decimals)), min, max));
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div className={styles.stepper}>
        <IconButton label={less} disabled={value <= min + 1e-9} onClick={() => change(-step)}>
          <Minus />
        </IconButton>
        <span className={styles.value}>{format ? format(value) : value}</span>
        <IconButton label={more} disabled={value >= max - 1e-9} onClick={() => change(step)}>
          <Plus />
        </IconButton>
      </div>
    </div>
  );
}

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

      <Stepper
        label="Text size"
        value={prefs.fontSize}
        min={14}
        max={30}
        step={1}
        less="Smaller text"
        more="Larger text"
        onChange={(fontSize) => setPrefs({ fontSize })}
      />
      <Stepper
        label="Line spacing"
        value={prefs.lineHeight}
        min={1.3}
        max={2.2}
        step={0.1}
        less="Tighter lines"
        more="Looser lines"
        format={(value) => value.toFixed(1)}
        onChange={(lineHeight) => setPrefs({ lineHeight })}
      />
      <Stepper
        label="Paragraph spacing"
        value={prefs.paragraphGap}
        min={0.3}
        max={2}
        step={0.1}
        less="Less space between paragraphs"
        more="More space between paragraphs"
        format={(value) => value.toFixed(1)}
        onChange={(paragraphGap) => setPrefs({ paragraphGap })}
      />
      <Stepper
        label="Side margins"
        value={prefs.margin}
        min={8}
        max={48}
        step={4}
        less="Narrower margins"
        more="Wider margins"
        onChange={(margin) => setPrefs({ margin })}
      />

      <div className={styles.row}>
        <span className={styles.label}>Download ahead</span>
        <div className={styles.segmented} role="group" aria-label="Chapters to download ahead">
          {[0, 1, 3, 5, 10].map((count) => (
            <button
              key={count}
              type="button"
              className={styles.segment}
              aria-pressed={prefs.downloadAhead === count}
              onClick={() => setPrefs({ downloadAhead: count })}
            >
              {count || 'Off'}
            </button>
          ))}
        </div>
      </div>

      <SwitchRow
        label="Justify text"
        checked={prefs.justify}
        onChange={(justify) => setPrefs({ justify })}
      />

      <SwitchRow
        label="Full-screen reading"
        hint="Hides the phone's status and navigation bars"
        checked={prefs.immersive}
        onChange={(immersive) => setPrefs({ immersive })}
      />
    </div>
  );
}
