import type { ReactNode } from 'react';
import styles from './Switch.module.scss';

interface SwitchRowProps {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A settings row with a label and an on/off switch. */
export function SwitchRow({ label, hint, checked, onChange }: SwitchRowProps) {
  return (
    <label className={styles.row}>
      <span className={styles.label}>
        {label}
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
      <input
        type="checkbox"
        className={styles.switch}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
