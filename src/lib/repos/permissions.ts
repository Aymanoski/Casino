import type { DatabaseSnapshot, Game, User, UserRole } from '@/lib/schemas';

/**
 * Centralized Scoring History & Table Lifecycle Permissions
 * Add or remove manager roles here as product permissions evolve (no UI rewrites needed).
 */
export const SCORE_HISTORY_MANAGER_ROLES: readonly UserRole[] = ['superAdmin'];
export const REOPEN_GAME_MANAGER_ROLES: readonly UserRole[] = ['superAdmin'];

export type RepoAction =
  | 'player.manage'
  | 'player.checkIn'
  | 'user.manage'
  | 'bracket.manage'
  | 'game.operate'
  | 'game.reopen'
  | 'score.operate'
  | 'score.manageHistory'
  | 'segment.manage'
  | 'segment.editCopy'
  | 'content.manage'
  | 'sponsor.manage'
  | 'settings.manage'
  | 'audit.read'
  | 'results.read';

export class PermissionDeniedError extends Error {
  readonly code = 'PERMISSION_DENIED';
  readonly action: RepoAction;
  readonly actorRole: UserRole | null;

  constructor(action: RepoAction, actorRole: UserRole | null, message?: string) {
    super(
      message ??
        `Permission denied: role "${actorRole ?? 'anonymous'}" cannot perform "${action}".`
    );
    this.name = 'PermissionDeniedError';
    this.action = action;
    this.actorRole = actorRole;
  }
}

export interface RoleCapabilitySpec {
  role: Exclude<UserRole, 'player'>;
  titleEn: string;
  titleAr: string;
  summaryEn: string;
  summaryAr: string;
  canDoEn: string[];
  canDoAr: string[];
  cannotDoEn: string[];
  cannotDoAr: string[];
  routes: string[];
}

/**
 * Authoritative role capability catalog per AGENTS.md §4.
 * Consumed by /admin/managers UI and aligned 1:1 with assertRepoPermission below.
 */
export const MANAGER_ROLE_SPECS: RoleCapabilitySpec[] = [
  {
    role: 'superAdmin',
    titleEn: 'Super Admin',
    titleAr: 'مدير البطولة (صلاحية كاملة)',
    summaryEn:
      'Complete operational authority across players, staff, bracket, scoring, audit log, and tournament settings.',
    summaryAr:
      'صلاحية تشغيلية كاملة على اللاعبين، طاقم العمل، شجرة البطولة، التحكيم، سجل المراجعة، وإعدادات الحدث.',
    canDoEn: [
      'Create, edit, delete, and CSV-import players',
      'Create managers and assign or change roles',
      'Build & auto-generate bracket, rounds, tables, and the Grand Final',
      'Full CRUD & reorder on segments, presets, and timers',
      'Run or reopen any game & edit/revert scoring history',
      'Inspect Results Feed, Audit Log (with before/after diffs), and export CSV',
      'Edit settings, placeholders, content, sponsors, and reset demo data',
    ],
    canDoAr: [
      'إضافة وتعديل وحذف اللاعبين والاستيراد الجماعي عبر CSV',
      'إنشاء حسابات المديرين وتعيين الصلاحيات وتعديلها',
      'بناء وتوليد شجرة البطولة، الجولات، الطاولات، والنهائي الكبير',
      'إدارة الفقرات وترتيبها وتعديل النقاط المسبقة والمؤقتات',
      'إدارة أي طاولة أو إعادة فتحها وتعديل سجل النقاط',
      'استعراض سجل النتائج وسجل المراجعة (قبل/بعد) وتصدير CSV',
      'تعديل إعدادات البطولة والمحتوى والرعاة وإعادة ضبط البيانات',
    ],
    cannotDoEn: ['No restrictions — full studio access'],
    cannotDoAr: ['لا توجد قيود — وصول كامل لجميع الأدوات'],
    routes: ['/admin/*', '/scorer/*', '/screen/*'],
  },
  {
    role: 'scorer',
    titleEn: 'Table Scorer',
    titleAr: 'حكم طاولة',
    summaryEn:
      'Runs assigned 3-player game sessions live on a tablet or phone with zero-mistake speed.',
    summaryAr:
      'يدير طاولات اللعب المخصصة له مباشرة على التابلت أو الهاتف بسرعة ودقة عالية.',
    canDoEn: [
      'View assigned games on /scorer',
      'Start assigned game, run segment timer, advance segments',
      'Tap "Buzzed First" and clear buzzes on assigned games',
      'Add/subtract preset & custom points with notes',
      'Undo own last scoring action and trigger Tie-Breaker #16',
    ],
    canDoAr: [
      'عرض الطاولات المخصصة له فقط في لوحة الحكم',
      'بدء المباراة وتشغيل مؤقت الفقرة والانتقال بين الفقرات',
      'تسجيل أول من ضغط الجرس وإلغاء الجرس',
      'إضافة وخصم النقاط المسبقة أو المخصصة مع ملاحظة',
      'التراجع عن آخر حركة نقاط خاصة به وفتح جولة الحسم',
    ],
    cannotDoEn: [
      'Access or score another scorer’s game',
      'Edit bracket, players, managers, segments, or settings',
      'Access Admin Studio pages, Results Feed, or Audit Log',
    ],
    cannotDoAr: [
      'الوصول إلى طاولات حكام آخرين أو تعديل نقاطها',
      'تعديل شجرة البطولة أو اللاعبين أو المديرين أو الفقرات أو الإعدادات',
      'دخول صفحات إدارة البطولة أو سجل المراجعة',
    ],
    routes: ['/scorer', '/scorer/[gameId]'],
  },
  {
    role: 'checkIn',
    titleEn: 'Check-In Staff',
    titleAr: 'مسؤول تسجيل الحضور',
    summaryEn:
      'Operates the venue arrival gate for today’s tables and contestant attendance.',
    summaryAr:
      'يدير بوابة استقبال المتسابقين لمباريات اليوم وتأكيد حضورهم أو غيابهم.',
    canDoEn: [
      'View Admin Overview and today’s scheduled tables',
      'View players assigned to upcoming and live games',
      'Mark contestants as Checked In, Absent, or Registered',
    ],
    canDoAr: [
      'عرض نظرة عامة وجدول مباريات اليوم',
      'استعراض أسماء المتسابقين في الطاولات القادمة والمباشرة',
      'تحديث حالة اللاعب إلى «تم الحضور» أو «غائب» أو «مسجّل»',
    ],
    cannotDoEn: [
      'Create, edit profile details, or delete players',
      'Change scores, buzzes, bracket, games, or settings',
      'Manage users, content, sponsors, or read Audit Log',
    ],
    cannotDoAr: [
      'إضافة لاعبين جدد أو تعديل بياناتهم أو حذفهم',
      'تعديل النقاط أو شجرة البطولة أو الإعدادات',
      'إدارة المديرين أو المحتوى أو الرعاة أو سجل المراجعة',
    ],
    routes: ['/admin', '/admin/check-in'],
  },
  {
    role: 'content',
    titleEn: 'Content Manager',
    titleAr: 'مدير المحتوى والفقرات',
    summaryEn:
      'Curates public copy, schedule announcements, rules, sponsor tiers, and bilingual segment descriptions.',
    summaryAr:
      'يشرف على النصوص العامة، الإعلانات، القوانين، فئات الرعاة، وأوصاف الفقرات باللغتين.',
    canDoEn: [
      'Create, edit, reorder, and delete announcements, rules, and schedule blurbs',
      'Manage sponsor tiers, blurbs, logo text lockups, and benefits',
      'Edit EN/AR titles and descriptions of tournament segments',
    ],
    canDoAr: [
      'إضافة وتعديل وترتيب وحذف الإعلانات والقوانين وملاحظات الجدول',
      'إدارة فئات الرعاة والوصف والمميزات (نصوص مبدئية)',
      'تحرير أسماء وأوصاف الفقرات باللغتين العربية والإنجليزية',
    ],
    cannotDoEn: [
      'Change segment point presets, timers, or delete/reorder segments',
      'Change scores, bracket, games, players, managers, or settings',
      'Access Gate Check-In, Results Feed, or Audit Log',
    ],
    cannotDoAr: [
      'تعديل نقاط الفقرات أو مؤقتاتها أو حذفها أو تغيير ترتيبها',
      'تعديل النقاط أو شجرة البطولة أو اللاعبين أو المديرين أو الإعدادات',
      'دخول بوابة الحضور أو سجل النتائج أو سجل المراجعة',
    ],
    routes: ['/admin', '/admin/content', '/admin/sponsors', '/admin/segments'],
  },
];

