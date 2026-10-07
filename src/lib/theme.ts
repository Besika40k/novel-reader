import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { getPrefs, subscribePrefs, type Prefs, type ThemeName } from './prefs';

// Matches --bg in global.scss, for the browser chrome colour.
const BACKGROUNDS: Record<ThemeName, string> = {
  light: '#eef4f4',
  sepia: '#f4ecdc',
  dark: '#141a19',
  black: '#000000',
};

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function resolveTheme(theme: Prefs['theme']): ThemeName {
  if (theme !== 'system') return theme;
  return darkQuery().matches ? 'dark' : 'light';
}

let applied: ThemeName | undefined;

function apply() {
  const theme = resolveTheme(getPrefs().theme);
  if (theme === applied) return;
  applied = theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BACKGROUNDS[theme]);
  if (Capacitor.isNativePlatform()) {
    // Status bar icons must contrast with the app background drawn behind them.
    const dark = theme === 'dark' || theme === 'black';
    void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
  }
}

export function startTheme(): void {
  apply();
  subscribePrefs(apply);
  darkQuery().addEventListener('change', apply);
}
