'use client';

import { useEffect } from 'react';
import { commands } from '@/lib/commands';

type VideoDemoPreset = 'fresh' | 'main' | 'final';

declare global {
  interface Window {
    __casinoVideoDemo?: {
      loadState: (preset: VideoDemoPreset) => Promise<{
        preset: VideoDemoPreset;
        playersCount: number;
        groupsCount: number;
        matchesCount: number;
        violationsCount: number;
      }>;
      startMatch: (matchId: string, actorUserId?: string) => Promise<void>;
    };
  }
}

/**
 * Lightweight, zero-DOM demo bridge for deterministic Playwright video recording.
 * - Exposes `window.__casinoVideoDemo` delegating strictly through `/lib/commands`.
 * - Honors `?videoDemo=fresh|main|final` on initial navigation for one-URL clean state reset.
 */
export function VideoDemoBridge() {
  useEffect(() => {
    window.__casinoVideoDemo = {
      loadState: (preset: VideoDemoPreset) => commands.loadVideoDemoState(preset),
      startMatch: async (matchId: string, actorUserId = 'user-admin') => {
        await commands.startMatch({ matchId, actorUserId });
      },
    };

    try {
      const params = new URLSearchParams(window.location.search);
      const videoDemo = params.get('videoDemo');
      if (videoDemo === 'fresh' || videoDemo === 'main' || videoDemo === 'final') {
        void commands.loadVideoDemoState(videoDemo);
      }
    } catch {
      // ignore
    }

    return () => {
      delete window.__casinoVideoDemo;
    };
  }, []);

  return null;
}
