'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Eye,
  FileEdit,
  LogOut,
  ShieldCheck,
  Tablet,
  UserCheck,
  Users,
} from 'lucide-react';
import { getDefaultRouteForRole, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { UserRole } from '@/lib/schemas';
import { cn, localizeText } from '@/lib/utils';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CrescentStarIcon,
  PokerChipIcon,
} from '@/components/motifs/RamadanMotifs';

const ROLE_META: Record<
  UserRole,
  {
    icon: React.ComponentType<{ className?: string }>;
    canEn: string;
    canAr: string;
    cannotEn: string;
    cannotAr: string;
  }
> = {
  superAdmin: {
    icon: ShieldCheck,
    canEn: 'Full control: players, managers, bracket, segments, settings, audit log, results feed',
    canAr: 'صلاحية شاملة: اللاعبون، المديرون، التصفيات، الفقرات، الإعدادات، سجل المراجعة والنتائج',
    cannotEn: 'No restrictions',
    cannotAr: 'بدون قيود',
  },
  scorer: {
    icon: Tablet,
    canEn: 'View assigned games, run live scorer console, tap buzz, add/subtract points, undo last action',
    canAr: 'عرض الطاولات المخصصة، تشغيل لوحة الحكم، تسجيل الجرس والنقاط، والتراجع عن آخر إجراء',
    cannotEn: 'Cannot edit bracket, players, settings, or other scorers’ games',
    cannotAr: 'لا يمكنه تعديل شجرة البطولة أو اللاعبين أو الإعدادات',
  },
  checkIn: {
    icon: UserCheck,
    canEn: 'View today’s games and players, mark contestants as Checked-In or Absent at the gate',
    canAr: 'عرض مباريات اليوم واللاعبين وتأكيد الحضور أو الغياب عند بوابة الاستوديو',
    cannotEn: 'Cannot change scores, bracket, or settings',
    cannotAr: 'لا يمكنه تغيير النقاط أو التصفيات أو الإعدادات',
  },
  content: {
    icon: FileEdit,
    canEn: 'Edit schedule blurbs, announcements, sponsors, rules text, and segment descriptions',
    canAr: 'تعديل الإعلانات، القوانين، الرعاة، وأوصاف الفقرات',
    cannotEn: 'Cannot change scores, bracket, or players',
    cannotAr: 'لا يمكنه تغيير النقاط أو التصفيات أو اللاعبين',
  },
  player: {
    icon: Users,
    canEn: 'View personal contestant profile, tournament stats, upcoming table, and score history',
    canAr: 'عرض الملف الشخصي والإحصائيات والمباراة القادمة وسجل النقاط',
    cannotEn: 'Cannot access admin or scorer consoles',
    cannotAr: 'لا يمكنه الدخول للوحات الإدارة أو التحكيم',
  },
};

