import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { listReceiptsOptions, listTrashOptions } from '@/api/client/@tanstack/react-query.gen';
import type { ReceiptDto } from '@/api/client/types.gen';
import { ReceiptTable } from '@/components/ReceiptTable';
import { TrashTable } from '@/components/TrashTable';
import { filterReceipts } from '@/lib/receiptSearch';
import { useCssHeightVar } from '@/lib/useCssHeightVar';
import { sortColumns, type ReceiptSort } from '@/lib/receiptSort';

const searchSchema = z.object({
  archived: z.boolean().optional(),
  trash: z.boolean().optional(),
  // .catch: an unknown column (e.g. an old link) falls back to the default sort instead of an error page.
  sort: z.enum(sortColumns).optional().catch(undefined),
  desc: z.boolean().optional(),
  /** Search text; kept in the URL so it survives opening a receipt and coming back. */
  q: z.string().optional(),
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

const tabClass = 'flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium sm:flex-none';
const activeTab = 'bg-white shadow-sm dark:bg-slate-800';
const inactiveTab = 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100';

function ReceiptsPage() {
  const { t, i18n } = useTranslation();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab: Tab = search.trash ? 'trash' : search.archived ? 'archived' : 'active';
  const sort: ReceiptSort = { column: search.sort ?? 'expiresOn', desc: search.desc ?? false };
  const { data: receipts = noReceipts } = useQuery({
    ...listReceiptsOptions({ query: { archived: tab === 'archived' } }),
    enabled: tab !== 'trash',
  });
  const { data: trash = noReceipts } = useQuery({ ...listTrashOptions(), enabled: tab === 'trash' });
  // Typed into local state (a controlled input fed from the URL would lag), mirrored to ?q= for back navigation.
  const [query, setQuery] = useState(search.q ?? '');
  const toolbarRef = useRef<HTMLDivElement>(null);
  useCssHeightVar(toolbarRef, '--toolbar-h');
  const filtered = useMemo(
    () => filterReceipts(tab === 'trash' ? trash : receipts, query, i18n.language),
    [tab, trash, receipts, query, i18n.language],
  );
  const total = tab === 'trash' ? trash.length : receipts.length;

  return (
    <div className="space-y-4">
      {/* From sm up the toolbar sticks under the top bar (and the table header under it); --toolbar-h feeds that.
          It absorbs main's top padding (-mt-6/pt-6) and makes the gap below it with its own padding (pb-4, mb-0
          overriding space-y's margin), so the table starts right at its bottom edge: the spacing is the same at
          rest and when stuck, and the sticky header row's offset equals its natural position. */}
      <div
        ref={toolbarRef}
        className="flex flex-col gap-3 bg-slate-50 sm:sticky sm:top-(--header-h) sm:z-20 sm:-mt-6 sm:mb-0 sm:flex-row sm:items-center sm:justify-between sm:pt-6 sm:pb-4 dark:bg-slate-950"
      >
        {/* Phones: full width, three equal parts (a segmented control); from sm up: left-aligned with the table. */}
        <nav className="flex gap-1 rounded-lg bg-slate-200 p-1 sm:w-fit dark:bg-slate-900">
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
        <label className="relative sm:w-80">
          <span className="sr-only">{t('search.label')}</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            placeholder={t('search.placeholder')}
            onChange={e => {
              setQuery(e.target.value);
              void navigate({ search: prev => ({ ...prev, q: e.target.value || undefined }), replace: true });
            }}
            className="h-9 w-full rounded-md border border-slate-300 bg-white pr-3 pl-9 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-slate-500 dark:text-slate-400">
          {total === 0 ? t(emptyText[tab]) : t('search.noResults')}
        </p>
      ) : tab === 'trash' ? (
        <TrashTable receipts={filtered} />
      ) : (
        <ReceiptTable
          receipts={filtered}
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
