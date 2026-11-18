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
import { userRepo } from '@/lib/repos';
import { realtime } from '@/lib/realtime';

const AUTH_STORAGE_KEY = 'casino_el_al3ab_auth_user_v1';

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
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadUsersAndSession();
    const unsub = realtime.subscribe('data.reset', () => {
      loadUsersAndSession();
    });
    return unsub;
  }, [loadUsersAndSession]);

  const loginAs = useCallback(async (userId: string): Promise<User | null> => {
    const matched = await userRepo.get(userId);
    setUser(matched);
    try {
      if (matched) {
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
      window.localStorage.setItem(AUTH_STORAGE_KEY, 'visitor');
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
