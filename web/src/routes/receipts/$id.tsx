import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router';
import { Archive, ArchiveRestore, ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getReceiptOptions } from '@/api/client/@tanstack/react-query.gen';
import type { ReceiptDto } from '@/api/client/types.gen';
import { ReceiptFiles } from '@/components/ReceiptFiles';
import { ReceiptForm } from '@/components/ReceiptForm';
import { StatusBadge } from '@/components/StatusBadge';
import { confirmArchive, confirmDelete } from '@/lib/confirmations';
import { formatDate, formatTimestamp } from '@/lib/dates';
import { useArchiveMutations, useDeleteMutation } from '@/lib/receiptMutations';
import { useDialog } from '@/lib/useDialog';

export const Route = createFileRoute('/receipts/$id')({
  loader: async ({ context, params }) => {
    if (!context.me) return;
    try {
      await context.queryClient.ensureQueryData(getReceiptOptions({ path: { id: params.id } }));
    } catch {
      throw notFound();
    }
  },
  component: ReceiptPage,
  notFoundComponent: ReceiptNotFound,
});

const buttonClass =
  'inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800';

function ReceiptPage() {
  const { id } = Route.useParams();
  const { data: receipt } = useQuery(getReceiptOptions({ path: { id } }));
  if (!receipt) return null;
  return <ReceiptDetails receipt={receipt} />;
}

function ReceiptDetails({ receipt }: { receipt: ReceiptDto }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { archive, unarchive } = useArchiveMutations();
  const [dialogNode, openDialog] = useDialog();
  const [editing, setEditing] = useState(false);
  const archived = receipt.archivedAt != null;
  const backSearch = archived ? { archived: true } : {};
  const remove = useDeleteMutation(() => void navigate({ to: '/', search: backSearch }));
  const path = { id: receipt.id };
  const busy = archive.isPending || unarchive.isPending || remove.isPending;
  const lang = i18n.language;

  const onArchive = async () => {
    if (await confirmArchive(openDialog, receipt.name, t)) archive.mutate({ path });
  };
  const onDelete = async () => {
    if (await confirmDelete(openDialog, receipt.name, t)) remove.mutate({ path });
  };

  return (
    <div className="space-y-4">
      {dialogNode}
      <Link
        to="/"
        search={backSearch}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {archived ? t('receipts.archived') : t('receipts.active')}
      </Link>

      {editing && <ReceiptForm receipt={receipt} onDone={() => setEditing(false)} />}

      <article className="space-y-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        {!editing && (
          <>
            <header className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <h1 className="text-2xl font-semibold break-words">{receipt.name}</h1>
                {receipt.store && <p className="text-slate-600 dark:text-slate-400">{receipt.store}</p>}
              </div>
              <button type="button" className={buttonClass} onClick={() => setEditing(true)}>
                <Pencil className="size-4" aria-hidden />
                {t('detail.edit')}
              </button>
            </header>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
              <Detail label={t('detail.purchasedOn')}>{formatDate(receipt.purchasedOn, lang)}</Detail>
              <Detail label={t('detail.warranty')}>{warrantyLength(receipt.warrantyMonths, t)}</Detail>
              <Detail label={t('detail.expiresOn')}>
                <span className="inline-flex flex-wrap items-center gap-2">
                  {formatDate(receipt.expiresOn, lang)}
                  <StatusBadge expiresOn={receipt.expiresOn} />
                </span>
              </Detail>
              {receipt.description && (
                <Detail label={t('detail.description')}>
                  <span className="whitespace-pre-wrap">{receipt.description}</span>
                </Detail>
              )}
              <Detail label={t('detail.added')}>{formatTimestamp(receipt.createdAt, lang)}</Detail>
              {receipt.archivedAt && (
                <Detail label={t('detail.archivedAt')}>{formatTimestamp(receipt.archivedAt, lang)}</Detail>
              )}
            </dl>
          </>
        )}

        <ReceiptFiles receipt={receipt} />

        <div className="flex flex-wrap gap-2">
          {archived ? (
            <button type="button" disabled={busy} className={buttonClass} onClick={() => unarchive.mutate({ path })}>
              <ArchiveRestore className="size-4" aria-hidden />
              {t('receipts.unarchive')}
            </button>
          ) : (
            <button type="button" disabled={busy} className={buttonClass} onClick={() => void onArchive()}>
              <Archive className="size-4" aria-hidden />
              {t('receipts.archive')}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            className={`${buttonClass} text-red-600 dark:text-red-400`}
            onClick={() => void onDelete()}
          >
            <Trash2 className="size-4" aria-hidden />
            {t('receipts.delete')}
          </button>
        </div>
      </article>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="-mt-2 sm:mt-0">{children}</dd>
    </>
  );
}

function ReceiptNotFound() {
  const { t } = useTranslation();
  return (
    <div className="py-12 text-center">
      <p>{t('detail.notFound')}</p>
      <Link to="/" className="mt-2 inline-block text-brand underline dark:text-teal-400">
        {t('detail.backToList')}
      </Link>
    </div>
  );
}

function warrantyLength(months: number, t: ReturnType<typeof useTranslation>['t']): string {
  return months % 12 === 0 ? t('detail.years', { count: months / 12 }) : t('detail.months', { count: months });
}
