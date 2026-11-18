'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Clock,
  Globe,
  MonitorPlay,
  ShieldCheck,
  Tablet,
  Users,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeading, StageDivider, SunburstStage } from '@/components/brand';

export function FeaturesSection() {
  const { lang } = useI18n();

  const ledgerItems = [
    {
      id: 'roles',
      icon: Users,
      badgeEn: '5 DEMO ROLES',
      badgeAr: '٥ صلاحيات',
      badgeVariant: 'info' as const,
      titleEn: 'Role-Based Staff & Player Portals',
      titleAr: 'صلاحيات مخصصة للإدارة والحكام واللاعبين',
      descEn:
        'Super Admin, Table Scorers, Gate Check-In Staff, Content Managers, and Contestants each unlock only what their night role needs.',
      descAr:
        'لوحات مستقلة لمدير البطولة، وحكام الطاولات، وموظفي استقبال البوابة، ومحرر المحتوى، والمتسابقين.',
      href: '/login',
      linkEn: 'Try Role Switcher',
      linkAr: 'جرّب حسابات الأدوار',
    },
    {
      id: 'results',
      icon: Clock,
      badgeEn: 'NEWEST FIRST',
      badgeAr: 'بالترتيب الزمني',
      badgeVariant: 'gold' as const,
      titleEn: 'Chronological Results Feed + CSV',
      titleAr: 'سجل النتائج الزمني مع التصدير',
      descEn:
        'Every finished match and every + / − score event lands in exact chronological order with date, time, table, and scorer attribution.',
      descAr:
        'كل نتيجة مباراة وكل حركة نقاط تصل بالترتيب الزمني الدقيق مع التاريخ والوقت واسم الطاولة والحكم.',
      href: '/admin/results',
      linkEn: 'Inspect Results Feed',
      linkAr: 'معاينة سجل النتائج',
    },
    {
      id: 'audit',
      icon: ShieldCheck,
      badgeEn: 'BEFORE & AFTER',
      badgeAr: 'توثيق كامل',
      badgeVariant: 'positive' as const,
      titleEn: 'Tamper-Evident Admin Audit Log',
      titleAr: 'سجل مراجعة إداري غير قابل للتلاعب',
      descEn:
        'Full accountability across score overrides, compensating undos, bracket edits, and check-ins with before/after snapshots.',
      descAr:
        'توثيق شامل لكل تعديل أو تراجع أو تحديث في الجدول أو الصلاحيات مع تسجيل الحالة قبل التغيير وبعده.',
      href: '/admin/audit',
      linkEn: 'Open Audit Trail',
      linkAr: 'فتح سجل المراجعة',
    },
    {
      id: 'bilingual',
      icon: Globe,
      badgeEn: 'LTR + RTL',
      badgeAr: 'عربي وإنجليزي',
      badgeVariant: 'red' as const,
      titleEn: 'Bilingual Parity & Swappable Repos',
      titleAr: 'دعم كامل للعربية وواجهات جاهزة للربط',
      descEn:
        'Built RTL-first alongside English, with every read/write routed through clean async repositories ready for a production database.',
      descAr:
        'تصميم ثنائي اللغة يدعم العربية (RTL) من الأساس، مع فصل طبقة البيانات لتسهيل الربط بقاعدة بيانات حقيقية لاحقاً.',
      href: '/admin',
      linkEn: 'Open Admin Studio',
      linkAr: 'دخول لوحة الإدارة',
    },
  ];

  return (
    <div className="relative">
      <SunburstStage variant="stage" className="py-section-y">
        <div className="mx-auto max-w-content-wide px-safe space-y-10">
          <SectionHeading
            surface="stage"
            align="center"
            size="lg"
            title={
              lang === 'ar'
                ? 'منظومة متكاملة لإدارة ليلة البث'
                : 'Built to Run a Live Studio Night'
            }
            goldKeyword={lang === 'ar' ? 'ليلة البث' : 'Live Studio'}
            subtitle={
              lang === 'ar'
                ? 'ليست مجرد صفحة عرض—بل منصة تشغيل كاملة تجمع تحكم الطاولات والشاشات العملاقة وسجلات المتابعة.'
                : 'More than a pitch landing page—a complete event operations suite connecting table scorers, stage monitors, and tournament oversight.'
            }
          />

          <div className="grid items-stretch gap-6 lg:grid-cols-12">
            {/* Lead Highlight Card: Scorer Console + Synced Big Screen */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-6 rounded-card border-[3px] border-outline bg-white p-6 text-ink shadow-sticker-lg">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="red">
                    <Tablet className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'لوحة الحكم' : 'SCORER CONSOLE'}</span>
                  </Badge>
                  <Badge variant="gold">
                    <MonitorPlay className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'شاشة العرض' : 'BIG SCREEN'}</span>
                  </Badge>
                </div>

                <h3 className="font-display text-2xl sm:text-3xl text-red-900 leading-tight">
                  {lang === 'ar'
                    ? 'سرعة تحكيم بلا أخطاء وبث متزامن لحظياً'
                    : 'Zero-Mistake Scoring & Instant Venue Sync'}
                </h3>

                <p className="text-sm sm:text-base leading-relaxed text-ink-muted">
                  {lang === 'ar'
                    ? 'أزرار كبيرة مخصصة للجهاز اللوحي والهاتف، تسجيل فوري لأول ضغطة جرس، نقاط جاهزة ومخصصة مع تراجع فوري—تنعكس كلها مباشرة على شاشات الجمهور.'
                    : 'Oversized tablet & phone tap targets, one-tap buzzer lock, preset and custom point entries with instant compensating undo—broadcast straight to stage monitors.'}
                </p>

                <dl className="grid grid-cols-3 gap-2 border-y-2 border-border-paper py-3.5 text-center">
                  <div>
                    <dt className="text-[11px] font-bold uppercase text-ink-muted">
                      {lang === 'ar' ? 'أزرار الحكم' : 'TAP TARGETS'}
                    </dt>
                    <dd className="mt-1 font-score text-2xl font-black text-red-600 tabular-nums">
                      56px+
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase text-ink-muted">
                      {lang === 'ar' ? 'وضوح الشاشة' : 'LEGIBILITY'}
                    </dt>
                    <dd className="mt-1 font-score text-2xl font-black text-red-900 tabular-nums">
                      10m
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase text-ink-muted">
                      {lang === 'ar' ? 'فصل الطاولات' : 'TABLES'}
                    </dt>
                    <dd className="mt-1 font-score text-2xl font-black text-blue-600 tabular-nums">
                      Multi
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button variant="red" size="md" asChild>
                  <Link href="/scorer/game-11">
                    <Tablet className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'لوحة الحكم' : 'Scorer Console'}</span>
                  </Link>
                </Button>
                <Button variant="info" size="md" asChild>
                  <Link href="/screen/game-11">
                    <MonitorPlay className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{lang === 'ar' ? 'شاشة العرض' : 'Big Screen'}</span>
                  </Link>
                </Button>
              </div>
            </div>

            {/* Structured 4-Row Operations Ledger */}
            <div className="lg:col-span-7 flex flex-col divide-y-2 divide-border-paper overflow-hidden rounded-card border-[3px] border-outline bg-white text-ink shadow-sticker-lg">
              {ledgerItems.map((item) => {
                const RowIcon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 p-4 sm:p-5 sm:flex-row sm:items-center transition-colors hover:bg-paper"
                  >
                    <div className="flex min-w-0 items-start gap-3.5">
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-button border-2 border-outline bg-paper-2 text-red-900 shadow-sticker-sm">
                        <RowIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-lg sm:text-xl text-red-900">
                            {lang === 'ar' ? item.titleAr : item.titleEn}
                          </h3>
                          <Badge variant={item.badgeVariant} className="px-2.5 py-0.5 text-[11px]">
                            {lang === 'ar' ? item.badgeAr : item.badgeEn}
                          </Badge>
                        </div>
                        <p className="text-sm leading-relaxed text-ink-muted">
                          {lang === 'ar' ? item.descAr : item.descEn}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={item.href}
                      className="inline-flex min-h-[44px] shrink-0 items-center gap-1 self-start sm:self-center rounded-button px-2 text-xs sm:text-sm font-extrabold text-blue-600 underline underline-offset-4 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500"
                    >
                      <span>{lang === 'ar' ? item.linkAr : item.linkEn}</span>
                      <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SunburstStage>

      <StageDivider variant="angled" from="stage" to="paper" />
    </div>
  );
}
