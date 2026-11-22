'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { User, UserRole } from '@/lib/schemas';
import {
  REOPEN_GAME_MANAGER_ROLES,
  SCORE_HISTORY_MANAGER_ROLES,
  userRepo,
} from '@/lib/repos';
import { realtime } from '@/lib/realtime';

const AUTH_STORAGE_KEY = 'casino_el_al3ab_auth_user_v1';
const TAB_ROLE_OVERRIDE_KEY = 'casino_el_al3ab_demo_tab_role_v1';

interface TabRoleOverride {
  role?: string;
  userId?: string;
  playerId?: string;
}

function readTabRoleOverride(): TabRoleOverride | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const qRole = params.get('demoRole');
    const qUserId = params.get('demoUserId');
    const qPlayerId = params.get('demoPlayerId');
    if (qRole || qUserId || qPlayerId) {
      const override: TabRoleOverride = {
        ...(qRole ? { role: qRole } : {}),
        ...(qUserId ? { userId: qUserId } : {}),
        ...(qPlayerId ? { playerId: qPlayerId } : {}),
      };
      window.sessionStorage.setItem(TAB_ROLE_OVERRIDE_KEY, JSON.stringify(override));
      return override;
    }
    const raw = window.sessionStorage.getItem(TAB_ROLE_OVERRIDE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TabRoleOverride;
  } catch {
    return null;
  }
}

function resolveUserFromTabOverride(
  override: TabRoleOverride,
  allUsers: User[]
): { resolved: boolean; user: User | null } {
  if (override.userId) {
    if (override.userId === 'visitor') return { resolved: true, user: null };
    const byId = allUsers.find((u) => u.id === override.userId) ?? null;
    if (byId) return { resolved: true, user: byId };
  }
  if (override.playerId) {
    const byPlayer = allUsers.find(
      (u) => u.role === 'player' && u.playerId === override.playerId
    );
    if (byPlayer) return { resolved: true, user: byPlayer };
  }
  if (override.role) {
    const r = override.role.toLowerCase();
    if (r === 'visitor' || r === 'fan' || r === 'public' || r === 'guest') {
      return { resolved: true, user: null };
    }
    if (r === 'admin' || r === 'superadmin') {
      const admin = allUsers.find((u) => u.role === 'superAdmin') ?? null;
      return { resolved: true, user: admin };
    }
    if (r === 'scorer' || r === 'judge') {
      const scorer = allUsers.find((u) => u.role === 'scorer') ?? null;
      return { resolved: true, user: scorer };
    }
    if (r === 'player' || r === 'contestant') {
      const player = allUsers.find((u) => u.role === 'player') ?? null;
      return { resolved: true, user: player };
    }
    if (r === 'checkin') {
      const ci = allUsers.find((u) => u.role === 'checkIn') ?? null;
      return { resolved: true, user: ci };
    }
    if (r === 'content') {
      const cm = allUsers.find((u) => u.role === 'content') ?? null;
      return { resolved: true, user: cm };
    }
  }
  return { resolved: false, user: null };
}

/**
 * Role Permission Matrix per AGENTS.md §4:
 * - superAdmin: Everything
 * - scorer: /scorer, /scorer/[gameId]
 * - checkIn: /admin, /admin/check-in, /admin/players (view)
 * - content: /admin, /admin/content, /admin/sponsors, /admin/segments
 * - player: /player, /player/history
 */
export function canAccessPath(role: UserRole | null, pathname: string): boolean {
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/scorer') && !pathname.startsWith('/player')) {
    return true;
  }

  if (!role) return false;
  if (role === 'superAdmin') return true;

  if (pathname.startsWith('/scorer')) {
    return role === 'scorer';
  }

  if (pathname.startsWith('/player')) {
    return role === 'player';
  }

  if (pathname.startsWith('/admin')) {
    if (role === 'checkIn') {
      return (
        pathname === '/admin' ||
        pathname.startsWith('/admin/check-in')
      );
    }
    if (role === 'content') {
      return (
        pathname === '/admin' ||
        pathname.startsWith('/admin/content') ||
        pathname.startsWith('/admin/sponsors') ||
        pathname.startsWith('/admin/segments')
      );
    }
    return false;
  }

  return false;
}

/**
 * Centralized Scoring History & Table Lifecycle Permissions
 * Re-exported from src/lib/repos/permissions.ts (single source of truth for UI + repo enforcement).
 */
