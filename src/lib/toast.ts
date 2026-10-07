import { useSyncExternalStore } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

let current: ToastMessage | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function toast(text: string, tone: ToastMessage['tone'] = 'info'): void {
  current = { id: nextId++, text, tone };
  clearTimeout(timer);
  timer = setTimeout(dismissToast, tone === 'error' ? 6000 : 3500);
  emit();
}

export function dismissToast(): void {
  current = null;
  emit();
}

export function useToast(): ToastMessage | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