export function resolveActorUser(
  db: DatabaseSnapshot,
  actorUserId?: string | null
): User | null {
  if (!actorUserId) return null;
  return db.users.find((u) => u.id === actorUserId) ?? null;
}

export function canRolePerformAction(
  role: UserRole | null,
  action: RepoAction
): boolean {
  if (!role) return false;
  if (role === 'superAdmin') return true;

  switch (action) {
    case 'player.checkIn':
      return role === 'checkIn';
    case 'segment.editCopy':
    case 'content.manage':
    case 'sponsor.manage':
      return role === 'content';
    case 'game.operate':
    case 'score.operate':
      return role === 'scorer';
    case 'game.reopen':
      return REOPEN_GAME_MANAGER_ROLES.includes(role);
    case 'score.manageHistory':
      return SCORE_HISTORY_MANAGER_ROLES.includes(role);
    case 'player.manage':
    case 'user.manage':
    case 'bracket.manage':
    case 'segment.manage':
    case 'settings.manage':
    case 'audit.read':
    case 'results.read':
      return false;
    default:
      return false;
  }
}

export function assertRepoPermission(
  db: DatabaseSnapshot,
  actorUserId: string | null | undefined,
  action: RepoAction,
  context?: { game?: Game | null }
): User | null {
  // Interactive landing-page exhibition demo table is intentionally open to visitors/pitch presenters
  if (
    context?.game?.isDemo &&
    (action === 'game.operate' || action === 'score.operate')
  ) {
    return resolveActorUser(db, actorUserId);
  }

  const actor = resolveActorUser(db, actorUserId);
  const role = actor?.role ?? null;

  if (!actor || !role) {
    throw new PermissionDeniedError(
      action,
      null,
      `Authentication required to perform "${action}".`
    );
  }

  if (role === 'superAdmin') {
    return actor;
  }

  if (!canRolePerformAction(role, action)) {
    throw new PermissionDeniedError(action, role);
  }

  // Enforce scorer table isolation per AGENTS.md §4 ("Cannot edit other scorers' games")
  if (
    (action === 'game.operate' || action === 'score.operate') &&
    role === 'scorer' &&
    context?.game &&
    context.game.scorerUserId !== actor.id
  ) {
    throw new PermissionDeniedError(
      action,
      role,
      `Scorer "${actor.name}" is not assigned to game "${context.game.tableName}".`
    );
  }

  return actor;
}
