import { flexRender, type Table } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/**
 * The app's table look: bordered box, sortable headers (click to sort, again to reverse), divided rows.
 * Cells don't wrap, so on narrow screens the table scrolls inside its box rather than the page.
 * From sm up the box doesn't scroll (a scroll box would break sticky), and the header row sticks under the top
 * bar and toolbar (--header-h + --toolbar-h, set by useCssHeightVar).
 */
export function DataTable<Row>({
  table,
  columnClass = {},
}: {
  table: Table<Row>;
  /** Extra classes per column id, e.g. a width. */
  columnClass?: Partial<Record<string, string>>;
}) {
  return (
    // `relative` keeps absolutely positioned content (sr-only headers) inside the box, not widening the page.
    <div className="relative overflow-x-auto rounded-lg border border-slate-200 bg-white sm:overflow-x-visible dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-left text-sm whitespace-nowrap">
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
                    className={`bg-white px-2 py-2 font-medium sm:sticky sm:top-[calc(var(--header-h,0px)+var(--toolbar-h,0px))] sm:z-10 sm:px-4 sm:shadow-[inset_0_-1px_0] sm:shadow-slate-200 dark:bg-slate-900 dark:sm:shadow-slate-800 ${columnClass[header.id] ?? ''}`}
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
                <td key={cell.id} className={`px-2 py-3 sm:px-4 ${columnClass[cell.column.id] ?? ''}`}>
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
