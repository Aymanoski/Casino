'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Cpu,
  Lock,
  Play,
  Server,
  ShieldCheck,
  Shuffle,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SunburstStage, StageDivider } from '@/components/brand/SunburstStage';
import { QuizDemoBanner } from './QuizDemoBanner';

/**
 * One-page plain-language pitch explainer (/quiz/how-it-works — AGENTS.md §16.2).
 * Explains clearly how the REAL production version works vs. this browser demo.
 */
export function QuizHowItWorksView() {
  const { lang } = useI18n();
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  const pillars = [
    {
      icon: Clock,
      titleEn: '1. Server-Side Timing & Deadlines',
      titleAr: '١. توقيت صارم على الخادم (Server-Side)',
      bodyEn:
        'When the server delivers question #k, it stamps the exact UTC deadline (start + 10s). Even if a user pauses JavaScript, changes their phone clock, or refreshes the page, any answer arriving past the server deadline is automatically rejected and scored as a 10.0s timeout.',
      bodyAr:
        'عند إرسال كل سؤال، يختم الخادم لحظة البدء والموعد النهائي الدقيق (+١٠ ثوانٍ). حتى لو غيّر المتسابق ساعة هاتفه أو أعاد تحميل الصفحة، أي إجابة تصل بعد الموعد الرسمي تُرفض تلقائياً وتُسجّل انتهاء وقت (١٠ ثوانٍ كاملة).',
    },
    {
      icon: Shuffle,
      titleEn: '2. Per-Applicant Seeded Randomization',
      titleAr: '٢. عشوائية خاصة بكل متقدم عبر بذرة محفوظة',
      bodyEn:
        'Each verified attempt receives a cryptographic shuffle seed that selects 20 unique questions from the approved bank and permutes the 4 answer slots per question. Two friends sitting side-by-side never see the same questions in the same order or the same option positions.',
      bodyAr:
        'يحصل كل متقدم على بذرة عشوائية فريدة تسحب ٢٠ سؤالاً مختلفاً من بنك الأسئلة المعتمد وتُعيد ترتيب الخيارات الأربعة لكل سؤال، مما يمنع تطابق الأسئلة أو ترتيب الإجابات بين المتسابقين.',
    },
    {
      icon: UserCheck,
      titleEn: '3. One Attempt per Verified Person',
      titleAr: '٣. محاولة واحدة فقط لكل شخص موثّق',
      bodyEn:
        'Applicants verify ownership of a real mobile number (WhatsApp Business API or SMS OTP) and email. Database unique indexes lock one active attempt per normalized phone/email. Only a Super Admin can append an audited Reset event to grant a retake.',
      bodyAr:
        'يتحقق النظام من رقم الهاتف الحقيقي (واتساب أو SMS) والبريد الإلكتروني مع قيود فريدة في قاعدة البيانات تضمن محاولة واحدة لكل شخص. وحده مدير البطولة يمكنه إعادة فتح المحاولة مع تسجيل السبب في سجل المراجعة.',
    },
    {
      icon: Lock,
      titleEn: '4. Zero Answer Leakage to the Browser',
      titleAr: '٤. الأسئلة تُصحّح على الخادم فقط دون تسريب الإجابات',
      bodyEn:
        'In production, questions are fetched one at a time via authenticated API and correctOptionIndex NEVER leaves the server. Inspecting browser DevTools or network traffic reveals zero answers.',
      bodyAr:
        'في النسخة الفعلية يُرسل الخادم سؤالاً واحداً في كل مرة ولا يرسل الإجابة الصحيحة للمتصفح إطلاقاً، بحيث لا يمكن استخراج أي إجابة حتى عبر أدوات المطورين.',
    },
    {
      icon: Trophy,
      titleEn: '5. Deterministic Ranking & Dynamic Cutoff',
      titleAr: '٥. تصنيف عادل وخط تأهل مرتبط بحجم البطولة',
      bodyEn:
        'Scores and response times are derived purely from the append-only attempt event log. Ranking sorts strictly by score descending, total response time ascending, then earliest submission. Top N (synced with tournament totalPlayers, default 720) qualify automatically.',
      bodyAr:
        'تُشتق الدرجات والأزمنة مباشرة من سجل الأحداث غير القابل للتعديل. يتم الترتيب حسب أعلى درجة ثم أقل زمن إجمالي ثم الأسبقية في التسليم، ويتأهل أعلى ٧٢٠ متسابقاً (متزامن مع إعدادات البطولة).',
    },
    {
      icon: Users,
      titleEn: '6. One-Click Idempotent Handoff & Burst Scale',
      titleAr: '٦. ترحيل تلقائي للبطولة وتحمّل الضغط العالي',
      bodyEn:
        'Once the window closes, Super Admin previews the exact Impact Preview (new players, duplicates, conflicts) and hands off all 720 qualified applicants straight into the Tournament Player Roster with contacts and avatars. Rate limiting and Redis-backed queues handle thousands of simultaneous launches smoothly.',
      bodyAr:
        'بعد إغلاق الاختبار يعاين مدير البطولة تقرير الأثر (لاعبون جدد، تكرارات، تعارضات) ثم يرحّل المتأهلين بضغطة واحدة لقائمة لاعبي البطولة دون أي تكرار، مع بنية تتحمل آلاف المتقدمين في نفس اللحظة.',
    },
  ];

  const comparisonRows = [
    {
      areaEn: 'Question delivery & answer key',
      areaAr: 'تسليم الأسئلة ومفتاح الإجابة',
      demoEn: 'Local IndexedDB bank behind async quizRepo (answer key hidden from UI)',
      demoAr: 'بنك محلي في IndexedDB عبر quizRepo (الإجابة مخفية عن الواجهة)',
      prodEn: 'One question per API call; answer key stays strictly on server',
      prodAr: 'سؤال واحد لكل طلب API؛ مفتاح الإجابة لا يغادر الخادم أبداً',
    },
    {
      areaEn: '10-second countdown enforcement',
      areaAr: 'فرض مؤقت الـ ١٠ ثوانٍ',
      demoEn: 'Browser wall-clock deadlines stored in IndexedDB (refresh-safe)',
      demoAr: 'مواعيد نهائية محفوظة في المتصفح (لا تُعاد عند التحديث)',
      prodEn: 'Authoritative UTC server clock rejects late submissions at API layer',
      prodAr: 'ساعة خادم موثوقة ترفض أي إجابة بعد انقضاء الـ ١٠ ثوانٍ',
    },
    {
      areaEn: 'Phone / WhatsApp / Email OTP',
      areaAr: 'التحقق عبر واتساب / SMS / بريد',
      demoEn: 'Mock OTP step with visible test code (123456)',
      demoAr: 'خطوة تحقق تجريبية برمز ظاهر (123456)',
      prodEn: 'Real WhatsApp Business / Twilio SMS / email OTP + rate limiting',
      prodAr: 'إرسال حقيقي عبر واتساب للأعمال أو SMS مع حماية من الإساءة',
    },
    {
      areaEn: 'Integrity / anti-cheat signals',
      areaAr: 'إشارات النزاهة ومكافحة الغش',
      demoEn: 'Real browser events (tab switch, refresh, copy) labeled "Client-side signals"',
      demoAr: 'أحداث متصفح حقيقية (تبديل تبويب، تحديث، نسخ) موسومة بوضوح كإشارات متصفح',
      prodEn: 'Combined client signals + IP/device fingerprinting + anomaly detection',
      prodAr: 'دمج إشارات المتصفح مع فحص الخادم وتحديد المحاولات غير الطبيعية',
    },
    {
      areaEn: 'Screens & UX code',
      areaAr: 'الشاشات وواجهة المستخدم',
      demoEn: '100% production UI, RTL/LTR, commands, engine & repo interfaces',
      demoAr: 'واجهات كاملة جاهزة بالعربية والإنجليزية مع نفس طبقة المستودعات',
      prodEn: 'Zero screen rewrites — swap quizRepo adapter to live API endpoints',
      prodAr: 'صفر إعادة كتابة للشاشات — استبدال quizRepo بالـ API الفعلي فقط',
    },
  ];

  return (
    <div className="flex flex-col">
      <SunburstStage className="py-10 sm:py-14">
        <div className="mx-auto max-w-3xl px-4 text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-pill border-2 border-outline bg-white px-4 py-1 text-xs font-black text-red-900 shadow-sticker-sm">
            <Server className="h-4 w-4 text-red-600" aria-hidden="true" />
            <span>
              {lang === 'ar'
                ? 'شرح للعرض التقديمي · البنية الحقيقية مقابل النموذج التجريبي'
                : 'PITCH EXPLAINER · PRODUCTION ARCHITECTURE'}
            </span>
          </div>

          <h1 className="font-display text-fluid-hero leading-tight text-gold-sticker-lg">
            {lang === 'ar'
              ? 'كيف يعمل نظام الاختبار الحقيقي؟'
              : 'How the Real Quiz System Works'}
          </h1>

          <p className="mx-auto max-w-[60ch] text-base sm:text-lg font-semibold leading-relaxed text-white/95">
            {lang === 'ar'
              ? 'صُمّم هذا النموذج الأمامي بنفس الشاشات والمحرك المنطقي تماماً لتجربة الفكرة كاملة، وعند الإطلاق الفعلي يُستبدل التخزين المحلي بخادم مؤمّن دون إعادة بناء أي شاشة.'
              : 'This frontend demo runs the exact same UI, deterministic engine, and repository contracts as the final product — when the backend plugs in, zero screens need to be rewritten.'}
          </p>
        </div>
      </SunburstStage>

      <StageDivider variant="angled" from="stage" to="paper" />

      <section className="theme-paper bg-paper py-10 sm:py-14">
        <div className="mx-auto max-w-content space-y-10 px-4 sm:px-6">
          <QuizDemoBanner surface="paper" showHowItWorksLink={false} />

          {/* 6 Pillars Grid (inline icon + heading, avoiding stacked icon-tile template) */}
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {pillars.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.titleEn}
                  className="rounded-card border-[2.5px] border-outline bg-white p-5 shadow-sticker flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <Icon
                      className="mt-0.5 h-6 w-6 shrink-0 text-red-600"
                      aria-hidden="true"
                    />
                    <h2 className="text-lg font-black leading-snug text-red-900">
                      {lang === 'ar' ? item.titleAr : item.titleEn}
                    </h2>
                  </div>
                  <p className="text-sm leading-relaxed text-ink-muted">
                    {lang === 'ar' ? item.bodyAr : item.bodyEn}
                  </p>
                </article>
              );
            })}
          </div>

          {/* Demo vs Production Comparison */}
          <div className="rounded-card border-[2.5px] border-outline bg-white p-5 sm:p-6 shadow-sticker space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-red-600" aria-hidden="true" />
                <h2 className="font-display text-2xl text-red-900">
                  {lang === 'ar'
                    ? 'الفرق الواضح: العرض التجريبي اليوم مقابل الإنتاج الفعلي'
                    : 'Honest Comparison: Browser Demo vs. Production'}
                </h2>
              </div>
              <Badge variant="gold">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{lang === 'ar' ? 'شفافية كاملة' : 'Full Transparency'}</span>
              </Badge>
            </div>

            {/* Mobile stacked rows separated by hairlines (< md — zero nested cards) */}
            <div className="divide-y divide-border-paper md:hidden">
              {comparisonRows.map((row) => (
                <div
                  key={row.areaEn}
                  className="py-3.5 first:pt-1 last:pb-1 space-y-1.5 text-sm"
                >
                  <div className="font-black text-red-900">
                    {lang === 'ar' ? row.areaAr : row.areaEn}
                  </div>
                  <div className="text-xs text-ink-muted">
                    <strong className="text-ink">
                      {lang === 'ar' ? 'النموذج التجريبي: ' : 'Demo Today: '}
                    </strong>
                    {lang === 'ar' ? row.demoAr : row.demoEn}
                  </div>
                  <div className="text-xs text-positive-ink">
                    <strong>
                      {lang === 'ar' ? 'الإنتاج الفعلي: ' : 'Production: '}
                    </strong>
                    {lang === 'ar' ? row.prodAr : row.prodEn}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table (md+) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-start text-sm">
                <thead>
                  <tr className="border-b-2 border-outline bg-paper text-red-900">
                    <th className="p-3 font-black text-start">
                      {lang === 'ar' ? 'العنصر' : 'Capability'}
                    </th>
                    <th className="p-3 font-black text-start">
                      {lang === 'ar' ? 'العرض التجريبي اليوم (المتصفح)' : 'This Browser Demo'}
                    </th>
                    <th className="p-3 font-black text-start">
                      {lang === 'ar' ? 'النسخة الفعلية (الخادم)' : 'Production Server Version'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr
                      key={row.areaEn}
                      className={i % 2 === 1 ? 'bg-paper/60' : 'bg-white'}
                    >
                      <td className="border-b border-border-paper p-3 font-extrabold text-red-900">
                        {lang === 'ar' ? row.areaAr : row.areaEn}
                      </td>
                      <td className="border-b border-border-paper p-3 text-ink-muted">
                        {lang === 'ar' ? row.demoAr : row.demoEn}
                      </td>
                      <td className="border-b border-border-paper p-3 font-semibold text-positive-ink">
                        {lang === 'ar' ? row.prodAr : row.prodEn}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CTA Footer */}
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild variant="primary" size="lg" className="w-full sm:w-auto">
              <Link href="/quiz/register">
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                <span>
                  {lang === 'ar' ? 'جرّب الاختبار الآن' : 'Try the Quiz Demo Now'}
                </span>
                <Arrow className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
              <Link href="/admin/quiz">
                <span>
                  {lang === 'ar' ? 'فتح لوحة إدارة الاختبار' : 'Open Quiz Admin Dashboard'}
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
