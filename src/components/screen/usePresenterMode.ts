'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const IDLE_HIDE_MS = 2200;

export interface PresenterModeState {
  isPresenterMode: boolean;
  isFullscreen: boolean;
  cursorHidden: boolean;
  controlsVisible: boolean;
  enterPresenterMode: () => Promise<void>;
  exitPresenterMode: () => Promise<void>;
  togglePresenterMode: () => Promise<void>;
  revealControlsTemporarily: () => void;
}

/**
 * Manages Broadcast Presenter Mode:
 * - Requests browser Fullscreen API (gracefully degrades to chromeless mode if blocked)
 * - Hides mouse cursor & floating control pill after 2.2s of inactivity
 * - Restores controls immediately on mouse movement, touch, or key press
 * - Supports keyboard shortcut `F` to toggle and `Escape` to exit
 */
export function usePresenterMode(): PresenterModeState {
  const [isPresenterMode, setIsPresenterMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const armIdleTimer = useCallback(() => {
    clearIdleTimer();
    setIsIdle(false);
    idleTimerRef.current = window.setTimeout(() => {
      setIsIdle(true);
    }, IDLE_HIDE_MS);
  }, [clearIdleTimer]);

  const enterPresenterMode = useCallback(async () => {
    setIsPresenterMode(true);
    armIdleTimer();
    if (typeof document !== 'undefined') {
      const el = document.documentElement;
      if (!document.fullscreenElement && typeof el.requestFullscreen === 'function') {
        try {
          await el.requestFullscreen();
        } catch {
          // Graceful fallback: chromeless & cursor-hiding still remain active
        }
      }
    }
  }, [armIdleTimer]);

  const exitPresenterMode = useCallback(async () => {
    clearIdleTimer();
    setIsIdle(false);
    setIsPresenterMode(false);
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Ignore exit errors
      }
    }
  }, [clearIdleTimer]);

  const togglePresenterMode = useCallback(async () => {
    if (isPresenterMode) {
      await exitPresenterMode();
    } else {
      await enterPresenterMode();
    }
  }, [isPresenterMode, enterPresenterMode, exitPresenterMode]);

  const revealControlsTemporarily = useCallback(() => {
    if (isPresenterMode) {
      armIdleTimer();
    }
  }, [isPresenterMode, armIdleTimer]);

  // Keep state synced with browser fullscreenchange (e.g. user presses Esc)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onFsChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) {
        // When exiting native fullscreen via browser Esc, exit Presenter Mode cleanly
        setIsPresenterMode((prev) => {
          if (prev) {
            clearIdleTimer();
            setIsIdle(false);
          }
          return false;
        });
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [clearIdleTimer]);

  // Activity listeners while Presenter Mode is active
  useEffect(() => {
    if (!isPresenterMode) {
      clearIdleTimer();
      setIsIdle(false);
      return;
    }

    armIdleTimer();
    const onActivity = () => armIdleTimer();

    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('touchstart', onActivity, { passive: true });

    return () => {
      clearIdleTimer();
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('touchstart', onActivity);
    };
  }, [isPresenterMode, armIdleTimer, clearIdleTimer]);

  // Keyboard shortcuts: F to toggle, Escape to exit when not in native fullscreen
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isInput) return;

      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        void togglePresenterMode();
      } else if (e.key === 'Escape' && isPresenterMode) {
        void exitPresenterMode();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPresenterMode, togglePresenterMode, exitPresenterMode]);

  return {
    isPresenterMode,
    isFullscreen,
    cursorHidden: isPresenterMode && isIdle,
    controlsVisible: !isPresenterMode || !isIdle,
    enterPresenterMode,
    exitPresenterMode,
    togglePresenterMode,
    revealControlsTemporarily,
  };
}
