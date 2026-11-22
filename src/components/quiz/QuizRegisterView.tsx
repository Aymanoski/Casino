'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { quizRepo, type PublicQuizOverview } from '@/lib/repos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { QuizDemoBanner } from './QuizDemoBanner';
import {
  QUIZ_VERIFICATION_CHANNEL_COPY,
  writeStoredApplicantSession,
} from './quizHelpers';

type StepState = 'form' | 'verify' | 'already_finished' | 'resume_attempt';

export function QuizRegisterView() {
  const router = useRouter();
  const { lang } = useI18n();
  const [overview, setOverview] = useState<PublicQuizOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<StepState>('form');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);

  const [applicantId, setApplicantId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    quizRepo.getPublicOverview().then((ov) => {
      setOverview(ov);
      setLoading(false);
    });
  }, []);

  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await quizRepo.registerApplicant({
        fullName,
        fullNameAr: fullName,
        phone,
        email,
        consentAccepted: consent,
        verificationChannel: overview?.verificationChannel,
      });
      writeStoredApplicantSession(res.applicant.id);
      setApplicantId(res.applicant.id);

      if (res.status === 'already_finished') {
        setStep('already_finished');
      } else if (res.status === 'resume_attempt') {
        setStep('resume_attempt');
      } else if (res.status === 'already_verified') {
        router.push('/quiz/rules');
      } else {
        setStep('verify');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : lang === 'ar'
            ? 'يرجى التحقق من البيانات المدخلة.'
            : 'Please check your registration details.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantId) return;
    setError(null);
    setSubmitting(true);
    try {
      await quizRepo.verifyApplicant({ applicantId, code: otpCode });
      writeStoredApplicantSession(applicantId);
      router.push('/quiz/rules');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : lang === 'ar'
            ? 'رمز التحقق غير صحيح.'
            : 'Invalid verification code.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !overview) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-10">
        <Skeleton className="h-14 w-full rounded-card" />
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    );
  }

  const channelCopy = QUIZ_VERIFICATION_CHANNEL_COPY[overview.verificationChannel];
  const isClosed = overview.windowState.status !== 'open';

  return (
    <div className="theme-paper flex-1 bg-paper py-6 sm:py-10">
      <div className="mx-auto max-w-xl space-y-5 px-4">
        <QuizDemoBanner surface="paper" />

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 text-xs font-extrabold">
          <span
            className={`inline-flex items-center gap-1.5 rounded-pill border-2 border-outline px-3 py-1 ${
              step === 'form' ? 'bg-gold-400 text-red-900 shadow-sticker-sm' : 'bg-white text-ink-muted'
            }`}
          >
            <span>1</span>
            <span>{lang === 'ar' ? 'البيانات' : 'Details'}</span>
          </span>
          <span className="h-0.5 w-6 bg-outline/30" aria-hidden="true" />
          <span
            className={`inline-flex items-center gap-1.5 rounded-pill border-2 border-outline px-3 py-1 ${
              step === 'verify' ? 'bg-gold-400 text-red-900 shadow-sticker-sm' : 'bg-white text-ink-muted'
            }`}
          >
            <span>2</span>
            <span>{lang === 'ar' ? 'التحقق' : 'Verify'}</span>
          </span>
          <span className="h-0.5 w-6 bg-outline/30" aria-hidden="true" />
          <span className="inline-flex items-center gap-1.5 rounded-pill border-2 border-border-paper bg-white px-3 py-1 text-ink-muted">
            <span>3</span>
            <span>{lang === 'ar' ? 'الاختبار' : 'Play'}</span>
          </span>
        </div>

        {step === 'already_finished' && (
          <div
            data-testid="quiz-already-finished-card"
            className="rounded-card border-[3px] border-outline bg-white p-6 text-center shadow-sticker space-y-4"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-pill border-2 border-outline bg-gold-200 text-red-900">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl text-red-900">
              {lang === 'ar'
                ? 'تم تسجيل محاولتك مسبقاً'
                : 'Your Attempt Is Already Recorded'}
            </h1>
            <p className="text-sm leading-relaxed text-ink-muted">
              {lang === 'ar'
                ? 'يسمح النظام بمحاولة واحدة فقط لكل رقم هاتف أو بريد إلكتروني موثّق. يمكنك استعراض نتيجتك المسجّلة مباشرة.'
                : 'Our one-attempt policy allows a single try per verified phone number or email. You can view your saved result right away.'}
            </p>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center">
              <Button asChild variant="primary" size="lg">
                <Link href="/quiz/result" data-testid="quiz-go-to-result">
                  <span>{lang === 'ar' ? 'عرض نتيجتي' : 'View My Result'}</span>
                  <Arrow className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => setStep('form')}
              >
                <span>{lang === 'ar' ? 'استخدام بيانات أخرى' : 'Use Different Details'}</span>
              </Button>
            </div>
          </div>
        )}

        {step === 'resume_attempt' && (
          <div
            data-testid="quiz-resume-attempt-card"
            className="rounded-card border-[3px] border-outline bg-white p-6 text-center shadow-sticker space-y-4"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-pill border-2 border-outline bg-blue-100 text-blue-800">
              <Sparkles className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl text-red-900">
              {lang === 'ar'
                ? 'لديك محاولة مفتوحة بالفعل'
                : 'You Have an Active Attempt'}
            </h1>
            <p className="text-sm leading-relaxed text-ink-muted">
              {lang === 'ar'
                ? 'يمكنك العودة فوراً لاستكمال الأسئلة المتبقية وفق التوقيت المحفوظ دون بدء محاولة جديدة.'
                : 'Jump right back into your remaining questions using your stored deadlines.'}
            </p>
            <Button asChild variant="primary" size="lg" className="w-full sm:w-auto">
              <Link href="/quiz/play">
                <span>{lang === 'ar' ? 'متابعة الاختبار الآن' : 'Resume Active Quiz'}</span>
                <Arrow className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        )}

        {step === 'form' && (
          <div className="rounded-card border-[3px] border-outline bg-white p-5 shadow-sticker sm:p-7">
            <div className="mb-5 space-y-1.5">
              <h1 className="font-display text-2xl sm:text-3xl text-red-900">
                {lang === 'ar' ? 'تسجيل المتقدم للاختبار' : 'Applicant Registration'}
              </h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                {lang === 'ar'
                  ? 'بياناتك تُستخدم فقط للتحقق من هويتك والتواصل معك عند التأهل للبطولة. لن تُعرض للجمهور أبداً.'
                  : 'Your details are used strictly to verify your single attempt and contact you if you qualify — never shown publicly.'}
              </p>
            </div>

            {isClosed && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-card border-2 border-negative bg-negative-soft p-3.5 text-sm font-semibold text-red-900"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-negative" aria-hidden="true" />
                <span>
                  {overview.windowState.status === 'upcoming'
                    ? lang === 'ar'
                      ? 'باب الاختبار لم يفتح بعد. يمكنك معاينة المسجلين السابقين فقط.'
                      : 'The quiz window has not opened yet.'
                    : lang === 'ar'
                      ? 'أُغلق باب الاختبار. إذا سبق وأتممت الاختبار أدخل بياناتك لعرض نتيجتك.'
                      : 'The quiz window is closed. If you already completed the quiz, enter your phone/email to view your result.'}
                </span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                data-testid="quiz-register-error"
                className="mb-4 flex items-start gap-2.5 rounded-card border-2 border-negative bg-negative-soft p-3.5 text-sm font-semibold text-red-900"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-negative" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="quiz-full-name"
                  className="flex items-center gap-1.5 text-sm font-bold text-red-900"
                >
                  <User className="h-4 w-4 text-red-600" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'الاسم الكامل' : 'Full Name'}</span>
                </label>
                <Input
                  id="quiz-full-name"
                  data-testid="quiz-input-name"
                  type="text"
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: أحمد محمود حسن' : 'e.g. Ahmed Mahmoud Hassan'}
                  className="min-h-[48px] text-base"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="quiz-phone"
                  className="flex items-center gap-1.5 text-sm font-bold text-red-900"
                >
                  <Phone className="h-4 w-4 text-red-600" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'رقم الموبايل (واتساب / SMS)' : 'Mobile Phone (WhatsApp / SMS)'}</span>
                </label>
                <Input
                  id="quiz-phone"
                  data-testid="quiz-input-phone"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  className="min-h-[48px] text-base text-start"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="quiz-email"
                  className="flex items-center gap-1.5 text-sm font-bold text-red-900"
                >
                  <Mail className="h-4 w-4 text-red-600" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}</span>
                </label>
                <Input
                  id="quiz-email"
                  data-testid="quiz-input-email"
                  type="email"
                  inputMode="email"
                  dir="ltr"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="min-h-[48px] text-base text-start"
                />
              </div>

              <label className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-card border-2 border-border-paper bg-paper p-3.5 text-sm leading-relaxed text-ink">
                <input
                  type="checkbox"
                  data-testid="quiz-consent-checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-red-600"
                />
                <span>
                  {lang === 'ar'
                    ? 'أوافق على قواعد الاختبار (محاولة واحدة فقط، مؤقت ١٠ ثوانٍ لكل سؤال دون رجوع) وعلى استخدام بياناتي للتواصل في حال التأهل للبطولة.'
                    : 'I agree to the quiz rules (single attempt, 10s per question with no going back) and consent to being contacted if I qualify for the tournament.'}
                </span>
              </label>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={submitting}
                data-testid="quiz-register-submit"
                className="w-full min-h-[54px] text-base"
              >
                <span>
                  {submitting
                    ? lang === 'ar'
                      ? 'جاري إرسال رمز التحقق...'
                      : 'Sending verification code...'
                    : lang === 'ar'
                      ? `المتابعة للتحقق (${channelCopy.labelAr})`
                      : `Continue to Verification (${channelCopy.labelEn})`}
                </span>
                <Arrow className="h-5 w-5" aria-hidden="true" />
              </Button>
            </form>
          </div>
        )}

        {step === 'verify' && (
          <div className="rounded-card border-[3px] border-outline bg-white p-5 shadow-sticker sm:p-7 space-y-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge variant="gold">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{lang === 'ar' ? channelCopy.labelAr : channelCopy.labelEn}</span>
                </Badge>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl text-red-900">
                {lang === 'ar' ? 'أدخل رمز التحقق' : 'Enter Verification Code'}
              </h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                {lang === 'ar' ? channelCopy.promptAr : channelCopy.promptEn}{' '}
                <strong dir="ltr" className="text-red-900">
                  {overview.verificationChannel === 'email' ? email : phone}
                </strong>
              </p>
            </div>

            {/* Honest Visible Demo OTP Callout */}
            <div
              data-testid="quiz-demo-otp-notice"
              className="rounded-card border-2 border-outline bg-gold-200/60 p-4 text-sm text-red-900 shadow-sticker-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-black uppercase">
                    {lang === 'ar'
                      ? 'رمز تجريبي للعرض (DEMO MODE)'
                      : 'DEMO VERIFICATION CODE'}
                  </div>
                  <div className="text-sm font-semibold">
                    {lang === 'ar'
                      ? 'لا يتم إرسال رسائل فعلية في العرض التجريبي. استخدم الرمز:'
                      : 'No real SMS/WhatsApp is sent in Demo Mode. Use test code:'}{' '}
                    <code
                      dir="ltr"
                      className="mt-1 inline-block rounded-highlight border border-outline bg-white px-2.5 py-0.5 align-middle font-score text-lg font-black tracking-wider text-red-700"
                    >
                      {overview.demoVerificationCode}
                    </code>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-testid="quiz-fill-demo-otp"
                  onClick={() => setOtpCode(overview.demoVerificationCode)}
                  className="shrink-0"
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  <span>{lang === 'ar' ? 'تعبئة الرمز' : 'Fill Code'}</span>
                </Button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                data-testid="quiz-verify-error"
                className="flex items-start gap-2.5 rounded-card border-2 border-negative bg-negative-soft p-3.5 text-sm font-semibold text-red-900"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-negative" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="quiz-otp"
                  className="block text-sm font-bold text-red-900"
                >
                  {lang === 'ar' ? 'رمز التحقق (٦ أرقام)' : '6-Digit Verification Code'}
                </label>
                <Input
                  id="quiz-otp"
                  data-testid="quiz-otp-input"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  autoComplete="one-time-code"
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder={overview.demoVerificationCode}
                  className="min-h-[54px] text-center font-score text-2xl tracking-[0.25em]"
                />
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={submitting}
                  data-testid="quiz-verify-submit"
                  className="flex-1 min-h-[54px] text-base"
                >
                  <span>
                    {submitting
                      ? lang === 'ar'
                        ? 'جاري التحقق...'
                        : 'Verifying...'
                      : lang === 'ar'
                        ? 'تأكيد والانتقال للقواعد'
                        : 'Verify & Review Rules'}
                  </span>
                  <Arrow className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    setError(null);
                    setStep('form');
                  }}
                >
                  <span>{lang === 'ar' ? 'تعديل البيانات' : 'Edit Info'}</span>
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
