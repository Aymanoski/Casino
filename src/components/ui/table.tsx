'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './input';
import { EmptyState } from './empty-state';

/**
 * Table
 * Per DESIGN.md §6:
 * Compact, sticky headers, zebra with surface vs surface-2,
 * row hover gold tint, sortable, searchable, with empty states that have a lantern illustration.
 */
export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement> & {
    maxHeightClassName?: string;
  }
>(({ className, maxHeightClassName = 'max-h-[480px]', ...props }, ref) => (
  <div
    className={cn(
      'relative w-full overflow-auto rounded-card border border-border bg-surface shadow-card-inner',
      maxHeightClassName
    )}
  >
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-start text-sm', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      'sticky top-0 z-20 border-b border-border-strong bg-bg-raised/95 backdrop-blur-md',
      className
    )}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t border-border-strong bg-bg-raised font-medium',
      className
    )}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-border transition-colors odd:bg-surface even:bg-surface-2/60 hover:bg-gold-500/[0.11] data-[state=selected]:bg-gold-500/20',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-11 px-4 text-start align-middle text-xs font-bold uppercase tracking-wider text-gold-300',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

export interface SortableTableHeadProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  active?: boolean;
  direction?: 'asc' | 'desc' | null;
  onSort?: () => void;
}

export function SortableTableHead({
  children,
  active = false,
  direction = null,
  onSort,
  className,
  ...props
}: SortableTableHeadProps) {
  return (
    <TableHead className={cn('p-0', className)} {...props}>
      <button
        type="button"
        onClick={onSort}
        className={cn(
          'flex h-11 w-full items-center gap-1.5 px-4 text-start text-xs font-bold uppercase tracking-wider transition-colors hover:text-gold-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-500',
          active ? 'text-gold-100' : 'text-gold-300'
        )}
      >
        <span>{children}</span>
        {active && direction === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5 text-gold-500" />
        ) : active && direction === 'desc' ? (
          <ArrowDown className="h-3.5 w-3.5 text-gold-500" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-55" />
        )}
      </button>
    </TableHead>
  );
}

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('px-4 py-3 align-middle text-sm text-ivory', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  sortAccessor?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowKey: (row: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  getRowKey,
  searchable = true,
  searchPlaceholder = 'Search records...',
  searchFilter,
  emptyTitle = 'No matching records',
  emptyDescription = 'Adjust your search query or filters to see tournament records.',
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = React.useState('');
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filteredAndSorted = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = data;
    if (q && searchFilter) {
      list = list.filter((item) => searchFilter(item, q));
    }

    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortAccessor) {
        const accessor = col.sortAccessor;
        list = [...list].sort((a, b) => {
          const va = accessor(a);
          const vb = accessor(b);
          if (va < vb) return sortDir === 'asc' ? -1 : 1;
          if (va > vb) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }

    return list;
  }, [data, query, searchFilter, sortKey, sortDir, columns]);

  return (
    <div className={cn('space-y-3', className)}>
      {searchable && (
        <div className="flex items-center justify-between gap-3">
          <div className="w-full max-w-sm">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              startIcon={<Search className="h-4 w-4" />}
              aria-label={searchPlaceholder}
            />
          </div>
        </div>
      )}

      {filteredAndSorted.length === 0 ? (
        <EmptyState
          compact
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <Table>
          <TableHeader>
            <tr>
              {columns.map((col) =>
                col.sortable ? (
                  <SortableTableHead
                    key={col.key}
                    active={sortKey === col.key}
                    direction={sortKey === col.key ? sortDir : null}
                    onSort={() => handleSort(col.key)}
                    className={col.className}
                  >
                    {col.header}
                  </SortableTableHead>
                ) : (
                  <TableHead key={col.key} className={col.className}>
                    {col.header}
                  </TableHead>
                )
              )}
            </tr>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.map((row) => (
              <TableRow key={getRowKey(row)}>
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
