import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { Link } from '@tanstack/react-router';
import { Archive, ArchiveRestore } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReceiptDto } from '@/api/client/types.gen';
import { DataTable } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { confirmArchive } from '@/lib/confirmations';
import { formatDate } from '@/lib/dates';
import type { ReceiptSort, SortColumn } from '@/lib/receiptSort';
import { useArchiveMutations } from '@/lib/receiptMutations';
import { useDialog } from '@/lib/useDialog';

const column = createColumnHelper<ReceiptDto>();

// The icon column is hidden on phones, where it would force sideways scrolling; archive and delete are on the detail page.
const columnClass: Partial<Record<string, string>> = {
  // Long names wrap (between words) rather than widen the table past a phone screen.
  name: 'whitespace-normal break-words hyphens-auto',
  // Date above badge; the header may take two lines ("Takuu / päättyy") so the column stays narrow.
  expiresOn: 'whitespace-normal',
  actions: 'hidden w-0 sm:table-cell',
};

export function ReceiptTable({
  receipts,
  sort,
  onSortChange,
}: {
  receipts: ReceiptDto[];
  sort: ReceiptSort;
  onSortChange: (sort: ReceiptSort) => void;
}) {
  const { t, i18n } = useTranslation();

  const columns = useMemo(
    () => [
      column.accessor('name', {
        header: () => t('receipts.name'),
        sortingFn: (a, b) =>
          a.original.name.localeCompare(b.original.name, i18n.language, { numeric: true, sensitivity: 'base' }),
        cell: c => (
          <Link
            to="/receipts/$id"
            params={{ id: c.row.original.id }}
            className="block font-medium text-brand hover:underline dark:text-teal-400"
          >
            {c.getValue()}
            {c.row.original.store && (
              <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                {c.row.original.store}
              </span>
            )}
          </Link>
        ),
      }),
      column.accessor('purchasedOn', {
        header: () => t('receipts.purchasedOn'),
        sortingFn: 'basic',
        cell: c => formatDate(c.getValue(), i18n.language),
      }),
      column.accessor('expiresOn', {
        header: () => t('receipts.expiresOn'),
        sortingFn: 'basic',
        cell: c => (
          <span className="flex flex-col items-start gap-1">
            {formatDate(c.getValue(), i18n.language)}
            <StatusBadge expiresOn={c.getValue()} />
          </span>
        ),
      }),
      column.display({
        id: 'actions',
        enableSorting: false,
        header: () => <span className="sr-only">{t('receipts.actions')}</span>,
        cell: c => <ArchiveButton receipt={c.row.original} />,
      }),
    ],
    [t, i18n.language],
  );

  // Stable identity: a new array each render makes the table re-sort, reset its page index and render again, forever.
  const sorting = useMemo<SortingState>(() => [{ id: sort.column, desc: sort.desc }], [sort.column, sort.desc]);
  const table = useReactTable({
    data: receipts,
    columns,
    state: { sorting },
    onSortingChange: updater => {
      const [next] = typeof updater === 'function' ? updater(sorting) : updater;
      // Clicking a sorted column a third time would clear sorting; flip direction instead.
      onSortChange(next ? { column: next.id as SortColumn, desc: next.desc } : { ...sort, desc: !sort.desc });
    },
    enableMultiSort: false,
    autoResetPageIndex: false,
    sortDescFirst: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return <DataTable table={table} columnClass={columnClass} />;
}

function ArchiveButton({ receipt }: { receipt: ReceiptDto }) {
  const { t } = useTranslation();
  const { archive, unarchive } = useArchiveMutations();
  const [dialogNode, openDialog] = useDialog();
  const path = { id: receipt.id };
  const archived = receipt.archivedAt != null;
  const label = archived ? t('receipts.unarchive') : t('receipts.archive');
  const Icon = archived ? ArchiveRestore : Archive;

  // Restoring is harmless; archiving hides the receipt from the main list, so it asks first.
  const onClick = async () => {
    if (archived) unarchive.mutate({ path });
    else if (await confirmArchive(openDialog, receipt.name, t)) archive.mutate({ path });
  };

  return (
    <>
      {dialogNode}
      <button
        type="button"
        aria-label={`${label}: ${receipt.name}`}
        title={label}
        disabled={archive.isPending || unarchive.isPending}
        onClick={() => void onClick()}
        className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <Icon className="size-5" aria-hidden />
      </button>
    </>
  );
}
