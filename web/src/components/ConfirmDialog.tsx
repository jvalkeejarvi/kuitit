import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

const confirmClass: Record<'default' | 'delete', string> = {
  default: 'bg-brand hover:bg-brand-dark',
  delete: 'bg-red-600 hover:bg-red-700',
};

/** Modal confirm on the native <dialog>: focus trap, Esc and backdrop come from the browser. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  variant = 'default',
  onClose,
}: {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  variant?: 'default' | 'delete';
  onClose: (confirmed: boolean) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    // After showModal, which moves focus itself; React's autoFocus would run before the dialog opens.
    // Cancel first, so Enter never confirms by accident.
    cancelRef.current?.focus();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Esc
      onCancel={e => {
        e.preventDefault();
        onClose(false);
      }}
      // Clicks on the backdrop land on the <dialog> itself.
      onClick={e => e.target === e.currentTarget && onClose(false)}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-lg border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="space-y-2 p-5">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
        <button
          ref={cancelRef}
          type="button"
          onClick={() => onClose(false)}
          className="rounded-md px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {t('receipts.cancel')}
        </button>
        <button
          type="button"
          onClick={() => onClose(true)}
          className={`rounded-md px-4 py-2 font-medium text-white ${confirmClass[variant]}`}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
