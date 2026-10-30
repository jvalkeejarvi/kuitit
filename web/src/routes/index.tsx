import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { listReceiptsOptions } from '@/api/client/@tanstack/react-query.gen';
import { AddReceiptForm } from '@/components/AddReceiptForm';
import { ReceiptTable } from '@/components/ReceiptTable';

const searchSchema = z.object({ archived: z.boolean().optional() });

export const Route = createFileRoute('/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ archived: search.archived ?? false }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(listReceiptsOptions({ query: { archived: deps.archived } })),
  component: ReceiptsPage,
});

const tabClass = 'rounded-md px-3 py-1.5 text-sm font-medium';
const activeTab = 'bg-white shadow-sm dark:bg-slate-800';
const inactiveTab = 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100';

function ReceiptsPage() {
  const { t } = useTranslation();
  const archived = Route.useSearch().archived ?? false;
  const { data: receipts = [] } = useQuery(listReceiptsOptions({ query: { archived } }));
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <nav className="mr-auto flex gap-1 rounded-lg bg-slate-200 p-1 dark:bg-slate-900">
          <Link to="/" search={{}} className={`${tabClass} ${archived ? inactiveTab : activeTab}`}>
            {t('receipts.active')}
          </Link>
          <Link to="/" search={{ archived: true }} className={`${tabClass} ${archived ? activeTab : inactiveTab}`}>
            {t('receipts.archived')}
          </Link>
        </nav>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark"
          >
            {t('receipts.add')}
          </button>
        )}
      </div>

      {adding && <AddReceiptForm onDone={() => setAdding(false)} />}

      {receipts.length === 0 ? (
        <p className="py-12 text-center text-slate-500 dark:text-slate-400">
          {archived ? t('receipts.emptyArchived') : t('receipts.emptyActive')}
        </p>
      ) : (
        <ReceiptTable receipts={receipts} />
      )}
    </div>
  );
}
