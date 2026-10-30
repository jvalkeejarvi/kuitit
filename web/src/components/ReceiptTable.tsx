import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { Link } from '@tanstack/react-router';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReceiptDto } from '@/api/client/types.gen';
import { StatusBadge } from '@/components/StatusBadge';
import { expiryStatus, formatDate } from '@/lib/dates';
import { sortColumns, type ReceiptSort, type SortColumn } from '@/lib/receiptSort';
import { useArchiveMutations } from '@/lib/receiptMutations';

const column = createColumnHelper<ReceiptDto>();

// Hidden on phones so the name has room; the sort picker and the detail page cover them there.
const columnClass: Partial<Record<string, string>> = {
  purchasedOn: 'hidden sm:table-cell',
  expired: 'hidden sm:table-cell',
  actions: 'w-0',
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
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            {formatDate(c.getValue(), i18n.language)}
            <StatusBadge expiresOn={c.getValue()} />
          </span>
        ),
      }),
      column.accessor(r => expiryStatus(r.expiresOn) === 'expired', {
        id: 'expired',
        header: () => t('receipts.expired'),
        sortingFn: (a, b) =>
          Number(a.getValue('expired')) - Number(b.getValue('expired')) ||
          a.original.expiresOn.localeCompare(b.original.expiresOn),
        cell: c => (c.getValue() ? t('receipts.yes') : t('receipts.no')),
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

  return (
    <div className="space-y-2">
      <SortPicker sort={sort} onSortChange={onSortChange} />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {table.getHeaderGroups().map(group => (
              <tr key={group.id}>
                {group.headers.map(header => {
                  const sorted = header.column.getIsSorted();
                  const SortIcon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
                  return (
                    <th
                      key={header.id}
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                      className={`px-3 py-2 font-medium sm:px-4 ${columnClass[header.id] ?? ''}`}
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon className={`size-3.5 shrink-0 ${sorted ? '' : 'opacity-40'}`} aria-hidden />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className={`px-3 py-3 sm:px-4 ${columnClass[cell.column.id] ?? ''}`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Phones hide some columns, so sorting there goes through this instead of the headers. */
function SortPicker({ sort, onSortChange }: { sort: ReceiptSort; onSortChange: (sort: ReceiptSort) => void }) {
  const { t } = useTranslation();
  const DirectionIcon = sort.desc ? ArrowDown : ArrowUp;
  return (
    <div className="flex items-center justify-end gap-2 text-sm sm:hidden">
      <label htmlFor="sort" className="text-slate-500 dark:text-slate-400">
        {t('receipts.sortBy')}
      </label>
      <select
        id="sort"
        value={sort.column}
        onChange={e => onSortChange({ column: e.target.value as SortColumn, desc: false })}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
      >
        {sortColumns.map(c => (
          <option key={c} value={c}>
            {t(`receipts.${c}`)}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={sort.desc ? t('receipts.sortDescending') : t('receipts.sortAscending')}
        title={sort.desc ? t('receipts.sortDescending') : t('receipts.sortAscending')}
        onClick={() => onSortChange({ ...sort, desc: !sort.desc })}
        className="rounded-md border border-slate-300 p-1.5 dark:border-slate-700"
      >
        <DirectionIcon className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function ArchiveButton({ receipt }: { receipt: ReceiptDto }) {
  const { t } = useTranslation();
  const { archive, unarchive } = useArchiveMutations();
  const path = { id: receipt.id };
  const [label, Icon, mutation] = receipt.archivedAt
    ? [t('receipts.unarchive'), ArchiveRestore, unarchive]
    : [t('receipts.archive'), Archive, archive];

  return (
    <button
      type="button"
      aria-label={`${label}: ${receipt.name}`}
      title={label}
      disabled={archive.isPending || unarchive.isPending}
      onClick={() => mutation.mutate({ path })}
      className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}
