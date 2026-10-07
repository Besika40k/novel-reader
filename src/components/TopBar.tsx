import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { IconButton } from './Button';
import styles from './TopBar.module.scss';

interface TopBarProps {
  title?: ReactNode;
  /** Show a back button; the value is where to go when there's no history to go back to. */
  back?: string;
  /** Large display title, for the main tabs. */
  display?: boolean;
  actions?: ReactNode;
}

export function TopBar({ title, back, display, actions }: TopBarProps) {
  const navigate = useNavigate();
  const goBack = () => {
    // React Router stores the history position in history.state.idx.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(back ?? '/', { replace: true });
  };
  return (
    <header className={styles.bar}>
      {back !== undefined && (
        <IconButton label="Back" onClick={goBack}>
          <ArrowLeft />
        </IconButton>
      )}
      <h1 className={display ? styles.display : styles.title}>{title}</h1>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
