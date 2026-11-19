'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Pencil,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { realtime } from '@/lib/realtime';
import {
  gameRepo,
  MANAGER_ROLE_SPECS,
  SCORE_HISTORY_MANAGER_ROLES,
  userRepo,
} from '@/lib/repos';
import type { Game, Language, User, UserRole } from '@/lib/schemas';
import { localizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormGrid } from '@/components/ui/form-grid';
import { Input } from '@/components/ui/input';
import { Skeleton, TableRowSkeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import {
  AdminErrorBanner,
  AdminPageHeader,
  AdminStatChipStrip,
} from './AdminPageHeader';
import { getRoleBadgeVariant } from './adminFormatters';

type ManagerRole = Exclude<UserRole, 'player'>;

const MANAGER_ROLES: ManagerRole[] = [
  'superAdmin',
  'scorer',
  'checkIn',
  'content',
];

const ManagerFormSchema = z.object({
  name: z.string().trim().min(2),
  nameAr: z.string().trim().optional(),
  email: z.string().trim().email(),
  role: z.enum(['superAdmin', 'scorer', 'checkIn', 'content']),
  titleEn: z.string().trim().optional(),
  titleAr: z.string().trim().optional(),
  language: z.enum(['en', 'ar']),
});

interface ManagerFormState {
  name: string;
  nameAr: string;
  email: string;
  role: ManagerRole;
  titleEn: string;
  titleAr: string;
  language: Language;
}

export function AdminManagersView() {
  const { user, loginAs } = useAuth();
  const { lang, t } = useI18n();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<'all' | ManagerRole>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formState, setFormState] = useState<ManagerFormState>({
    name: '',
    nameAr: '',
    email: '',
    role: 'scorer',
    titleEn: '',
    titleAr: '',
    language: 'en',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [allUsers, allGames] = await Promise.all([
        userRepo.list(),
        gameRepo.list(),
      ]);
      if (!mountedRef.current) return;
      setUsers(allUsers);
      setGames(allGames);
      setError(null);
    } catch {
      if (!mountedRef.current) return;
      setError(
        lang === 'ar'
          ? 'تعذر تحميل قائمة المديرين.'
          : 'Failed to load staff managers.'
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadData();
    const unsub = realtime.subscribe('*', (msg) => {
      if (
        msg.event === 'user.updated' ||
        msg.event === 'bracket.updated' ||
        msg.event === 'data.reset'
      ) {
        loadData();
      }
    });
    return unsub;
  }, [loadData]);

  const managers = useMemo(
    () => users.filter((u) => u.role !== 'player'),
    [users]
  );

  const filteredManagers = useMemo(() => {
    if (roleFilter === 'all') return managers;
    return managers.filter((u) => u.role === roleFilter);
  }, [managers, roleFilter]);

  const gamesCountByScorer = useMemo(() => {
    const map = new Map<string, number>();
    games.forEach((g) => {
      map.set(g.scorerUserId, (map.get(g.scorerUserId) ?? 0) + 1);
    });
    return map;
  }, [games]);

  const openCreate = () => {
    setEditingUser(null);
    setFormState({
      name: '',
      nameAr: '',
      email: '',
      role: 'scorer',
      titleEn: '',
      titleAr: '',
      language: lang,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (target: User) => {
    if (target.role === 'player') return;
    setEditingUser(target);
    setFormState({
      name: target.name,
      nameAr: target.nameAr,
      email: target.email,
      role: target.role,
      titleEn: target.titleEn ?? '',
      titleAr: target.titleAr ?? '',
      language: target.language,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const parsed = ManagerFormSchema.safeParse(formState);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        errs[String(i.path[0] ?? 'form')] =
          lang === 'ar' ? 'يرجى التحقق من هذا الحقل' : i.message;
      });
      setFormErrors(errs);
      return;
    }

    const emailLower = parsed.data.email.toLowerCase();
    const dup = users.find(
      (u) => u.email.toLowerCase() === emailLower && u.id !== editingUser?.id
    );
    if (dup) {
      setFormErrors({
        email:
          lang === 'ar'
            ? 'هذا البريد الإلكتروني مستخدم بالفعل'
            : 'Email is already assigned to another account.',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        await userRepo.update(
          editingUser.id,
          {
            name: parsed.data.name,
            nameAr: parsed.data.nameAr || parsed.data.name,
            email: emailLower,
            role: parsed.data.role,
            titleEn: parsed.data.titleEn || undefined,
            titleAr: parsed.data.titleAr || undefined,
            language: parsed.data.language,
          },
          user.id
        );
        toast({
          variant: 'positive',
          title: lang === 'ar' ? 'تم تحديث الحساب' : 'Manager updated',
          description: `${parsed.data.name} (${t.roles[parsed.data.role]})`,
        });
      } else {
        await userRepo.create(
          {
            name: parsed.data.name,
            nameAr: parsed.data.nameAr || parsed.data.name,
            email: emailLower,
            role: parsed.data.role,
            titleEn: parsed.data.titleEn || undefined,
            titleAr: parsed.data.titleAr || undefined,
            language: parsed.data.language,
          },
          user.id
        );
        toast({
          variant: 'positive',
          title: lang === 'ar' ? 'تم إنشاء حساب المدير' : 'Manager created',
          description:
            lang === 'ar'
              ? 'أصبح الحساب متاحاً فوراً في محوّل الأدوار السريع للتجربة.'
              : 'Account is live in the Quick Role Switcher for immediate testing.',
        });
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر حفظ الحساب' : 'Could not save manager',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (target: User) => {
    if (!user) return;
    try {
      const ok = await userRepo.remove(target.id, user.id);
      if (ok) {
        toast({
          variant: 'info',
          title: lang === 'ar' ? 'تم حذف الحساب' : 'Manager removed',
          description: localizeText(lang, target.name, target.nameAr),
        });
        await loadData();
      }
    } catch (err) {
      toast({
        variant: 'negative',
        title: lang === 'ar' ? 'تعذر حذف الحساب' : 'Could not remove manager',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const statItems = useMemo(
    () => [
      {
        id: 'super',
        value: managers.filter((m) => m.role === 'superAdmin').length,
        label: t.roles.superAdmin,
        detail: lang === 'ar' ? 'صلاحية كاملة' : 'Full control',
        tone: 'gold' as const,
      },
      {
        id: 'scorers',
        value: managers.filter((m) => m.role === 'scorer').length,
        label: t.roles.scorer,
        detail: lang === 'ar' ? 'طاولات متوازية' : 'Live table consoles',
        tone: 'red' as const,
      },
      {
        id: 'checkin',
        value: managers.filter((m) => m.role === 'checkIn').length,
        label: t.roles.checkIn,
        detail: lang === 'ar' ? 'بوابة الاستقبال' : 'Venue arrival gate',
        tone: 'white' as const,
      },
      {
        id: 'content',
        value: managers.filter((m) => m.role === 'content').length,
        label: t.roles.content,
        detail: lang === 'ar' ? 'المحتوى والرعاة' : 'Copy, rules & sponsors',
        tone: 'blue' as const,
      },
    ],
    [managers, lang, t.roles]
  );

  const selectedRoleSpec = useMemo(
    () => MANAGER_ROLE_SPECS.find((spec) => spec.role === formState.role),
    [formState.role]
  );

  const columns = useMemo<DataTableColumn<User>[]>(
    () => [
      {
        key: 'name',
        header: lang === 'ar' ? 'المدير' : 'Manager',
        sortable: true,
        sortAccessor: (u) => localizeText(lang, u.name, u.nameAr).toLowerCase(),
        mobileRole: 'title',
        render: (u) => (
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-bold text-ink">
              <span className="truncate">{localizeText(lang, u.name, u.nameAr)}</span>
              {u.id === user?.id && (
                <Badge variant="white" className="text-[11px]">
                  {lang === 'ar' ? 'أنت' : 'You'}
                </Badge>
              )}
            </div>
            <div className="truncate text-xs text-ink-muted">{u.email}</div>
          </div>
        ),
      },
      {
        key: 'role',
        header: lang === 'ar' ? 'الدور' : 'Role',
        sortable: true,
        sortAccessor: (u) => u.role,
        mobileRole: 'badge',
        render: (u) => (
          <Badge variant={getRoleBadgeVariant(u.role)}>{t.roles[u.role]}</Badge>
        ),
      },
      {
        key: 'title',
        header: lang === 'ar' ? 'المسمى الوظيفي' : 'Assignment / Title',
        render: (u) => (
          <div className="text-xs text-ink-muted">
            {u.titleEn || u.titleAr
              ? localizeText(lang, u.titleEn ?? '', u.titleAr)
              : '—'}
          </div>
        ),
      },
      {
        key: 'tables',
        header: lang === 'ar' ? 'الطاولات المسندة' : 'Assigned Tables',
        render: (u) =>
          u.role === 'scorer' ? (
            <Badge variant="white">
              {gamesCountByScorer.get(u.id) ?? 0}{' '}
              {lang === 'ar' ? 'طاولات' : 'tables'}
            </Badge>
          ) : (
            <span className="text-xs text-ink-faint">—</span>
          ),
      },
      {
        key: 'actions',
        header: lang === 'ar' ? 'إجراءات' : 'Actions',
        render: (u) => {
          const isProtected = u.id === 'user-admin' || u.id === user?.id;
          return (
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="calm"
                size="sm"
                onClick={async () => {
                  await loginAs(u.id);
                  toast({
                    variant: 'info',
                    title:
                      lang === 'ar'
                        ? `تم التبديل إلى ${localizeText(lang, u.name, u.nameAr)}`
                        : `Switched to ${u.name}`,
                    description: t.roles[u.role],
                  });
                }}
                title={
                  lang === 'ar'
                    ? 'اختبار الصلاحيات بهذا الحساب'
                    : 'Impersonate to test role permissions'
                }
              >
                <UserCheck className="h-4 w-4 text-blue-600" />
                <span className="hidden xl:inline">
                  {lang === 'ar' ? 'تجربة' : 'Test Role'}
                </span>
              </Button>

              <Button
                type="button"
                variant="calm"
                size="icon"
                onClick={() => openEdit(u)}
                aria-label={lang === 'ar' ? `تعديل ${u.name}` : `Edit ${u.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>

              {!isProtected && (
                <ConfirmDialog
                  destructive
                  title={lang === 'ar' ? 'حذف حساب المدير؟' : 'Remove Manager Account?'}
                  description={
                    lang === 'ar'
                      ? `سيتم حذف حساب ${u.nameAr || u.name} وسحب صلاحياته فوراً.`
                      : `Remove ${u.name} (${t.roles[u.role]})? This action is recorded in the audit log.`
                  }
                  confirmLabel={lang === 'ar' ? 'حذف الحساب' : 'Remove'}
                  cancelLabel={lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  onConfirm={() => handleRemove(u)}
                  trigger={
                    <Button
                      type="button"
                      variant="calm"
                      size="icon"
                      aria-label={lang === 'ar' ? `حذف ${u.name}` : `Delete ${u.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-negative" />
                    </Button>
                  }
                />
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, user?.id, gamesCountByScorer, t.roles]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="rounded-card border border-border-paper bg-white overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <TableRowSkeleton key={i} columns={4} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={lang === 'ar' ? 'المديرون والصلاحيات' : 'Managers & Role Access'}
        description={
          lang === 'ar'
            ? 'إنشاء حسابات فريق التنظيم وتعيين الأدوار مع فرض الصلاحيات تلقائياً في الواجهة وطبقة البيانات.'
            : 'Create event staff accounts, assign operational roles, and inspect what each role can and cannot do.'
        }
        actions={
          <Button type="button" variant="red" size="sm" onClick={openCreate}>
            <UserPlus className="h-4 w-4" />
            <span>{lang === 'ar' ? 'إضافة مدير جديد' : 'Add Manager'}</span>
          </Button>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={loadData} />}

      <AdminStatChipStrip items={statItems} />

      <DataTable
        data={filteredManagers}
        columns={columns}
        getRowKey={(u) => u.id}
        searchPlaceholder={
          lang === 'ar'
            ? 'ابحث بالاسم أو البريد أو المسمى...'
            : 'Search managers by name, email, or title...'
        }
        searchFilter={(u, q) =>
          u.name.toLowerCase().includes(q) ||
          u.nameAr.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.titleEn ?? '').toLowerCase().includes(q)
        }
        filterLabel={lang === 'ar' ? 'تصفية بالدور' : 'Role Filter'}
        filterSlot={
          <select
            aria-label={lang === 'ar' ? 'تصفية حسب الدور' : 'Filter by role'}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | ManagerRole)}
            className="min-h-[44px] h-11 w-full md:w-auto rounded-input border-2 border-border-paper bg-white px-3 text-base sm:text-sm font-semibold text-ink focus:border-blue-500 focus:outline-none focus:ring-[3px] focus:ring-blue-500/25"
          >
            <option value="all">{lang === 'ar' ? 'كل الأدوار' : 'All Roles'}</option>
            {MANAGER_ROLES.map((r) => (
              <option key={r} value={r}>
                {t.roles[r]}
              </option>
            ))}
          </select>
        }
      />

      {/* Role Capabilities Reference Matrix */}
      <section aria-labelledby="role-matrix-heading" className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="role-matrix-heading"
              className="font-display text-xl sm:text-2xl text-red-900"
            >
              {lang === 'ar'
                ? 'دليل صلاحيات الأدوار (ما يُسمح به وما يُمنع)'
                : 'Role Permission Matrix — What Each Role Can Do'}
            </h2>
            <p className="text-sm text-ink-muted">
              {lang === 'ar'
                ? 'يتم تطبيق هذه القواعد في الواجهة وفي كل استدعاء للبيانات (Repository Layer).'
                : 'Enforced across both UI route guards and every async repository call.'}
            </p>
          </div>
          <Badge variant="white">
            <Shield className="h-3.5 w-3.5 text-red-600" />
            <span>
              {lang === 'ar'
                ? `التحكم الكامل بسجل النقاط: ${SCORE_HISTORY_MANAGER_ROLES.map((r) => t.roles[r]).join('، ')}`
                : `Score History Control: ${SCORE_HISTORY_MANAGER_ROLES.map((r) => t.roles[r]).join(', ')}`}
            </span>
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {MANAGER_ROLE_SPECS.map((spec) => (
            <div
              key={spec.role}
              className="rounded-card border border-border-paper bg-white p-5 shadow-soft space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border-paper pb-3">
                <div className="space-y-1">
                  <Badge variant={getRoleBadgeVariant(spec.role)}>
                    {localizeText(lang, spec.titleEn, spec.titleAr)}
                  </Badge>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    {localizeText(lang, spec.summaryEn, spec.summaryAr)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1" dir="ltr">
                  {spec.routes.map((route) => (
                    <code
                      key={route}
                      className="rounded-chip-sm border border-border-paper bg-paper-2 px-2 py-0.5 text-[11px] font-semibold text-red-900"
                    >
                      {route}
                    </code>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-positive-ink">
                    {lang === 'ar' ? 'يمكنه القيام بـ' : 'Can Do'}
                  </div>
                  <ul className="space-y-1.5 text-xs text-ink">
                    {(lang === 'ar' ? spec.canDoAr : spec.canDoEn).map((line) => (
                      <li key={line} className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive-ink" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-negative">
                    {lang === 'ar' ? 'لا يمكنه' : 'Cannot Do'}
                  </div>
                  <ul className="space-y-1.5 text-xs text-ink-muted">
                    {(lang === 'ar' ? spec.cannotDoAr : spec.cannotDoEn).map(
                      (line) => (
                        <li key={line} className="flex items-start gap-1.5">
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-negative" />
                          <span>{line}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Create / Edit Manager Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingUser
                ? lang === 'ar'
                  ? 'تعديل حساب المدير والصلاحية'
                  : 'Edit Manager & Role'
                : lang === 'ar'
                  ? 'إنشاء حساب مدير جديد'
                  : 'Create Manager Account'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'ar'
                ? 'اختر الدور المناسب لمهام العضو. يتم تسجيل أي تغيير في الصلاحيات داخل سجل المراجعة.'
                : 'Assign a tournament staff role. Every role creation or change writes an AuditEntry.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <FormGrid columns={2}>
              <Input
                label={lang === 'ar' ? 'الاسم (إنجليزي)' : 'Name (EN)'}
                value={formState.name}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, name: e.target.value }))
                }
                error={formErrors.name}
                placeholder="Scorer 5 — Main Stage"
                required
              />
              <Input
                label={lang === 'ar' ? 'الاسم (عربي)' : 'Name (AR)'}
                value={formState.nameAr}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, nameAr: e.target.value }))
                }
                placeholder="حكم طاولة ٥"
                dir="rtl"
              />
              <Input
                label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                type="email"
                value={formState.email}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, email: e.target.value }))
                }
                error={formErrors.email}
                placeholder="staff@casinoelal3ab.com"
                required
              />
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold uppercase ltr:tracking-wider rtl:tracking-normal text-ink">
                  {lang === 'ar' ? 'الدور الوظيفي' : 'Assigned Role'}
                </label>
                <select
                  value={formState.role}
                  disabled={editingUser?.id === 'user-admin'}
                  onChange={(e) =>
                    setFormState((s) => ({
                      ...s,
                      role: e.target.value as ManagerRole,
                    }))
                  }
                  className="flex min-h-[44px] h-11 w-full rounded-input border-2 border-border-paper bg-white px-3.5 text-base text-ink focus:border-blue-500 focus:outline-none focus:ring-[3px] focus:ring-blue-500/25 disabled:opacity-60"
                >
                  {MANAGER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t.roles[r]}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label={lang === 'ar' ? 'المسمى (إنجليزي)' : 'Title (EN)'}
                value={formState.titleEn}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, titleEn: e.target.value }))
                }
                placeholder="Stage Scorer (Table 5)"
              />
              <Input
                label={lang === 'ar' ? 'المسمى (عربي)' : 'Title (AR)'}
                value={formState.titleAr}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, titleAr: e.target.value }))
                }
                placeholder="حكم نقاط (طاولة ٥)"
                dir="rtl"
              />
            </FormGrid>

            {selectedRoleSpec && (
              <div className="rounded-input border border-border-paper bg-paper p-3.5 space-y-1.5">
                <div className="text-xs font-extrabold text-red-900">
                  {lang === 'ar' ? 'نطاق صلاحيات الدور المختار:' : 'Selected Role Scope:'}
                </div>
                <p className="text-xs text-ink-muted">
                  {localizeText(lang, selectedRoleSpec.summaryEn, selectedRoleSpec.summaryAr)}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFormOpen(false)}
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" variant="red" disabled={saving}>
                {saving
                  ? lang === 'ar'
                    ? 'جارٍ الحفظ...'
                    : 'Saving...'
                  : editingUser
                    ? lang === 'ar'
                      ? 'حفظ التغييرات'
                      : 'Save Changes'
                    : lang === 'ar'
                      ? 'إنشاء الحساب'
                      : 'Create Manager'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
