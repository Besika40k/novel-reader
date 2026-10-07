import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/grenze';
import '@fontsource-variable/literata';
import '@fontsource-variable/literata/wght-italic.css';
import '@fontsource-variable/schibsted-grotesk';
import './styles/global.scss';
import { App } from './App';
import { setupNative } from './lib/native';
import { startTheme } from './lib/theme';

startTheme();
setupNative();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
