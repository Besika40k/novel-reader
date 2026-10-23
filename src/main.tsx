import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/grenze';
import '@fontsource-variable/literata';
import '@fontsource-variable/literata/wght-italic.css';
import '@fontsource-variable/schibsted-grotesk';
import './styles/global.scss';
import { App } from './App';
import { autoBackupIfDue } from './db/autoBackup';
import { autoUpdateIfDue } from './db/autoUpdate';
import { setupNative } from './lib/native';
import { startTheme } from './lib/theme';

startTheme();
setupNative();
// A failed automatic backup is retried at the next start.
setTimeout(() => void autoBackupIfDue().catch(() => undefined), 5000);
// New chapters: a while after start, so opening the app stays quick, and on coming back to it.
setTimeout(() => void autoUpdateIfDue().catch(() => undefined), 8000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void autoUpdateIfDue().catch(() => undefined);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
