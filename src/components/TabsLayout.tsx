import { Compass, History, LibraryBig, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { DownloadStatus } from './DownloadStatus';
import styles from './TabBar.module.scss';

/** A coiled serpent, for the Pet tab: lucide has no snake. */
function SerpentIcon(props: { 'aria-hidden'?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 18c0 2 2 3 4 3h8a4 4 0 0 0 0-8H8a3 3 0 0 1 0-6h7" />
      <path d="M15 7c2 0 4-1 4-3" />
      <circle cx="17.5" cy="4.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

const TABS = [
  { to: '/', label: 'Library', Icon: LibraryBig },
  { to: '/history', label: 'History', Icon: History },
  { to: '/browse', label: 'Browse', Icon: Compass },
  { to: '/pet', label: 'Serpent', Icon: SerpentIcon },
  { to: '/settings', label: 'Settings', Icon: Settings },
];

export function TabsLayout() {
  return (
    <>
      <main className={styles.page}>
        <Outlet />
      </main>
      <DownloadStatus aboveTabs />
      <nav className={styles.bar} aria-label="Main">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [styles.tab, isActive && styles.active].filter(Boolean).join(' ')
            }
          >
            <Icon aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
