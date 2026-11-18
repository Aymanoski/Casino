import React from 'react';
import { cn } from '@/lib/utils';
import { CrescentStar } from './CrescentStar';

export interface SectionHeadingProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: string;
  /** Full headline text */
  title: string;
  /**
   * Keyword or phrase highlighted:
   * - On Stage: glossy gold-to-orange gradient with maroon sticker outline
   * - On Paper: `--red-900` with gold highlighter marker underline
   */
  goldKeyword?: string;
  /** Highlight entire title on Stage as glossy gold sticker lettering */
  fullGold?: boolean;
  subtitle?: string;
  align?: 'start' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  surface?: 'stage' | 'paper';
  as?: 'h1' | 'h2' | 'h3';
}

const SIZE_STYLES = {
  sm: 'text-fluid-xl',
  md: 'text-fluid-2xl',
  lg: 'text-fluid-3xl',
  xl: 'text-fluid-hero',
};

/**
 * SectionHeading
 * Per DESIGN.md §3:
 * - English Display: Lilita One | Arabic Display: Lalezar
 * - Stage: chunky white + glossy gold-to-orange sticker-outlined headline
 * - Paper: deep maroon (--red-900) headline with gold-highlighted keyword
 */
export function SectionHeading({
  eyebrow,
  title,
  goldKeyword,
  fullGold = false,
  subtitle,
  align = 'start',
  size = 'lg',
  surface = 'paper',
  as: HeadingTag = 'h2',
  className,
  ...props
}: SectionHeadingProps) {
  const isStage = surface === 'stage';
  const highlightClass = isStage
    ? size === 'xl'
      ? 'text-gold-sticker-lg'
      : 'text-gold-sticker'
    : 'text-paper-highlight';

  const renderHighlightedTitle = () => {
    const trimmed = title.trim();
    if (!trimmed) return null;

    if (fullGold && isStage) {
      return <span className={highlightClass}>{trimmed}</span>;
    }

    if (goldKeyword && trimmed.includes(goldKeyword)) {
      const idx = trimmed.indexOf(goldKeyword);
      const before = trimmed.slice(0, idx);
      const match = trimmed.slice(idx, idx + goldKeyword.length);
      const after = trimmed.slice(idx + goldKeyword.length);

      return (
        <>
          {before}
          <span className={highlightClass}>{match}</span>
          {after}
        </>
      );
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return <span className={highlightClass}>{parts[0]}</span>;
    }
    const lastWord = parts.pop();
    return (
      <>
        {parts.join(' ')}{' '}
        <span className={highlightClass}>{lastWord}</span>
      </>
    );
  };

  return (
    <div
      className={cn(
        'min-w-0 space-y-3',
        align === 'center' ? 'mx-auto max-w-3xl text-center' : 'text-start',
        className
      )}
      {...props}
    >
      {eyebrow && (
        <div
          className={cn(
            'inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-pill border-2 border-outline px-3.5 py-1 text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal shadow-sticker-sm',
            isStage ? 'bg-white text-red-900' : 'bg-gold-300 text-red-900',
            align === 'center' && 'mx-auto'
          )}
        >
          <CrescentStar size="sm" />
          <span className="break-words">{eyebrow}</span>
          <span className="text-red-600" aria-hidden="true">
            ★
          </span>
        </div>
      )}

      <HeadingTag
        className={cn(
          'font-display break-words ltr:tracking-tight ltr:leading-[1.12] rtl:tracking-normal rtl:leading-[1.35]',
          isStage ? 'text-white [text-shadow:0_3px_0_#4F0716]' : 'text-red-900',
          SIZE_STYLES[size]
        )}
      >
        {renderHighlightedTitle()}
      </HeadingTag>

      {subtitle && (
        <p
          className={cn(
            'text-fluid-base leading-relaxed',
            isStage ? 'text-white/95' : 'text-ink-muted',
            align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-2xl'
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
