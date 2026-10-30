import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Link } from '@tanstack/react-router';
import { Archive, ArchiveRestore } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReceiptDto } from '@/api/client/types.gen';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/dates';
import { useArchiveMutations } from '@/lib/receiptMutations';

const column = createColumnHelper<ReceiptDto>();

// Hidden on phones so the name has room; the detail page shows everything.
const columnClass: Partial<Record<string, string>> = { purchasedOn: 'hidden sm:table-cell', actions: 'w-0' };

export function ReceiptTable({ receipts }: { receipts: ReceiptDto[] }) {
  const { t, i18n } = useTranslation();

  const columns = useMemo(
    () => [
      column.accessor('name', {
        header: () => t('receipts.name'),
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
        cell: c => formatDate(c.getValue(), i18n.language),
      }),
      column.accessor('expiresOn', {
        header: () => t('receipts.expiresOn'),
        cell: c => (
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            {formatDate(c.getValue(), i18n.language)}
            <StatusBadge expiresOn={c.getValue()} />
          </span>
        ),
      }),
      column.display({
        id: 'actions',
        header: () => <span className="sr-only">{t('receipts.actions')}</span>,
        cell: c => <ArchiveButton receipt={c.row.original} />,
      }),
    ],
    [t, i18n.language],
  );

  const table = useReactTable({ data: receipts, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {table.getHeaderGroups().map(group => (
            <tr key={group.id}>
              {group.headers.map(header => (
                <th key={header.id} className={`px-3 py-2 font-medium sm:px-4 ${columnClass[header.id] ?? ''}`}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
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
