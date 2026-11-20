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
  XCircle,
} from 'lucide-react';
import { getDefaultRouteForRole, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import type { UserRole } from '@/lib/schemas';
import { cn, localizeText } from '@/lib/utils';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { SkipLink } from '@/components/layout/SkipLink';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PokerChipIcon } from '@/components/motifs/RamadanMotifs';
import { SectionHeading } from '@/components/brand/SectionHeading';
import { StageDivider, SunburstStage } from '@/components/brand/SunburstStage';

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
    canEn:
      'Full control: players, managers, bracket, segments, settings, audit log, results feed',
    canAr:
      'صلاحية شاملة: اللاعبون، المديرون، التصفيات، الفقرات، الإعدادات، سجل المراجعة والنتائج',
    cannotEn: 'No restrictions',
    cannotAr: 'بدون قيود',
  },
  scorer: {
    icon: Tablet,
    canEn:
      'View assigned games, run live scorer console, tap buzz, add/subtract points, undo last action',
    canAr:
      'عرض الطاولات المخصصة، تشغيل لوحة الحكم، تسجيل الجرس والنقاط، والتراجع عن آخر إجراء',
    cannotEn: 'Cannot edit bracket, players, settings, or other scorers’ games',
    cannotAr: 'لا يمكنه تعديل شجرة البطولة أو اللاعبين أو الإعدادات',
  },
  checkIn: {
    icon: UserCheck,
    canEn:
      'View today’s games and players, mark contestants as Checked-In or Absent at the gate',
    canAr:
      'عرض مباريات اليوم واللاعبين وتأكيد الحضور أو الغياب عند بوابة الاستوديو',
    cannotEn: 'Cannot change scores, bracket, or settings',
    cannotAr: 'لا يمكنه تغيير النقاط أو التصفيات أو الإعدادات',
  },
  content: {
    icon: FileEdit,
    canEn:
      'Edit schedule blurbs, announcements, sponsors, rules text, and segment descriptions',
    canAr: 'تعديل الإعلانات، القوانين، الرعاة، وأوصاف الفقرات',
    cannotEn: 'Cannot change scores, bracket, or players',
    cannotAr: 'لا يمكنه تغيير النقاط أو التصفيات أو اللاعبين',
  },
  player: {
    icon: Users,
    canEn:
      'View personal contestant profile, tournament stats, upcoming table, and score history',
    canAr: 'عرض الملف الشخصي والإحصائيات والمباراة القادمة وسجل النقاط',
    cannotEn: 'Cannot access admin or scorer consoles',
    cannotAr: 'لا يمكنه الدخول للوحات الإدارة أو التحكيم',
  },
};

