import { X } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ToastContext, type Toast } from '@/lib/toast';

/** Long enough to notice and reach for Undo, short enough not to linger. */
const visibleMs = 10_000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<(Toast & { key: number }) | null>(null);
  const show = useCallback((toast: Toast) => setCurrent({ ...toast, key: Date.now() }), []);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setCurrent(null), visibleMs);
    return () => clearTimeout(timer);
  }, [current]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        {current && <ToastView key={current.key} toast={current} onClose={() => setCurrent(null)} />}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg bg-slate-900 py-2 pr-2 pl-4 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
    >
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            onClose();
            void toast.action!.run();
          }}
          className="rounded px-2 py-1 font-semibold text-teal-300 hover:bg-white/10 dark:text-teal-700 dark:hover:bg-black/10"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label={t('toast.close')}
        onClick={onClose}
        className="rounded p-1 opacity-70 hover:bg-white/10 hover:opacity-100 dark:hover:bg-black/10"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
