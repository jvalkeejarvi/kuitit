import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { listReceiptsOptions, listTrashOptions } from '@/api/client/@tanstack/react-query.gen';
import type { ReceiptDto } from '@/api/client/types.gen';
import { ReceiptForm } from '@/components/ReceiptForm';
import { ReceiptTable } from '@/components/ReceiptTable';
import { TrashTable } from '@/components/TrashTable';
import { sortColumns, type ReceiptSort } from '@/lib/receiptSort';

const searchSchema = z.object({
  archived: z.boolean().optional(),
  trash: z.boolean().optional(),
  /** The add form is open (the header's + links here from any page). */
  add: z.boolean().optional(),
  // .catch: an unknown column (e.g. an old link) falls back to the default sort instead of an error page.
  sort: z.enum(sortColumns).optional().catch(undefined),
  desc: z.boolean().optional(),
});

export const Route = createFileRoute('/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ archived: search.archived ?? false, trash: search.trash ?? false }),
  // Signed out or denied: the root shows its own screen, and a 401 here would bounce to the IdP.
  loader: ({ context, deps }) =>
    context.me &&
    (deps.trash
      ? context.queryClient.ensureQueryData(listTrashOptions())
      : context.queryClient.ensureQueryData(listReceiptsOptions({ query: { archived: deps.archived } }))),
  component: ReceiptsPage,
});

// Shared fallback: a fresh [] each render would change the table's data identity every time.
const noReceipts: ReceiptDto[] = [];

type Tab = 'active' | 'archived' | 'trash';

const tabs = [
  ['active', 'receipts.active', {}],
  ['archived', 'receipts.archived', { archived: true }],
  ['trash', 'trash.tab', { trash: true }],
] as const;

const emptyText = {
  active: 'receipts.emptyActive',
  archived: 'receipts.emptyArchived',
  trash: 'trash.empty',
} as const;

const tabClass = 'rounded-md px-3 py-1.5 text-sm font-medium';
const activeTab = 'bg-white shadow-sm dark:bg-slate-800';
const inactiveTab = 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100';

function ReceiptsPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab: Tab = search.trash ? 'trash' : search.archived ? 'archived' : 'active';
  const sort: ReceiptSort = { column: search.sort ?? 'expiresOn', desc: search.desc ?? false };
  const { data: receipts = noReceipts } = useQuery({
    ...listReceiptsOptions({ query: { archived: tab === 'archived' } }),
    enabled: tab !== 'trash',
  });
  const { data: trash = noReceipts } = useQuery({ ...listTrashOptions(), enabled: tab === 'trash' });
  const shown = tab === 'trash' ? trash : receipts;

  return (
    <div className="space-y-4">
      <nav className="flex w-fit gap-1 rounded-lg bg-slate-200 p-1 dark:bg-slate-900">
        {tabs.map(([id, label, params]) => (
          <Link
            key={id}
            to="/"
            search={prev => ({ ...prev, archived: undefined, trash: undefined, ...params })}
            className={`${tabClass} ${tab === id ? activeTab : inactiveTab}`}
          >
            {t(label)}
          </Link>
        ))}
      </nav>

      {search.add && (
        <ReceiptForm
          onDone={() => void navigate({ search: prev => ({ ...prev, add: undefined }) })}
          // New receipts are active: show them, wherever adding started.
          onSaved={() =>
            void navigate({ search: prev => ({ ...prev, add: undefined, archived: undefined, trash: undefined }) })
          }
        />
      )}

      {shown.length === 0 ? (
        <p className="py-12 text-center text-slate-500 dark:text-slate-400">{t(emptyText[tab])}</p>
      ) : tab === 'trash' ? (
        <TrashTable receipts={trash} />
      ) : (
        <ReceiptTable
          receipts={receipts}
          sort={sort}
          onSortChange={next =>
            void navigate({
              search: prev => ({ ...prev, sort: next.column, desc: next.desc || undefined }),
              replace: true,
            })
          }
        />
      )}
    </div>
  );
}
