import { createContext, useContext } from 'react';

export type Toast = {
  message: string;
  /** e.g. Undo. Runs once; the toast closes when clicked. */
  action?: { label: string; run: () => Promise<unknown> | void };
};

export const ToastContext = createContext<(toast: Toast) => void>(() => {});

/** Shows a short message at the bottom of the screen; a new one replaces the current one. */
export function useToast(): (toast: Toast) => void {
  return useContext(ToastContext);
}
