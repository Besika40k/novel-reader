import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Open sheets and dialogs register here so the Android back button closes them first.
const backHandlers: (() => void)[] = [];

export function pushBackHandler(handler: () => void): () => void {
  backHandlers.push(handler);
  return () => {
    const i = backHandlers.lastIndexOf(handler);
    if (i >= 0) backHandlers.splice(i, 1);
  };
}

export function setupNative(): void {
  // Ask the WebView to keep downloaded chapters even when the phone runs low on space.
  void navigator.storage?.persist?.();
  if (!Capacitor.isNativePlatform()) return;
  void App.addListener('backButton', ({ canGoBack }) => {
    const close = backHandlers.at(-1);
    if (close) close();
    else if (canGoBack) window.history.back();
    // On the first screen, behave like other apps: go to the background, keeping state.
    else void App.minimizeApp();
  });
}