export { SCORE_HISTORY_MANAGER_ROLES, REOPEN_GAME_MANAGER_ROLES };

export function canManageScoreHistory(role: UserRole | null): boolean {
  return Boolean(role && SCORE_HISTORY_MANAGER_ROLES.includes(role));
}

export function canReopenFinishedGame(role: UserRole | null): boolean {
  return Boolean(role && REOPEN_GAME_MANAGER_ROLES.includes(role));
}

export function canAccessScorerGame(
  user: User | null,
  gameScorerUserId: string
): boolean {
  if (!user) return false;
  if (user.role === 'superAdmin') return true;
  if (user.role === 'scorer') return user.id === gameScorerUserId;
  return false;
}

export function getDefaultRouteForRole(role: UserRole | null): string {
  switch (role) {
    case 'superAdmin':
      return '/admin';
    case 'scorer':
      return '/scorer';
    case 'checkIn':
      return '/admin/check-in';
    case 'content':
      return '/admin/content';
    case 'player':
      return '/player';
    default:
      return '/';
  }
}

interface AuthContextValue {
  user: User | null;
  demoUsers: User[];
  isLoading: boolean;
  loginAs: (userId: string) => Promise<User | null>;
  logout: () => void;
  canAccess: (pathname: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [demoUsers, setDemoUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadUsersAndSession = useCallback(async () => {
    const allUsers = await userRepo.list();
    setDemoUsers(allUsers);

    // Demo-only per-tab role override (stored in sessionStorage so multiple tabs in ONE
    // browser context can simultaneously operate as Admin, Scorer, Player, Big Screen, Fan).
    const tabOverride = readTabRoleOverride();
    if (tabOverride) {
      const { resolved, user: tabUser } = resolveUserFromTabOverride(tabOverride, allUsers);
      if (resolved) {
        setUser(tabUser);
        setIsLoading(false);
        return;
      }
    }

    let savedId: string | null = null;
    try {
      savedId = window.localStorage.getItem(AUTH_STORAGE_KEY);
    } catch {
      savedId = null;
    }

    // Default to Super Admin on first visit so presenter can explore everything immediately,
    // or restore saved user session
    const targetId = savedId || 'user-admin';
    if (targetId === 'visitor') {
      setUser(null);
    } else {
      const matched = allUsers.find((u) => u.id === targetId) ?? allUsers[0] ?? null;
      setUser(matched);
      if (matched && savedId && matched.id !== savedId) {
        try {
          window.localStorage.setItem(AUTH_STORAGE_KEY, matched.id);
        } catch {
          // ignore
        }
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadUsersAndSession();
    const unsubReset = realtime.subscribe('data.reset', () => {
      loadUsersAndSession();
    });
    const unsubUsers = realtime.subscribe('user.updated', () => {
      loadUsersAndSession();
    });
    return () => {
      unsubReset();
      unsubUsers();
    };
  }, [loadUsersAndSession]);

  const loginAs = useCallback(async (userId: string): Promise<User | null> => {
    const matched = await userRepo.get(userId);
    setUser(matched);
    try {
      const hasTabOverride = Boolean(window.sessionStorage.getItem(TAB_ROLE_OVERRIDE_KEY));
      if (hasTabOverride) {
        window.sessionStorage.setItem(
          TAB_ROLE_OVERRIDE_KEY,
          JSON.stringify({ userId: matched ? matched.id : 'visitor' })
        );
      } else if (matched) {
        window.localStorage.setItem(AUTH_STORAGE_KEY, matched.id);
      } else {
        window.localStorage.setItem(AUTH_STORAGE_KEY, 'visitor');
      }
    } catch {
      // ignore
    }
    return matched;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try {
      const hasTabOverride = Boolean(window.sessionStorage.getItem(TAB_ROLE_OVERRIDE_KEY));
      if (hasTabOverride) {
        window.sessionStorage.setItem(
          TAB_ROLE_OVERRIDE_KEY,
          JSON.stringify({ userId: 'visitor' })
        );
      } else {
        window.localStorage.setItem(AUTH_STORAGE_KEY, 'visitor');
      }
    } catch {
      // ignore
    }
  }, []);

  const canAccess = useCallback(
    (pathname: string) => canAccessPath(user?.role ?? null, pathname),
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      demoUsers,
      isLoading,
      loginAs,
      logout,
      canAccess,
    }),
    [user, demoUsers, isLoading, loginAs, logout, canAccess]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