export default function LoginPage() {
  const router = useRouter();
  const { lang, t } = useI18n();
  const { user, demoUsers, loginAs, logout } = useAuth();

  const handleSelectAccount = async (userId: string, redirect: boolean) => {
    const logged = await loginAs(userId);
    if (redirect && logged) {
      router.push(getDefaultRouteForRole(logged.role));
    }
  };

  const rolesOrder: UserRole[] = [
    'superAdmin',
    'scorer',
    'checkIn',
    'content',
    'player',
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-night-gradient">
      <PublicHeader />

      <main className="mx-auto w-full max-w-content-wide flex-1 px-safe py-8 sm:py-12 md:py-16">
        <div className="mx-auto mb-8 sm:mb-12 max-w-3xl space-y-4 text-center">
          <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-pill border border-border-strong bg-surface px-3.5 sm:px-4 py-1.5 text-xs font-semibold text-gold-300">
            <CrescentStarIcon className="h-4 w-4 shrink-0" />
            <span>
              {lang === 'ar'
                ? 'نظام الدخول التجريبي وتبديل الصلاحيات'
                : 'Mock Role-Based Authentication & Demo Account Picker'}
            </span>
          </div>
          <h1 className="font-display text-fluid-4xl font-bold text-gold-gradient ltr:leading-[1.12] rtl:leading-[1.35]">
            {lang === 'ar'
              ? 'اختر دورك في بطولة كازينو الألعاب'
              : 'Select a Demo Role to Explore the Platform'}
          </h1>
          <p className="text-fluid-base text-text-muted">
            {lang === 'ar'
              ? 'اختر أي حساب تجريبي أدناه لاختبار الصلاحيات المخصصة لكل مدير أو حكم أو لاعب، تماماً كما ستعمل في النسخة الإنتاجية.'
              : 'Switch effortlessly between Super Admin, Table Scorers, Check-In Staff, Content Manager, Contestants, or Public Visitor.'}
          </p>
        </div>

        {/* Active Session Banner */}
        <Card
          premium
          className="mb-8 sm:mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
            <PokerChipIcon
              className="shrink-0"
              label={user ? user.role.slice(0, 2).toUpperCase() : 'VS'}
            />
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-text-muted">
                {lang === 'ar' ? 'الحساب النشط حالياً' : 'Currently Signed In As'}
              </div>
              <div className="truncate font-display text-fluid-xl font-bold text-ivory">
                {user
                  ? `${localizeText(lang, user.name, user.nameAr)} — ${t.roles[user.role]}`
                  : t.roles.visitor}
              </div>
            </div>
          </div>

          <div className="flex flex-col xs:flex-row flex-wrap items-stretch xs:items-center gap-2">
            {user && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push(getDefaultRouteForRole(user.role))}
                >
                  {lang === 'ar' ? 'الذهاب إلى لوحة الدور' : 'Open Role Workspace'}
                </Button>
                <Button variant="secondary" size="sm" onClick={logout}>
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>
                    {lang === 'ar' ? 'التبديل لوضع الزائر العام' : 'Switch to Public Visitor'}
                  </span>
                </Button>
              </>
            )}
            {!user && (
              <Badge variant="muted" className="min-h-[44px] justify-center">
                <Eye className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {lang === 'ar' ? 'وضع المشاهد العام فقط' : 'Public Spectator Mode'}
                </span>
              </Badge>
            )}
          </div>
        </Card>

        {/* Role Groups */}
        <div className="space-y-6 sm:space-y-8">
          {rolesOrder.map((roleKey) => {
            const meta = ROLE_META[roleKey];
            const Icon = meta.icon;
            const accounts = demoUsers.filter((u) => u.role === roleKey);

            return (
              <Card key={roleKey} className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button border border-border-strong bg-surface-2 text-gold-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-fluid-xl font-bold text-ivory">
                          {t.roles[roleKey]}
                        </h2>
                        <Badge variant="gold">{accounts.length}</Badge>
                      </div>
                      <p className="text-xs sm:text-sm text-positive">
                        ✓ {localizeText(lang, meta.canEn, meta.canAr)}
                      </p>
                      <p className="text-xs text-text-faint">
                        ✕ {localizeText(lang, meta.cannotEn, meta.cannotAr)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4">
                  {accounts.map((acc) => {
                    const isSelected = user?.id === acc.id;
                    return (
                      <div
                        key={acc.id}
                        className={cn(
                          'flex min-w-0 flex-col justify-between rounded-input border p-4 transition-all',
                          isSelected
                            ? 'border-gold-500 bg-gold-500/15 shadow-glow-gold'
                            : 'border-border bg-surface-2 hover:border-border-strong'
                        )}
                      >
                        <div className="mb-4 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-semibold text-ivory">
                              {localizeText(lang, acc.name, acc.nameAr)}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-gold-300 shrink-0" />
                            )}
                          </div>
                          <div className="truncate text-xs text-gold-300">
                            {localizeText(
                              lang,
                              acc.titleEn ?? t.roles[acc.role],
                              acc.titleAr
                            )}
                          </div>
                          <div className="truncate text-[11px] text-text-faint font-mono">
                            {acc.email}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant={isSelected ? 'secondary' : 'primary'}
                            size="sm"
                            className="w-full"
                            onClick={() => handleSelectAccount(acc.id, true)}
                          >
                            {lang === 'ar'
                              ? 'دخول وفتح اللوحة'
                              : 'Sign In & Open'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
