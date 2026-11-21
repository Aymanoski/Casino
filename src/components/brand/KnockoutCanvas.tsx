'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Crown,
  Hand,
  Map as MapIcon,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { Match, Player, Round } from '@/lib/schemas';
import { cn, formatNumber, localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BracketNode, type BracketPlayerSlot } from './BracketNode';

export type BracketRegionId =
  | 'final16'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'full';

export interface KnockoutCanvasProps {
  rounds: Round[];
  matches: Match[];
  playerMap: Map<string, Player>;
  totalsByMatch: Map<string, Record<string, number>>;
  highlightedPlayerId?: string;
  focusedMatchId?: string | null;
  useArabicIndicDigits?: boolean;
  onSelectMatch?: (match: Match) => void;
  className?: string;
}

const NODE_WIDTH = 264;
const COL_GAP = 56;
const BASE_CARD_HEIGHT = 158;
const FINAL_CARD_HEIGHT = 216;
const ROW_GAP = 16;
const CANVAS_PAD = 28;
const HEADER_BAND = 54;

function buildSlotsForMatch(
  match: Match,
  playerMap: Map<string, Player>,
  totals: Record<string, number>,
  lang: 'en' | 'ar'
): BracketPlayerSlot[] {
  const showScores =
    match.status === 'live' ||
    match.status === 'finished' ||
    match.status === 'needsTieBreak';
  const winnerId = match.result?.winnerId ?? match.winnerPlayerId;

  return match.participants.map((part, idx) => {
    if (part.isBye) {
      return {
        id: `bye-${match.id}-${idx}`,
        name: lang === 'ar' ? 'تأهل تلقائي (BYE)' : 'BYE',
        isBye: true,
        isPlaceholder: true,
      };
    }

    if (part.playerId) {
      const player = playerMap.get(part.playerId);
      if (player) {
        return {
          id: player.id,
          name: localizeText(lang, player.fullName, player.fullNameAr),
          nickname: localizeText(lang, player.nickname, player.nicknameAr),
          avatarSeed: player.avatarSeed,
          avatar: player.avatar,
          score: showScores ? (totals[player.id] ?? 0) : undefined,
          isWinner: match.status === 'finished' && winnerId === player.id,
          isAdvancing: match.status === 'finished' && winnerId === player.id,
          isHost: Boolean(part.guest || player.isGuest || player.isHost),
          isPlaceholder: false,
        };
      }
    }

    const label =
      lang === 'ar'
        ? part.placeholderLabelAr || `متأهل #${idx + 1} (قريباً)`
        : part.placeholderLabelEn || `Qualifier #${idx + 1} (TBD)`;

    return {
      id: `tbd-${match.id}-${idx}`,
      name: label,
      isPlaceholder: true,
      isHost: Boolean(part.guest),
    };
  });
}

interface PositionedNode {
  match: Match;
  roundIdx: number;
  colIdx: number;
  x: number;
  y: number;
  height: number;
  isByeMatch: boolean;
}

/**
 * KnockoutCanvas
 * Interactive 60fps zoomable + drag-to-pan single-elimination knockout canvas
 * with Region Focus pills (for 256-slot / 720-player scale), SVG elbow connectors,
 * clickable corner Minimap, and Marwan Serry's Golden Seat Grand Final node.
 */
