import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  archiveReceiptMutation,
  deleteReceiptMutation,
  listReceiptsQueryKey,
  unarchiveReceiptMutation,
} from '@/api/client/@tanstack/react-query.gen';
import type { ReceiptDto } from '@/api/client/types.gen';
import { receiptFileUrl } from '@/api/setup';
import { expiryStatus, formatDate, type ExpiryStatus } from '@/lib/dates';

const statusClass: Record<ExpiryStatus, string> = {
  expired: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  expiringSoon: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  valid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};

const column = createColumnHelper<ReceiptDto>();

export function ReceiptTable({ receipts }: { receipts: ReceiptDto[] }) {
  const { t, i18n } = useTranslation();

  const columns = useMemo(
    () => [
      column.accessor('name', { header: () => t('receipts.name') }),
      column.accessor('purchasedOn', {
        header: () => t('receipts.purchasedOn'),
        cell: c => formatDate(c.getValue(), i18n.language),
      }),
      column.accessor('expiresOn', {
        header: () => t('receipts.expiresOn'),
        cell: c => {
          const status = expiryStatus(c.getValue());
          return (
            <span className="inline-flex flex-wrap items-center gap-2">
              {formatDate(c.getValue(), i18n.language)}
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusClass[status]}`}>
                {t(`receipts.status.${status}`)}
              </span>
            </span>
          );
        },
      }),
      column.display({
        id: 'actions',
        header: () => <span className="sr-only">{t('receipts.actions')}</span>,
        cell: c => <RowActions receipt={c.row.original} />,
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
                <th key={header.id} className="px-4 py-2 font-medium">
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
                <td key={cell.id} className="px-4 py-3">
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

const actionClass = 'rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800';

function RowActions({ receipt }: { receipt: ReceiptDto }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: listReceiptsQueryKey() });
  const archive = useMutation({ ...archiveReceiptMutation(), onSuccess });
  const unarchive = useMutation({ ...unarchiveReceiptMutation(), onSuccess });
  const remove = useMutation({ ...deleteReceiptMutation(), onSuccess });
  const path = { id: receipt.id };
  const busy = archive.isPending || unarchive.isPending || remove.isPending;

  if (confirming) {
    return (
      <span className="flex flex-wrap items-center justify-end gap-1 whitespace-nowrap">
        <span>{t('receipts.confirmDelete')}</span>
        <button
          type="button"
          disabled={busy}
          className={`${actionClass} text-red-600 dark:text-red-400`}
          onClick={() => remove.mutate({ path })}
        >
          {t('receipts.delete')}
        </button>
        <button type="button" className={actionClass} onClick={() => setConfirming(false)}>
          {t('receipts.cancel')}
        </button>
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center justify-end gap-1 whitespace-nowrap">
      <a
        href={receiptFileUrl(receipt.id)}
        target="_blank"
        rel="noreferrer"
        className={`${actionClass} text-brand dark:text-teal-400`}
      >
        {t('receipts.open')}
      </a>
      {receipt.archivedAt ? (
        <button type="button" disabled={busy} className={actionClass} onClick={() => unarchive.mutate({ path })}>
          {t('receipts.unarchive')}
        </button>
      ) : (
        <button type="button" disabled={busy} className={actionClass} onClick={() => archive.mutate({ path })}>
          {t('receipts.archive')}
        </button>
      )}
      <button
        type="button"
        className={`${actionClass} text-red-600 dark:text-red-400`}
        onClick={() => setConfirming(true)}
      >
        {t('receipts.delete')}
      </button>
    </span>
  );
}
