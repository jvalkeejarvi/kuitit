import { flexRender, type Table } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/**
 * The app's table look: rounded frame, sortable headers (click to sort, again to reverse), divided rows.
 *
 * The frame is drawn by the cells (border-separate), not by a wrapping box: the header row then carries the top
 * border and rounded top corners with it when it sticks (from sm up, under the top bar and toolbar:
 * --header-h + --toolbar-h, set by useCssHeightVar). Columns hidden per screen size must therefore be removed
 * through the table's column visibility, not CSS, so first/last really are the edge cells.
 *
 * Cells don't wrap, so on phones the table scrolls sideways inside its wrapper; from sm up the wrapper doesn't
 * scroll (a scroll box would break sticky).
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
    // `relative` keeps absolutely positioned content (sr-only headers) inside the wrapper, not widening the page.
    <div className="relative overflow-x-auto sm:overflow-x-visible">
      <table className="w-full border-separate border-spacing-0 text-left text-sm whitespace-nowrap">
        <thead className="text-slate-500 dark:text-slate-400">
          {table.getHeaderGroups().map(group => (
            <tr key={group.id}>
              {group.headers.map(header => {
                const sorted = header.column.getIsSorted();
                const SortIcon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
                return (
                  <th
                    key={header.id}
                    aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    className={`border-y border-slate-200 bg-white px-2 py-2 font-medium first:rounded-tl-lg first:border-l last:rounded-tr-lg last:border-r sm:sticky sm:top-[calc(var(--header-h,0px)+var(--toolbar-h,0px))] sm:z-10 sm:px-4 dark:border-slate-800 dark:bg-slate-900 ${columnClass[header.id] ?? ''}`}
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
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id} className="group">
              {row.getVisibleCells().map(cell => (
                <td
                  key={cell.id}
                  className={`border-b border-slate-200 border-b-slate-100 bg-white px-2 py-3 group-last:border-b-slate-200 first:border-l group-last:first:rounded-bl-lg last:border-r group-last:last:rounded-br-lg sm:px-4 dark:border-slate-800 dark:border-b-slate-800 dark:bg-slate-900 dark:group-last:border-b-slate-800 ${columnClass[cell.column.id] ?? ''}`}
                >
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