export function KnockoutCanvas({
  rounds,
  matches,
  playerMap,
  totalsByMatch,
  highlightedPlayerId = '',
  focusedMatchId = null,
  useArabicIndicDigits = false,
  onSelectMatch,
  className,
}: KnockoutCanvasProps) {
  const { lang } = useI18n();
  const isRtl = lang === 'ar';

  const koRounds = useMemo(
    () =>
      [...rounds]
        .filter((r) => r.stage === 'knockout' || r.stage === 'final')
        .sort((a, b) => a.order - b.order),
    [rounds]
  );

  const matchesByRoundId = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const r of koRounds) {
      map.set(
        r.id,
        matches
          .filter((m) => !m.isDemo && m.roundId === r.id)
          .sort((a, b) => a.slot - b.slot)
      );
    }
    return map;
  }, [koRounds, matches]);

  const firstKoCount = koRounds[0]
    ? (matchesByRoundId.get(koRounds[0].id)?.length ?? 0)
    : 0;
  const isLargeTree = firstKoCount > 16;

  // Smart default region: for huge 256-slot trees, start on Final 16 -> Marwan (fast & readable!)
  // For <= 32-slot trees, show Full Bracket immediately.
  const [region, setRegion] = useState<BracketRegionId>(
    isLargeTree ? 'final16' : 'full'
  );
  const [zoom, setZoom] = useState<number>(isLargeTree ? 0.85 : 0.92);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);

  // Sync default region when tournament size changes (e.g. switching 720 <-> 12 preset)
  useEffect(() => {
    setRegion(isLargeTree ? 'final16' : 'full');
    setZoom(isLargeTree ? 0.85 : 0.92);
    setPan({ x: 0, y: 0 });
  }, [isLargeTree]);

  // Slice visible rounds + matches for the selected Region Focus so 256-slot brackets stay 60fps
  const visibleRounds = useMemo(() => {
    if (koRounds.length === 0) return [];

    if (!isLargeTree || region === 'full') {
      return koRounds.map((round) => ({
        round,
        matches: matchesByRoundId.get(round.id) ?? [],
      }));
    }

    if (region === 'final16') {
      // Keep Round of 16 (8 matches) -> QF (4) -> SF (2) -> Grand Final (1)
      const sliced = koRounds.filter((r) => {
        const list = matchesByRoundId.get(r.id) ?? [];
        return list.length <= 8 || r.stage === 'final';
      });
      return sliced.map((round) => ({
        round,
        matches: matchesByRoundId.get(round.id) ?? [],
      }));
    }

    // Quadrant focus (Q1..Q4): 1/4 of early rounds down to Quarter-Finals (1 match)
    const qIdx = region === 'q1' ? 0 : region === 'q2' ? 1 : region === 'q3' ? 2 : 3;
    const out: Array<{ round: Round; matches: Match[] }> = [];
    for (const r of koRounds) {
      const list = matchesByRoundId.get(r.id) ?? [];
      if (r.stage === 'final') continue;
      if (list.length < 4) continue; // stop at Quarter-Finals (4 matches -> 1 per quadrant)
      const sliceSize = Math.max(1, Math.floor(list.length / 4));
      const start = qIdx * sliceSize;
      out.push({
        round: r,
        matches: list.slice(start, start + sliceSize),
      });
    }
    return out;
  }, [koRounds, matchesByRoundId, isLargeTree, region]);

  // Compute deterministic geometric coordinates for every node & SVG connector
  const layout = useMemo(() => {
    if (visibleRounds.length === 0) {
      return {
        nodes: [] as PositionedNode[],
        connectors: [] as Array<{
          id: string;
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          active: boolean;
        }>,
        width: 800,
        height: 400,
      };
    }

    const colStep = NODE_WIDTH + COL_GAP;
    const colCount = visibleRounds.length;
    const totalWidth = CANVAS_PAD * 2 + colCount * NODE_WIDTH + Math.max(0, colCount - 1) * COL_GAP;

    const nodes: PositionedNode[] = [];
    const nodeByMatchId = new Map<string, PositionedNode>();
    let maxY = HEADER_BAND + BASE_CARD_HEIGHT + CANVAS_PAD;

    const firstColCount = Math.max(1, visibleRounds[0].matches.length);
    const basePitch = BASE_CARD_HEIGHT + ROW_GAP;

    visibleRounds.forEach((vr, colIdx) => {
      const visualCol = isRtl ? colCount - 1 - colIdx : colIdx;
      const x = CANVAS_PAD + visualCol * colStep;
      const count = Math.max(1, vr.matches.length);
      const isFinalCol = vr.round.stage === 'final';

      vr.matches.forEach((m, idx) => {
        const cardH = m.isFinal ? FINAL_CARD_HEIGHT : BASE_CARD_HEIGHT;
        let y: number;

        if (colIdx === 0) {
          y = CANVAS_PAD + HEADER_BAND + idx * basePitch;
        } else {
          // Center vertically between its two feeder matches in previous column when available
          const feederIds = m.participants
            .map((p) => (p.feeder?.kind === 'match' ? p.feeder.matchId : null))
            .filter((id): id is string => Boolean(id));
          const feederNodes = feederIds
            .map((id) => nodeByMatchId.get(id))
            .filter((n): n is PositionedNode => Boolean(n));

          if (feederNodes.length >= 2) {
            const topCenter = feederNodes[0].y + feederNodes[0].height / 2;
            const botCenter =
              feederNodes[feederNodes.length - 1].y +
              feederNodes[feederNodes.length - 1].height / 2;
            y = (topCenter + botCenter) / 2 - cardH / 2;
          } else if (feederNodes.length === 1) {
            y = feederNodes[0].y + feederNodes[0].height / 2 - cardH / 2;
          } else {
            const ratio = firstColCount / count;
            const spanCenter = (idx + 0.5) * ratio * basePitch;
            y = CANVAS_PAD + HEADER_BAND + spanCenter - cardH / 2;
          }
        }

        if (isFinalCol && y < CANVAS_PAD + HEADER_BAND) {
          y = CANVAS_PAD + HEADER_BAND;
        }

        const positioned: PositionedNode = {
          match: m,
          roundIdx: colIdx,
          colIdx: visualCol,
          x,
          y,
          height: cardH,
          isByeMatch: m.participants.some((p) => p.isBye),
        };
        nodes.push(positioned);
        nodeByMatchId.set(m.id, positioned);
        if (y + cardH + CANVAS_PAD > maxY) {
          maxY = y + cardH + CANVAS_PAD;
        }
      });
    });

    // Build SVG elbow connectors between visible feeder -> child nodes
    const connectors: Array<{
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      active: boolean;
    }> = [];

    for (const node of nodes) {
      for (const p of node.match.participants) {
        if (p.feeder?.kind !== 'match') continue;
        const src = nodeByMatchId.get(p.feeder.matchId);
        if (!src) continue;

        const x1 = isRtl ? src.x : src.x + NODE_WIDTH;
        const y1 = src.y + src.height / 2;
        const x2 = isRtl ? node.x + NODE_WIDTH : node.x;
        const y2 = node.y + node.height / 2;
        const active =
          src.match.status === 'finished' ||
          Boolean(
            highlightedPlayerId &&
              src.match.participants.some((sp) => sp.playerId === highlightedPlayerId)
          );

        connectors.push({
          id: `${src.match.id}->${node.match.id}`,
          x1,
          y1,
          x2,
          y2,
          active,
        });
      }
    }

    return {
      nodes,
      connectors,
      width: totalWidth,
      height: Math.max(420, maxY),
    };
  }, [visibleRounds, isRtl, highlightedPlayerId]);

  const centerOnNode = useCallback(
    (node: PositionedNode, targetZoom?: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const z = targetZoom ?? zoom;
      const rect = vp.getBoundingClientRect();
      const targetX = rect.width / 2 - (node.x + NODE_WIDTH / 2) * z;
      const targetY = rect.height / 2 - (node.y + node.height / 2) * z;
      setPan({ x: targetX, y: targetY });
    },
    [zoom]
  );

  // Auto-focus when focusedMatchId changes (e.g. "Jump to Match")
  useEffect(() => {
    if (!focusedMatchId) return;
    const found = layout.nodes.find((n) => n.match.id === focusedMatchId);
    if (found) {
      centerOnNode(found, Math.max(zoom, 0.85));
    } else if (region !== 'full') {
      // Match lives in another region — switch to full to reveal it!
      setRegion('full');
    }
  }, [focusedMatchId, layout.nodes, centerOnNode, zoom, region]);

  const handleFitView = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const fitX = (rect.width - 24) / layout.width;
    const fitY = (rect.height - 24) / layout.height;
    const nextZoom = Math.max(0.4, Math.min(1, Number(Math.min(fitX, fitY).toFixed(2))));
    setZoom(nextZoom);
    setPan({
      x: Math.max(0, (rect.width - layout.width * nextZoom) / 2),
      y: 8,
    });
  }, [layout.width, layout.height]);

  const handleJumpToFinal = useCallback(() => {
    if (isLargeTree && region !== 'final16' && region !== 'full') {
      setRegion('final16');
      return;
    }
    const finalNode = layout.nodes.find((n) => n.match.isFinal);
    if (finalNode) {
      setZoom(0.95);
      centerOnNode(finalNode, 0.95);
    }
  }, [isLargeTree, region, layout.nodes, centerOnNode]);

  // Pointer pan handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input, [role="button"]')) {
      return;
    }
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStartRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.pointerX;
    const dy = e.clientY - drag.pointerY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
    setPan({ x: drag.panX + dx, y: drag.panY + dy });
  };

  const handlePointerUp = () => {
    dragStartRef.current = null;
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((z) => Math.max(0.4, Math.min(1.4, Number((z + delta).toFixed(2)))));
  };

  const regionPills: Array<{ id: BracketRegionId; labelEn: string; labelAr: string }> =
    isLargeTree
      ? [
          { id: 'final16', labelEn: 'Final 16 → Marwan', labelAr: 'دور الـ 16 ← مروان' },
          { id: 'q1', labelEn: 'Quarter 1', labelAr: 'الربع 1' },
          { id: 'q2', labelEn: 'Quarter 2', labelAr: 'الربع 2' },
          { id: 'q3', labelEn: 'Quarter 3', labelAr: 'الربع 3' },
          { id: 'q4', labelEn: 'Quarter 4', labelAr: 'الربع 4' },
          { id: 'full', labelEn: `Full (${firstKoCount * 2}-Slot)`, labelAr: `الشجرة الكاملة (${firstKoCount * 2})` },
        ]
      : [];

  // Minimap geometry
  const mmW = 168;
  const mmH = 104;
  const mmScale = Math.min(mmW / Math.max(1, layout.width), mmH / Math.max(1, layout.height));

  return (
    <div className={cn('space-y-3', className)}>
      {/* Toolbar: Region Focus + Zoom + Fit + Jump to Final */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-card border border-border-paper bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-1.5">
          {regionPills.length > 0 ? (
            regionPills.map((pill) => {
              const active = region === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setRegion(pill.id);
                    setPan({ x: 0, y: 0 });
                    setZoom(pill.id === 'full' ? 0.55 : 0.85);
                  }}
                  className={cn(
                    'min-h-[44px] rounded-pill border-2 px-3 py-1.5 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                    active
                      ? 'border-outline bg-red-600 text-white shadow-sticker-sm'
                      : 'border-border-paper bg-paper text-red-900 hover:border-red-600/40'
                  )}
                >
                  {lang === 'ar' ? pill.labelAr : pill.labelEn}
                </button>
              );
            })
          ) : (
            <Badge variant="gold">
              {lang === 'ar'
                ? `شجرة الإقصائيات (${formatNumber(layout.nodes.length, { useArabicIndicDigits })} مباراة)`
                : `Knockout Tree (${formatNumber(layout.nodes.length, { useArabicIndicDigits })} matches)`}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleJumpToFinal}
            className="gap-1.5"
          >
            <Crown className="h-4 w-4 text-gold-600" aria-hidden="true" />
            <span>{lang === 'ar' ? 'النهائي مع مروان' : 'Grand Final'}</span>
          </Button>

          <div className="inline-flex items-center gap-0.5 rounded-button border-2 border-outline bg-white p-0.5 shadow-sticker-sm">
            <button
              type="button"
              disabled={zoom <= 0.4}
              onClick={() =>
                setZoom((z) => Math.max(0.4, Number((z - 0.12).toFixed(2))))
              }
              aria-label={lang === 'ar' ? 'تصغير الشجرة' : 'Zoom out bracket'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-ink hover:bg-paper-2 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
            >
              <ZoomOut className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(0.9);
                setPan({ x: 0, y: 0 });
              }}
              aria-label={lang === 'ar' ? 'إعادة ضبط التكبير' : 'Reset zoom'}
              className="inline-flex min-h-[44px] min-w-[50px] items-center justify-center rounded-[10px] px-1.5 text-xs font-extrabold tabular-nums text-red-900 hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              disabled={zoom >= 1.4}
              onClick={() =>
                setZoom((z) => Math.min(1.4, Number((z + 0.12).toFixed(2))))
              }
              aria-label={lang === 'ar' ? 'تكبير الشجرة' : 'Zoom in bracket'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-ink hover:bg-paper-2 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
            >
              <ZoomIn className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleFitView}
              aria-label={lang === 'ar' ? 'ملاءمة الشاشة' : 'Fit bracket to view'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-ink hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setShowMinimap((s) => !s)}
              aria-pressed={showMinimap}
              aria-label={lang === 'ar' ? 'إظهار/إخفاء الخريطة المصغّرة' : 'Toggle minimap'}
              className={cn(
                'inline-flex h-11 w-11 items-center justify-center rounded-[10px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500',
                showMinimap ? 'bg-blue-100 text-blue-800' : 'text-ink hover:bg-paper-2'
              )}
            >
              <MapIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Pan & Zoom Framed Canvas */}
      <div className="overflow-hidden rounded-card border-2 border-outline bg-paper-2/85 shadow-soft">
        {/* Non-overlapping Interaction Hint & Legend Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-paper bg-white/95 px-3.5 py-2 text-[11px] font-bold text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Hand className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" />
            <span>
              {lang === 'ar'
                ? 'اسحب للتحريك · Ctrl + عجلة للتكبير · اضغط أي بطاقة للتفاصيل'
                : 'Drag to pan · Ctrl + scroll to zoom · Click any match card for details'}
            </span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-3 tabular-nums">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-gold-500" aria-hidden="true" />
              <span>{lang === 'ar' ? 'النهائي مع مروان' : 'Grand Final'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />
              <span>{lang === 'ar' ? 'مباشر' : 'Live'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-gold-200 ring-1 ring-outline/40" aria-hidden="true" />
              <span>{lang === 'ar' ? 'تأهل تلقائي (BYE)' : 'BYE'}</span>
            </span>
          </span>
        </div>

        {/* Pan & Zoom Viewport */}
        <div
          ref={viewportRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          className={cn(
            'relative h-[min(70dvh,760px)] w-full overflow-hidden select-none',
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          )}
        >

        {/* Transformed Canvas Stage */}
        <div
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          className="relative will-change-transform"
        >
          {/* Round Column Headers */}
          {visibleRounds.map((vr, colIdx) => {
            const visualCol = isRtl ? visibleRounds.length - 1 - colIdx : colIdx;
            const x = CANVAS_PAD + visualCol * (NODE_WIDTH + COL_GAP);
            const isFinalRound = vr.round.stage === 'final';
            return (
              <div
                key={vr.round.id}
                style={{ left: x, top: CANVAS_PAD, width: NODE_WIDTH }}
                className={cn(
                  'absolute flex items-center justify-between gap-2 rounded-input border-2 px-3 py-2',
                  isFinalRound
                    ? 'border-outline bg-gold-gradient text-red-900 shadow-sticker-sm'
                    : 'border-border-paper bg-white text-red-900'
                )}
              >
                <span className="truncate font-display text-sm">
                  {localizeText(lang, vr.round.name.en, vr.round.name.ar)}
                </span>
                <span className="shrink-0 rounded-pill bg-paper-2 px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-red-900">
                  {formatNumber(vr.matches.length, { useArabicIndicDigits })}
                </span>
              </div>
            );
          })}

          {/* SVG Orthogonal Elbow Connectors */}
          <svg
            width={layout.width}
            height={layout.height}
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
          >
            {layout.connectors.map((c) => {
              const midX = (c.x1 + c.x2) / 2;
              const pathD = `M ${c.x1} ${c.y1} H ${midX} V ${c.y2} H ${c.x2}`;
              return (
                <path
                  key={c.id}
                  d={pathD}
                  fill="none"
                  stroke={c.active ? '#E8740C' : 'rgba(79, 7, 22, 0.25)'}
                  strokeWidth={c.active ? 3 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
          </svg>

          {/* Positioned Match Nodes */}
          {layout.nodes.map((node) => {
            const m = node.match;
            const totals = totalsByMatch.get(m.id) ?? {};
            const slots = buildSlotsForMatch(m, playerMap, totals, lang);
            const isFocused = focusedMatchId === m.id;
            const meta = node.isByeMatch
              ? lang === 'ar'
                ? 'تأهل تلقائي لأفضل متصدر'
                : 'Best group winner BYE'
              : lang === 'ar'
                ? `طاولة #${formatNumber(m.tableNumber, { useArabicIndicDigits })} · خانة #${formatNumber(m.slot, { useArabicIndicDigits })}`
                : `Table #${formatNumber(m.tableNumber, { useArabicIndicDigits })} · Slot #${formatNumber(m.slot, { useArabicIndicDigits })}`;

            return (
              <div
                key={m.id}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: NODE_WIDTH,
                }}
              >
                <BracketNode
                  tableName={localizeText(lang, m.tableName, m.tableNameAr)}
                  status={m.status}
                  isFinal={m.isFinal}
                  isByeMatch={node.isByeMatch}
                  compact={!m.isFinal}
                  players={slots}
                  activeBuzzPlayerId={m.activeBuzzPlayerId}
                  highlightedPlayerId={highlightedPlayerId}
                  metaLabel={meta}
                  useArabicIndicDigits={useArabicIndicDigits}
                  onSelect={onSelectMatch ? () => onSelectMatch(m) : undefined}
                  className={cn(
                    isFocused && 'ring-[4px] ring-blue-500 ring-offset-2 ring-offset-white'
                  )}
                />
              </div>
            );
          })}
        </div>

        {/* Clickable Corner Minimap */}
        {showMinimap && layout.nodes.length > 0 && (
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = (e.clientX - rect.left) / mmScale;
              const clickY = (e.clientY - rect.top) / mmScale;
              const vp = viewportRef.current;
              if (!vp) return;
              const vpRect = vp.getBoundingClientRect();
              setPan({
                x: vpRect.width / 2 - clickX * zoom,
                y: vpRect.height / 2 - clickY * zoom,
              });
            }}
            role="button"
            tabIndex={0}
            aria-label={lang === 'ar' ? 'الخريطة المصغّرة للشجرة — اضغط للانتقال' : 'Bracket minimap — click to pan'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleFitView();
              }
            }}
            style={{ width: mmW + 12, height: mmH + 12 }}
            className="absolute bottom-3 end-3 z-20 hidden sm:flex items-center justify-center rounded-input border-2 border-outline bg-white/95 p-1.5 shadow-sticker-sm cursor-crosshair focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
          >
            <svg width={mmW} height={mmH} className="overflow-visible">
              {layout.nodes.map((n) => {
                const isPath = Boolean(
                  highlightedPlayerId &&
                    n.match.participants.some((p) => p.playerId === highlightedPlayerId)
                );
                const fill = n.match.isFinal
                  ? '#FF9F1C'
                  : n.match.status === 'live'
                    ? '#C4163A'
                    : isPath
                      ? '#2F6BFF'
                      : n.isByeMatch
                        ? '#FFE899'
                        : 'rgba(79, 7, 22, 0.35)';
                return (
                  <rect
                    key={n.match.id}
                    x={n.x * mmScale}
                    y={n.y * mmScale}
                    width={Math.max(3, NODE_WIDTH * mmScale)}
                    height={Math.max(2, n.height * mmScale)}
                    rx={1}
                    fill={fill}
                  />
                );
              })}
            </svg>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
