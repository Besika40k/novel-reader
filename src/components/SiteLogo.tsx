import type { Source } from '@/sources/types';
import styles from './SiteLogo.module.scss';

/** A site's logo, beside its name. */
export function SiteLogo({ source, size = 28 }: { source: Source; size?: number }) {
  return <img className={styles.logo} src={source.icon} alt="" width={size} height={size} />;
}
