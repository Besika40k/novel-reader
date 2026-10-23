import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/grenze';
import '@fontsource-variable/literata';
import '@fontsource-variable/literata/wght-italic.css';
import '@fontsource-variable/schibsted-grotesk';
import './styles/global.scss';
import { App } from './App';
import { autoBackupIfDue } from './db/autoBackup';
import { setupNative } from './lib/native';
import { startTheme } from './lib/theme';

startTheme();
setupNative();
// A failed automatic backup is retried at the next start.
setTimeout(() => void autoBackupIfDue().catch(() => undefined), 5000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