export default function LoginPage() {
  const router = useRouter();
  const { lang, t } = useI18n();
  const { user, demoUsers, isLoading, loginAs, logout } = useAuth();

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
    <div className="theme-paper flex min-h-dvh flex-col bg-paper text-ink">
      <SkipLink />
      <PublicHeader />

      {/* Stage Hero Header */}
      <SunburstStage as="div" className="py-10 sm:py-14">
        <div className="mx-auto max-w-content-wide px-safe">
          <SectionHeading
            as="h1"
            size="xl"
            align="center"
            surface="stage"
            title={
              lang === 'ar'
                ? 'اختر دورك في بطولة كازينو الألعاب'
                : 'Select a Demo Role to Explore the Show'
            }
            goldKeyword={lang === 'ar' ? 'كازينو الألعاب' : 'Explore the Show'}
            subtitle={
              lang === 'ar'
                ? 'اختر أي حساب تجريبي أدناه لاختبار الصلاحيات المخصصة لكل مدير أو حكم أو لاعب.'
                : 'Switch effortlessly between Super Admin, Table Scorers, Check-In Staff, Content Manager, Contestants, or Public Visitor.'
            }
          />
        </div>
      </SunburstStage>
      <StageDivider variant="zigzag" from="stage" to="paper" />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-content-wide flex-1 px-safe py-8 sm:py-12 outline-none"
      >
        {/* Active Session Banner */}
        <Card
          appearance="sticker"
          className="mb-10 sm:mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white"
        >
          <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
            <PokerChipIcon
              className="shrink-0"
              tone="gold"
              label={user ? user.role.slice(0, 2).toUpperCase() : 'VS'}
            />
            <div className="min-w-0">
              <div className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink-muted">
                {lang === 'ar' ? 'الحساب النشط حالياً' : 'Currently Signed In As'}
              </div>
              <div className="truncate font-display text-fluid-xl text-red-900">
                {user
                  ? `${localizeText(lang, user.name, user.nameAr)} · ${t.roles[user.role]}`
                  : t.roles.visitor}
              </div>
            </div>
          </div>

          <div className="flex flex-col xs:flex-row flex-wrap items-stretch xs:items-center gap-2">
            {user && (
              <>
                <Button
                  variant="red"
                  size="sm"
                  onClick={() => router.push(getDefaultRouteForRole(user.role))}
                >
                  {lang === 'ar' ? 'الذهاب إلى لوحة الدور' : 'Open Role Workspace'}
                </Button>
                <Button variant="secondary" size="sm" onClick={logout}>
                  <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {lang === 'ar' ? 'التبديل لوضع الزائر العام' : 'Switch to Public Visitor'}
                  </span>
                </Button>
              </>
            )}
            {!user && (
              <Badge variant="muted" className="min-h-[44px] justify-center">
                <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'وضع المشاهد العام فقط' : 'Public Spectator Mode'}
                </span>
              </Badge>
            )}
          </div>
        </Card>

        {/* Role Groups (flat sections directly on Paper to avoid nested cards) */}
        {isLoading ? (
          <div className="space-y-8" aria-busy="true">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="space-y-4">
                <Skeleton className="h-14 w-72 max-w-full" />
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  <Skeleton className="h-36 w-full" />
                  <Skeleton className="h-36 w-full" />
                  <Skeleton className="h-36 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div className="space-y-10 sm:space-y-12">
          {rolesOrder.map((roleKey) => {
            const meta = ROLE_META[roleKey];
            const Icon = meta.icon;
            const accounts = demoUsers.filter((u) => u.role === roleKey);

            return (
              <section key={roleKey} className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-border-paper pb-4">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-button border-2 border-outline bg-gold-400 text-red-900 shadow-sticker-sm">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-fluid-xl text-red-900 [text-wrap:balance]">
                          {t.roles[roleKey]}
                        </h2>
                        <Badge variant="gold">{accounts.length}</Badge>
                      </div>
                      <p className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-positive-ink">
                        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{localizeText(lang, meta.canEn, meta.canAr)}</span>
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                        <XCircle className="h-3.5 w-3.5 shrink-0 text-negative" aria-hidden="true" />
                        <span>{localizeText(lang, meta.cannotEn, meta.cannotAr)}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4">
                  {accounts.map((acc) => {
                    const isSelected = user?.id === acc.id;
                    return (
                      <Card
                        key={acc.id}
                        appearance="calm"
                        className={cn(
                          'flex min-w-0 flex-col justify-between p-4 transition-[border-color,background-color,box-shadow]',
                          isSelected
                            ? 'border-2 border-blue-500 ring-2 ring-blue-500 bg-blue-100/50'
                            : 'hover:border-outline'
                        )}
                      >
                        <div className="mb-4 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-bold text-ink">
                              {localizeText(lang, acc.name, acc.nameAr)}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
                            )}
                          </div>
                          <div className="truncate text-xs font-bold text-red-700">
                            {localizeText(
                              lang,
                              acc.titleEn ?? t.roles[acc.role],
                              acc.titleAr
                            )}
                          </div>
                          <div className="truncate text-xs text-ink-muted font-mono">
                            {acc.email}
                          </div>
                        </div>

                        <Button
                          variant={isSelected ? 'info' : 'red'}
                          size="sm"
                          className="w-full"
                          onClick={() => handleSelectAccount(acc.id, true)}
                        >
                          {lang === 'ar'
                            ? 'دخول وفتح اللوحة'
                            : 'Sign In & Open'}
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
