import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import styles from './buttons.module.scss';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  block?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  block,
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], block && styles.block, className];
  return (
    <button type="button" className={classes.filter(Boolean).join(' ')} {...rest}>
      {icon}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name, also shown as a tooltip. */
  label: string;
}

export function IconButton({ label, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[styles.icon, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ size = 22, label }: { size?: number; label?: string }) {
  return (
    <LoaderCircle
      className={styles.spin}
      width={size}
      height={size}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
