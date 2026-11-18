'use client';

import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  LayoutGrid,
  Search,
  SlidersHorizontal,
  Table2,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Input } from './input';
import { Button } from './button';
import { EmptyState } from './empty-state';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

/**
 * Table
 * Per DESIGN.md §6 & AGENTS.md §13:
 * Compact, sticky headers, sticky first column (optional, enabled by default),
 * zebra with surface vs surface-2, row hover gold tint, sortable, searchable,
 * mobile card-list fallback or horizontal scroll inside container.
 */
export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement> & {
    maxHeightClassName?: string;
    stickyFirstColumn?: boolean;
  }
>(
  (
    {
      className,
      maxHeightClassName = 'max-h-[480px]',
      stickyFirstColumn = true,
      ...props
    },
    ref
  ) => (
    <div
      className={cn(
        'relative w-full overflow-auto overscroll-x-contain rounded-card border border-border bg-surface shadow-card-inner',
        maxHeightClassName
      )}
    >
      <table
        ref={ref}
        className={cn(
          'w-full caption-bottom text-start text-sm',
          stickyFirstColumn &&
            '[&_thead_th:first-child]:sticky [&_thead_th:first-child]:start-0 [&_thead_th:first-child]:z-30 [&_thead_th:first-child]:bg-bg-raised [&_tbody_td:first-child]:sticky [&_tbody_td:first-child]:start-0 [&_tbody_td:first-child]:z-10 [&_tbody_tr:nth-child(odd)>td:first-child]:bg-surface [&_tbody_tr:nth-child(even)>td:first-child]:bg-surface-2 [&_thead_th:first-child]:shadow-[4px_0_10px_-4px_rgba(7,11,26,0.75)] [&_tbody_td:first-child]:shadow-[4px_0_10px_-4px_rgba(7,11,26,0.75)] rtl:[&_thead_th:first-child]:shadow-[-4px_0_10px_-4px_rgba(7,11,26,0.75)] rtl:[&_tbody_td:first-child]:shadow-[-4px_0_10px_-4px_rgba(7,11,26,0.75)]',
          className
        )}
        {...props}
      />
    </div>
  )
);
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
      'h-11 whitespace-nowrap px-4 text-start align-middle text-xs font-bold uppercase tracking-wider text-gold-300',
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
          'flex min-h-[44px] w-full items-center gap-1.5 whitespace-nowrap px-4 text-start text-xs font-bold uppercase tracking-wider transition-colors hover:text-gold-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-500',
          active ? 'text-gold-100' : 'text-gold-300'
        )}
      >
        <span>{children}</span>
        {active && direction === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5 shrink-0 text-gold-500" />
        ) : active && direction === 'desc' ? (
          <ArrowDown className="h-3.5 w-3.5 shrink-0 text-gold-500" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-55" />
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
  /** Optional mobile card role: 'title' highlights in card header; 'hidden' omits on mobile cards */
  mobileRole?: 'badge' | 'title' | 'meta' | 'hidden';
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowKey: (row: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  /** Optional filter controls; shown inline on md+ and inside a bottom-sheet Dialog on phones */
  filterSlot?: React.ReactNode;
  filterLabel?: string;
  /** Default mobile representation below md (768px): 'cards' (with optional switch) or 'scroll' (sticky first col) */
  mobileMode?: 'cards' | 'scroll';
  allowMobileViewToggle?: boolean;
  stickyFirstColumn?: boolean;
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
  filterSlot,
  filterLabel,
  mobileMode = 'cards',
  allowMobileViewToggle = true,
  stickyFirstColumn = true,
  emptyTitle = 'No matching records',
  emptyDescription = 'Adjust your search query or filters to see tournament records.',
  className,
}: DataTableProps<T>) {
  const { lang } = useI18n();
  const [query, setQuery] = React.useState('');
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = React.useState<'cards' | 'scroll'>(mobileMode);

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

  // Identify primary/header columns for mobile card rendering
  const titleCol =
    columns.find((c) => c.mobileRole === 'title') ?? columns[1] ?? columns[0];
  const badgeCol =
    columns.find((c) => c.mobileRole === 'badge') ??
    (columns.length > 1 && titleCol !== columns[0] ? columns[0] : undefined);
  const metaColumns = columns.filter(
    (c) => c !== titleCol && c !== badgeCol && c.mobileRole !== 'hidden'
  );

  const cardsLabel = lang === 'ar' ? 'بطاقات' : 'Cards';
  const tableLabel = lang === 'ar' ? 'جدول' : 'Table';
  const resolvedFilterLabel =
    filterLabel ?? (lang === 'ar' ? 'تصفية' : 'Filters');

  return (
    <div className={cn('space-y-3', className)}>
      {(searchable || filterSlot || allowMobileViewToggle) && (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {searchable ? (
            <div className="w-full sm:max-w-sm">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                startIcon={<Search className="h-4 w-4" />}
                aria-label={searchPlaceholder}
              />
            </div>
          ) : (
            <div />
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* Desktop inline filters */}
            {filterSlot && (
              <div className="hidden md:flex md:items-center md:gap-2">
                {filterSlot}
              </div>
            )}

            {/* Mobile Filter Bottom Sheet Trigger (AGENTS.md §13) */}
            {filterSlot && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="surface"
                    size="sm"
                    className="md:hidden"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-gold-500" />
                    <span>{resolvedFilterLabel}</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{resolvedFilterLabel}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">{filterSlot}</div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="primary" size="md">
                        {lang === 'ar' ? 'تطبيق' : 'Apply'}
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* Mobile Card-List vs Sticky-Column Table Switcher (< md) */}
            {allowMobileViewToggle && (
              <div
                role="group"
                aria-label={
                  lang === 'ar' ? 'طريقة عرض الجدول' : 'Mobile table view mode'
                }
                className="inline-flex rounded-button border border-border bg-bg-raised p-1 md:hidden"
              >
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    'inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-colors',
                    viewMode === 'cards'
                      ? 'bg-surface-2 text-gold-300 shadow-glow-gold'
                      : 'text-text-muted hover:text-ivory'
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>{cardsLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('scroll')}
                  className={cn(
                    'inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-colors',
                    viewMode === 'scroll'
                      ? 'bg-surface-2 text-gold-300 shadow-glow-gold'
                      : 'text-text-muted hover:text-ivory'
                  )}
                >
                  <Table2 className="h-3.5 w-3.5" />
                  <span>{tableLabel}</span>
                </button>
              </div>
            )}
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
        <>
          {/* Mobile Card List View (< md when viewMode === 'cards') */}
          {viewMode === 'cards' && (
            <div className="grid gap-3 md:hidden">
              {filteredAndSorted.map((row) => (
                <div
                  key={getRowKey(row)}
                  className="@container rounded-card border border-border bg-surface p-4 shadow-card-inner space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {titleCol.render(row)}
                    </div>
                    {badgeCol && (
                      <div className="shrink-0">{badgeCol.render(row)}</div>
                    )}
                  </div>

                  {metaColumns.length > 0 && (
                    <div className="grid grid-cols-1 gap-2.5 border-t border-border/80 pt-3 @xs:grid-cols-2">
                      {metaColumns.map((col) => (
                        <div key={col.key} className="min-w-0 space-y-1">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                            {col.header}
                          </div>
                          <div className="text-sm text-ivory">
                            {col.render(row)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Table View (always on md+, or on mobile when viewMode === 'scroll' with sticky first col) */}
          <div className={cn(viewMode === 'cards' ? 'hidden md:block' : 'block')}>
            <Table stickyFirstColumn={stickyFirstColumn}>
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
          </div>
        </>
      )}
    </div>
  );
}
