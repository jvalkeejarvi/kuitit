import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReceiptDto } from '@/api/client/types.gen';
import { DataTable } from '@/components/DataTable';
import { confirmDeletePermanently } from '@/lib/confirmations';
import { formatDate, formatTimestamp } from '@/lib/dates';
import { useTrashMutations } from '@/lib/receiptMutations';
import { TRASH_DAYS } from '@/lib/receiptRules';
import { useDialog } from '@/lib/useDialog';

const column = createColumnHelper<ReceiptDto>();

const columnClass: Partial<Record<string, string>> = { actions: 'w-0' };

const iconButtonClass =
  'rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';

/** When the purge job removes it for good. */
function purgeDate(deletedAt: string): Date {
  const date = new Date(deletedAt);
  date.setDate(date.getDate() + TRASH_DAYS);
  return date;
}

export function TrashTable({ receipts }: { receipts: ReceiptDto[] }) {
  const { t, i18n } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'deletedAt', desc: true }]);

  const columns = useMemo(
    () => [
      column.accessor('name', {
        header: () => t('receipts.name'),
        sortingFn: (a, b) =>
          a.original.name.localeCompare(b.original.name, i18n.language, { numeric: true, sensitivity: 'base' }),
        // Not a link: trashed receipts can't be opened, only restored.
        cell: c => (
          <>
            <span className="block font-medium">{c.getValue()}</span>
            {c.row.original.store && (
              <span className="block text-xs text-slate-500 dark:text-slate-400">{c.row.original.store}</span>
            )}
          </>
        ),
      }),
      column.accessor('purchasedOn', {
        header: () => t('receipts.purchasedOn'),
        sortingFn: 'basic',
        cell: c => formatDate(c.getValue(), i18n.language),
      }),
      column.accessor(r => r.deletedAt ?? '', {
        id: 'deletedAt',
        header: () => t('trash.deletedAt'),
        sortingFn: 'basic',
        cell: c => formatTimestamp(c.getValue(), i18n.language),
      }),
      column.accessor(r => r.deletedAt ?? '', {
        id: 'purgeOn',
        header: () => t('trash.purgeOn'),
        sortingFn: 'basic',
        cell: c => formatTimestamp(purgeDate(c.getValue()).toISOString(), i18n.language),
      }),
      column.display({
        id: 'actions',
        enableSorting: false,
        header: () => <span className="sr-only">{t('receipts.actions')}</span>,
        cell: c => <TrashActions receipt={c.row.original} />,
      }),
    ],
    [t, i18n.language],
  );

  const table = useReactTable({
    data: receipts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    enableMultiSort: false,
    enableSortingRemoval: false,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500 dark:text-slate-400">{t('trash.note', { days: TRASH_DAYS })}</p>
      <DataTable table={table} columnClass={columnClass} />
    </div>
  );
}

function TrashActions({ receipt }: { receipt: ReceiptDto }) {
  const { t } = useTranslation();
  const { restore, deletePermanently } = useTrashMutations();
  const [dialogNode, openDialog] = useDialog();
  const path = { id: receipt.id };
  const busy = restore.isPending || deletePermanently.isPending;

  const onDelete = async () => {
    if (await confirmDeletePermanently(openDialog, receipt.name, t)) deletePermanently.mutate({ path });
  };

  return (
    <span className="flex gap-1">
      {dialogNode}
      <button
        type="button"
        aria-label={`${t('trash.restore')}: ${receipt.name}`}
        title={t('trash.restore')}
        disabled={busy}
        onClick={() => restore.mutate({ path })}
        className={iconButtonClass}
      >
        <RotateCcw className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={`${t('trash.deletePermanently')}: ${receipt.name}`}
        title={t('trash.deletePermanently')}
        disabled={busy}
        onClick={() => void onDelete()}
        className={`${iconButtonClass} hover:text-red-600 dark:hover:text-red-400`}
      >
        <Trash2 className="size-5" aria-hidden />
      </button>
    </span>
  );
}
