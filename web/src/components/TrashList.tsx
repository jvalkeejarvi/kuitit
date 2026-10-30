import { RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReceiptDto } from '@/api/client/types.gen';
import { confirmDeletePermanently } from '@/lib/confirmations';
import { formatTimestamp } from '@/lib/dates';
import { useTrashMutations } from '@/lib/receiptMutations';
import { TRASH_DAYS } from '@/lib/receiptRules';
import { useDialog } from '@/lib/useDialog';

const buttonClass =
  'inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800';

export function TrashList({ receipts }: { receipts: ReceiptDto[] }) {
  const { t, i18n } = useTranslation();
  const { restore, deletePermanently } = useTrashMutations();
  const [dialogNode, openDialog] = useDialog();
  const busy = restore.isPending || deletePermanently.isPending;

  const onDelete = async (receipt: ReceiptDto) => {
    if (await confirmDeletePermanently(openDialog, receipt.name, t)) {
      deletePermanently.mutate({ path: { id: receipt.id } });
    }
  };

  return (
    <div className="space-y-2">
      {dialogNode}
      <p className="text-sm text-slate-500 dark:text-slate-400">{t('trash.note', { days: TRASH_DAYS })}</p>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {receipts.map(receipt => (
          <li key={receipt.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3 sm:px-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium break-words">{receipt.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {[receipt.store, t('trash.deletedOn', { date: formatTimestamp(receipt.deletedAt!, i18n.language) })]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              className={buttonClass}
              onClick={() => restore.mutate({ path: { id: receipt.id } })}
            >
              <RotateCcw className="size-4" aria-hidden />
              {t('trash.restore')}
            </button>
            <button
              type="button"
              disabled={busy}
              aria-label={t('trash.deletePermanentlyNamed', { name: receipt.name })}
              className={`${buttonClass} text-red-600 dark:text-red-400`}
              onClick={() => void onDelete(receipt)}
            >
              <Trash2 className="size-4" aria-hidden />
              {t('trash.deletePermanently')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
