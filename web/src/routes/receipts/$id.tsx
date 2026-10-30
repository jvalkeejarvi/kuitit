import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router';
import { Archive, ArchiveRestore, ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getReceiptOptions } from '@/api/client/@tanstack/react-query.gen';
import type { ReceiptDto } from '@/api/client/types.gen';
import { receiptFileUrl } from '@/api/setup';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/dates';
import { useArchiveMutations, useDeleteMutation } from '@/lib/receiptMutations';

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

// Formats browsers can show in an <img>; PDF and HEIC open in a new tab instead.
const previewTypes = new Set(['image/jpeg', 'image/png']);

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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const archived = receipt.archivedAt != null;
  const backSearch = archived ? { archived: true } : {};
  const remove = useDeleteMutation(() => void navigate({ to: '/', search: backSearch }));
  const path = { id: receipt.id };
  const busy = archive.isPending || unarchive.isPending || remove.isPending;
  const fileUrl = receiptFileUrl(receipt.id);
  const lang = i18n.language;

  return (
    <div className="space-y-4">
      <Link
        to="/"
        search={backSearch}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {archived ? t('receipts.archived') : t('receipts.active')}
      </Link>

      <article className="space-y-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold break-words">{receipt.name}</h1>
          {receipt.store && <p className="text-slate-600 dark:text-slate-400">{receipt.store}</p>}
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
          <Detail label={t('detail.file')}>
            {receipt.fileName} ({fileSize(receipt.sizeBytes, lang)})
          </Detail>
          <Detail label={t('detail.added')}>{formatTimestamp(receipt.createdAt, lang)}</Detail>
          {receipt.archivedAt && (
            <Detail label={t('detail.archivedAt')}>{formatTimestamp(receipt.archivedAt, lang)}</Detail>
          )}
        </dl>

        {previewTypes.has(receipt.contentType) && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="block">
            <img
              src={fileUrl}
              alt={t('detail.preview', { name: receipt.name })}
              className="max-h-96 rounded-md border border-slate-200 object-contain dark:border-slate-800"
            />
          </a>
        )}

        <div className="flex flex-wrap gap-2">
          <a href={fileUrl} target="_blank" rel="noreferrer" className={buttonClass}>
            <ExternalLink className="size-4" aria-hidden />
            {t('detail.openFile')}
          </a>
          {archived ? (
            <button type="button" disabled={busy} className={buttonClass} onClick={() => unarchive.mutate({ path })}>
              <ArchiveRestore className="size-4" aria-hidden />
              {t('receipts.unarchive')}
            </button>
          ) : (
            <button type="button" disabled={busy} className={buttonClass} onClick={() => archive.mutate({ path })}>
              <Archive className="size-4" aria-hidden />
              {t('receipts.archive')}
            </button>
          )}
          {!confirmingDelete && (
            <button
              type="button"
              disabled={busy}
              className={`${buttonClass} text-red-600 dark:text-red-400`}
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="size-4" aria-hidden />
              {t('receipts.delete')}
            </button>
          )}
        </div>

        {confirmingDelete && (
          <div
            role="alertdialog"
            aria-label={t('receipts.confirmDelete')}
            className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40"
          >
            <span className="mr-auto">{t('receipts.confirmDelete')}</span>
            <button
              type="button"
              disabled={busy}
              className="rounded-md bg-red-600 px-3 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
              onClick={() => remove.mutate({ path })}
            >
              {t('receipts.delete')}
            </button>
            <button
              type="button"
              className="rounded-md px-3 py-2 hover:bg-red-100 dark:hover:bg-red-900/40"
              onClick={() => setConfirmingDelete(false)}
            >
              {t('receipts.cancel')}
            </button>
          </div>
        )}
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

function fileSize(bytes: number, locale: string): string {
  const mb = bytes >= 1024 * 1024;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: mb ? 'megabyte' : 'kilobyte',
    maximumFractionDigits: 1,
  }).format(mb ? bytes / (1024 * 1024) : Math.max(bytes / 1024, 0.1));
}

function formatTimestamp(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
}
