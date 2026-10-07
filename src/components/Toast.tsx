import { dismissToast, useToast } from '@/lib/toast';
import styles from './Toast.module.scss';

export function Toast() {
  const message = useToast();
  if (!message) return null;
  return (
    <button
      key={message.id}
      type="button"
      role="status"
      className={[styles.toast, message.tone === 'error' && styles.error].filter(Boolean).join(' ')}
      onClick={dismissToast}
    >
      {message.text}
    </button>
  );
}
