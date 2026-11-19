'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Language } from '@/lib/schemas';

const LANG_STORAGE_KEY = 'casino_el_al3ab_lang_v1';

const dictionary = {
  en: {
    brandName: 'Casino El Al3ab',
    brandSubtitle: 'Ramadan Tournament',
    nav: {
      pitch: 'Pitch & Overview',
      finalNight: 'Final Night',
      bracket: 'Bracket',
      leaderboard: 'Leaderboard',
      schedule: 'Schedule',
      segments: 'Segments',
      rules: 'Rules',
      sponsors: 'Sponsors',
      scorerConsole: 'Scorer Console',
      bigScreen: 'Big Screen',
      adminArea: 'Admin Studio',
      playerPortal: 'My Profile',
      login: 'Demo Login',
      logout: 'Exit Role',
    },
    roles: {
      superAdmin: 'Super Admin',
      scorer: 'Table Scorer',
      checkIn: 'Check-In Staff',
      content: 'Content Manager',
      player: 'Contestant',
      visitor: 'Spectator (Public)',
    },
    adminNav: {
      dashboard: 'Overview',
      players: 'Players',
      managers: 'Managers & Roles',
      bracket: 'Bracket Config',
      games: 'Games & Sessions',
      segments: 'Segments Library',
      results: 'Results Feed',
      audit: 'Audit Log',
      checkIn: 'Gate Check-In',
      content: 'Content & Rules',
      sponsors: 'Sponsor Tiers',
      settings: 'Settings & Reset',
    },
    scorerNav: {
      myGames: 'My Assigned Tables',
      liveConsole: 'Live Scorer Console',
      bigScreenPreview: 'Open Big Screen',
    },
    common: {
      live: 'LIVE',
      liveNow: 'LIVE NOW',
      switchLanguage: 'عربي',
      resetDemoData: 'Reset Demo Data',
      resetConfirm: 'Demo data has been restored to the original Ramadan 2027 tournament state.',
      switchRoleQuick: 'Quick Role Switch',
      viewLiveGame: 'Live Table B',
      accessRestricted: 'Role Permission Required',
      accessRestrictedDesc: 'Your current demo role does not have permission to view or modify this area. Switch to an authorized role below.',
      goToLogin: 'Switch Demo Account',
      backToHome: 'Back to Pitch Home',
      placeholderBadge: 'RAMADAN 2027 PITCH PROTOTYPE',
      footerTagline: 'A bold, joyful Ramadan trivia & game-show tournament culminating in a Grand Final against Marwan Serry.',
      footerDisclaimer: 'Pitch prototype: dates, venue, prizes, and sponsor packages are editable placeholders. No real-money gambling.',
      phaseShellReady: 'Phase 1 Architecture & App Shell Ready',
    },
  },
  ar: {
    brandName: 'كازينو الألعاب',
    brandSubtitle: 'بطولة رمضان الكبرى',
    nav: {
      pitch: 'العرض الرئيسي',
      finalNight: 'ليلة النهائي',
      bracket: 'شجرة البطولة',
      leaderboard: 'لوحة الصدارة',
      schedule: 'الجدول والمواعيد',
      segments: 'فقرات التحدي',
      rules: 'القوانين',
      sponsors: 'الرعاة',
      scorerConsole: 'لوحة الحكم',
      bigScreen: 'شاشة العرض',
      adminArea: 'إدارة البطولة',
      playerPortal: 'ملف اللاعب',
      login: 'دخول تجريبي',
      logout: 'خروج من الدور',
    },
    roles: {
      superAdmin: 'مدير البطولة',
      scorer: 'حكم طاولة',
      checkIn: 'تسجيل الحضور',
      content: 'مدير المحتوى',
      player: 'متسابق',
      visitor: 'زائر (عام)',
    },
    adminNav: {
      dashboard: 'نظرة عامة',
      players: 'اللاعبون',
      managers: 'المديرون والصلاحيات',
      bracket: 'إعدادات التصفيات',
      games: 'المباريات والجلسات',
      segments: 'مكتبة الفقرات',
      results: 'سجل النتائج المباشر',
      audit: 'سجل المراجعة (Audit)',
      checkIn: 'بوابة حضور اللاعبين',
      content: 'المحتوى والقوانين',
      sponsors: 'فئات الرعاة',
      settings: 'الإعدادات وإعادة الضبط',
    },
    scorerNav: {
      myGames: 'طاولاتي المخصصة',
      liveConsole: 'لوحة التحكيم المباشرة',
      bigScreenPreview: 'فتح شاشة العرض',
    },
    common: {
      live: 'مباشر',
      liveNow: 'مباشر الآن',
      switchLanguage: 'EN',
      resetDemoData: 'إعادة ضبط البيانات التجريبية',
      resetConfirm: 'تمت استعادة البيانات التجريبية لبطولة رمضان ٢٠٢٧ بنجاح.',
      switchRoleQuick: 'تبديل الدور سريعاً',
      viewLiveGame: 'طاولة ب المباشرة',
      accessRestricted: 'صلاحية الدور مطلوبة',
      accessRestrictedDesc: 'الحساب التجريبي الحالي لا يملك صلاحية الوصول إلى هذه الصفحة. يمكنك التبديل إلى حساب مصرّح له أدناه.',
      goToLogin: 'تبديل الحساب التجريبي',
      backToHome: 'العودة للصفحة الرئيسية',
      placeholderBadge: 'نموذج عرض أولي: رمضان ٢٠٢٧',
      footerTagline: 'بطولة ترفيهية رمضانية على طراز برامج المسابقات الكبرى تُختتم بمواجهة مروان سري في النهائي.',
      footerDisclaimer: 'نسخة عرض أولية: جميع المواعيد والمكان والجوائز وفئات الرعاية مبدئية وقابلة للتعديل. مسابقة معلومات وترفيه فقط.',
      phaseShellReady: 'اكتمل تأسيس البنية التحتية والهيكل العام (المرحلة الأولى)',
    },
  },
} as const;

export type Dictionary = (typeof dictionary)[Language];

interface I18nContextValue {
  lang: Language;
  dir: 'ltr' | 'rtl';
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: Dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  useEffect(() => {
    try {
      const urlLang = new URLSearchParams(window.location.search).get('lang');
      if (urlLang === 'en' || urlLang === 'ar') {
        setLangState(urlLang);
        window.localStorage.setItem(LANG_STORAGE_KEY, urlLang);
        return;
      }
      const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'en' || saved === 'ar') {
        setLangState(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
    }
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'ar' : 'en');
  }, [lang, setLang]);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      setLang,
      toggleLang,
      t: dictionary[lang],
    }),
    [lang, setLang, toggleLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
