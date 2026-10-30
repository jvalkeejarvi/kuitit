import { useEffect, type RefObject } from 'react';

/**
 * Keeps CSS variable `name` on <html> equal to the element's rendered height, so sticky things below it can use
 * `top: var(name)` without hard-coded pixels (font size, zoom and wrapping all change heights).
 */
export function useCssHeightVar(ref: RefObject<HTMLElement | null>, name: `--${string}`): void {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new ResizeObserver(([entry]) => {
      root.style.setProperty(name, `${entry!.borderBoxSize[0]!.blockSize}px`);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty(name);
    };
  }, [ref, name]);
}
