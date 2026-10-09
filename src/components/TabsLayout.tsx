import { Compass, History, LibraryBig, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { DownloadStatus } from './DownloadStatus';
import styles from './TabBar.module.scss';

const TABS = [
  { to: '/', label: 'Library', Icon: LibraryBig },
  { to: '/history', label: 'History', Icon: History },
  { to: '/browse', label: 'Browse', Icon: Compass },
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
            end
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
