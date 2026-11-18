import React from 'react';
import { cn } from '@/lib/utils';
import { CrescentStar } from './CrescentStar';

export interface SectionHeadingProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: string;
  /** Full headline text */
  title: string;
  /**
   * The single most important keyword (or phrase) in `title` to receive
   * the signature gold-gradient fill per DESIGN.md §3.
   * If omitted, the last word of `title` is automatically highlighted.
   */
  goldKeyword?: string;
  subtitle?: string;
  align?: 'start' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  as?: 'h1' | 'h2' | 'h3';
}

const SIZE_STYLES = {
  sm: 'text-2xl md:text-3xl',
  md: 'text-3xl md:text-4xl',
  lg: 'text-4xl md:text-5xl',
  xl: 'text-4xl sm:text-5xl md:text-6xl',
};

export function SectionHeading({
  eyebrow,
  title,
  goldKeyword,
  subtitle,
  align = 'start',
  size = 'lg',
  as: HeadingTag = 'h2',
  className,
  ...props
}: SectionHeadingProps) {
  const renderHighlightedTitle = () => {
    const trimmed = title.trim();
    if (!trimmed) return null;

    if (goldKeyword && trimmed.includes(goldKeyword)) {
      const idx = trimmed.indexOf(goldKeyword);
      const before = trimmed.slice(0, idx);
      const match = trimmed.slice(idx, idx + goldKeyword.length);
      const after = trimmed.slice(idx + goldKeyword.length);

      return (
        <>
          {before}
          <span className="text-gold-gradient">{match}</span>
          {after}
        </>
      );
    }

    // Default: apply gold gradient to the last word
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return <span className="text-gold-gradient">{parts[0]}</span>;
    }
    const lastWord = parts.pop();
    return (
      <>
        {parts.join(' ')}{' '}
        <span className="text-gold-gradient">{lastWord}</span>
      </>
    );
  };

  return (
    <div
      className={cn(
        'space-y-3',
        align === 'center' ? 'text-center mx-auto max-w-3xl' : 'text-start',
        className
      )}
      {...props}
    >
      {eyebrow && (
        <div
          className={cn(
            'inline-flex items-center gap-2 rounded-pill border border-border-strong bg-surface/90 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-gold-300 shadow-card-inner',
            align === 'center' && 'mx-auto'
          )}
        >
          <CrescentStar size="sm" />
          <span>{eyebrow}</span>
          <span className="text-[10px] text-gold-500/70" aria-hidden="true">
            ♠
          </span>
        </div>
      )}

      <HeadingTag
        className={cn(
          'font-display font-bold text-ivory ltr:tracking-tight ltr:leading-[1.15] rtl:tracking-normal rtl:leading-[1.38]',
          SIZE_STYLES[size]
        )}
      >
        {renderHighlightedTitle()}
      </HeadingTag>

      {subtitle && (
        <p
          className={cn(
            'text-base md:text-lg text-text-muted leading-relaxed',
            align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-2xl'
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
