import type {
  DatabaseSnapshot,
  Match,
  ScoreEvent,
  User,
  UserRole,
} from '@/lib/schemas';

/**
 * Centralized Scoring History, Match Lifecycle & Consistency Permissions
 * Aligned 1:1 with AGENTS.md §4 and §15.5.
 */
export const SCORE_HISTORY_MANAGER_ROLES: readonly UserRole[] = ['superAdmin'];
export const REOPEN_GAME_MANAGER_ROLES: readonly UserRole[] = ['superAdmin'];

export type RepoAction =
  | 'player.manage'
  | 'player.checkIn'
  | 'player.updateOwnAvatar'
  | 'player.updateOwnProfile'
  | 'user.manage'
  | 'bracket.manage'
  | 'game.operate'
  | 'match.operate'
  | 'game.reopen'
  | 'match.reopen'
  | 'match.override'
  | 'match.resolveReview'
  | 'score.operate'
  | 'score.manageHistory'
  | 'absence.reverse'
  | 'segment.manage'
  | 'segment.editCopy'
  | 'content.manage'
  | 'sponsor.manage'
  | 'settings.manage'
  | 'audit.read'
  | 'results.read'
  | 'consistency.check'
  | 'consistency.repair'
  | 'contact.viewPlayer'
  | 'contact.viewJudge';

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

export const MANAGER_ROLE_SPECS: RoleCapabilitySpec[] = [
  {
    role: 'superAdmin',
    titleEn: 'Super Admin',
    titleAr: 'مدير البطولة (صلاحية كاملة)',
    summaryEn:
      'Complete operational authority across players, groups, knockout bracket, overrides, Impact Preview, Consistency check, and settings.',
    summaryAr:
      'صلاحية تشغيلية كاملة على اللاعبين، المجموعات، التصفيات، التعديلات الإدارية، معاينة الأثر، فحص التناسق، والإعدادات.',
    canDoEn: [
      'Create, edit, delete, and CSV-import players & manage avatars',
      'Draw/re-draw groups, configure tournament settings, and manage knockouts',
      'Run or reopen any match, apply overrides, reverse absences, and confirm Impact Preview cascades',
      'Run Consistency check and Repair by recomputation',
      'Inspect Results Feed, Audit Log (including automatic cascade entries), and export CSV',
      'View all player and judge contact cards',
    ],
    canDoAr: [
      'إضافة وتعديل وحذف اللاعبين والاستيراد الجماعي وإدارة الصور الشخصية',
      'سحب المجموعات وضبط إعدادات البطولة وإدارة الإقصائيات',
      'إدارة أي مباراة أو إعادة فتحها وتطبيق القرارات الإدارية ومعاينة أثر التعديلات',
      'تشغيل فحص التناسق وإصلاح البيانات بإعادة الحساب',
      'استعراض سجل النتائج وسجل المراجعة (شاملاً الحركات التلقائية) وتصدير CSV',
      'عرض بيانات التواصل لجميع اللاعبين والحكام',
    ],
    cannotDoEn: ['No restrictions — full studio access'],
    cannotDoAr: ['لا توجد قيود — وصول كامل لجميع الأدوات'],
    routes: ['/admin/*', '/scorer/*', '/screen/*'],
  },
  {
    role: 'scorer',
    titleEn: 'Table Judge / Scorer',
    titleAr: 'حكم طاولة',
    summaryEn:
      'Runs assigned 1v1 matches (or 3-player Grand Final) with +1/−1 points, Yellow/Red cards, absence walkovers, buzzes, and player contact cards.',
    summaryAr:
      'يدير مبارياته المخصصة (١ ضد ١ أو النهائي الثلاثي) بنقاط +١/−١، البطاقات الصفراء والحمراء، تسجيل الغياب، الجرس، وبيانات التواصل.',
    canDoEn: [
      'View assigned matches on /scorer',
      'Start assigned match, run segment timer, advance segments',
      'Tap "Buzzed First", apply +1/−1 points, Yellow (−1) and Red (−2) cards with notes',
      'Undo own last scoring action and trigger Sudden-Death Tie-Breaker #16',
      'Mark a player absent (triggers walkover in 1v1) and view contact cards of players in assigned matches',
    ],
    canDoAr: [
      'عرض المباريات المخصصة له فقط في لوحة الحكم',
      'بدء المباراة وتشغيل المؤقت والانتقال بين الفقرات',
      'تسجيل الجرس، إضافة/خصم نقطة، منح بطاقة صفراء (−١) أو حمراء (−٢) مع ملاحظة',
      'التراجع عن آخر حركة نقاط خاصة به وفتح جولة الحسم عند التعادل',
      'تسجيل غياب لاعب في مبارياته والاطلاع على بيانات التواصل الخاصة بهم',
    ],
    cannotDoEn: [
      'Access, score, or view contact info for other judges’ matches',
      'Reverse absences, override results, or edit bracket/players/settings',
      'Access Admin Studio pages, Consistency check, Results Feed, or Audit Log',
    ],
    cannotDoAr: [
      'الوصول لمباريات حكام آخرين أو عرض بيانات تواصل لاعبيهم',
      'إلغاء الغياب أو تعديل شجرة البطولة أو اللاعبين أو الإعدادات',
      'دخول صفحات إدارة البطولة أو فحص التناسق أو سجل المراجعة',
    ],
    routes: ['/scorer', '/scorer/[gameId]'],
  },
  {
    role: 'checkIn',
    titleEn: 'Check-In Staff',
    titleAr: 'مسؤول تسجيل الحضور',
    summaryEn:
      'Operates the venue arrival gate for scheduled matches and contestant attendance with access to player contact cards.',
    summaryAr:
      'يدير بوابة استقبال المتسابقين لمباريات اليوم وتأكيد حضورهم أو غيابهم مع إمكانية التواصل مع المتأخرين.',
    canDoEn: [
      'View Admin Overview and today’s scheduled matches',
      'View player contact details for gate check-in follow-up',
      'Mark contestants as Checked In, Absent, or Registered via check-in events',
    ],
    canDoAr: [
      'عرض نظرة عامة وجدول مباريات اليوم',
      'عرض بيانات تواصل اللاعبين لمتابعة الحضور عند البوابة',
      'تحديث حالة الوصول إلى «تم الحضور» أو «غائب» أو «مسجّل»',
    ],
    cannotDoEn: [
      'Create, edit profile details, or delete players',
      'Change scores, cards, bracket, matches, or settings',
      'Manage users, content, sponsors, Consistency check, or read Audit Log',
    ],
    cannotDoAr: [
      'إضافة لاعبين جدد أو تعديل بياناتهم أو حذفهم',
      'تعديل النقاط أو البطاقات أو شجرة البطولة أو الإعدادات',
      'إدارة المديرين أو المحتوى أو الرعاة أو فحص التناسق أو سجل المراجعة',
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
      'Change segment timers, categories, or delete/reorder segments',
      'Change scores, bracket, matches, players, managers, or settings',
      'View player contacts, Gate Check-In, Results Feed, Consistency check, or Audit Log',
    ],
    cannotDoAr: [
      'تعديل مؤقتات الفقرات أو فئاتها أو حذفها أو تغيير ترتيبها',
      'تعديل النقاط أو شجرة البطولة أو اللاعبين أو المديرين أو الإعدادات',
      'عرض بيانات التواصل أو بوابة الحضور أو سجل النتائج أو المراجعة',
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
    case 'contact.viewPlayer':
      return role === 'checkIn' || role === 'scorer';
    case 'contact.viewJudge':
      return role === 'player' || role === 'scorer';
    case 'player.updateOwnAvatar':
    case 'player.updateOwnProfile':
      return role === 'player';
    case 'segment.editCopy':
    case 'content.manage':
    case 'sponsor.manage':
      return role === 'content';
    case 'game.operate':
    case 'match.operate':
    case 'score.operate':
      return role === 'scorer';
    case 'game.reopen':
    case 'match.reopen':
      return REOPEN_GAME_MANAGER_ROLES.includes(role);
    case 'score.manageHistory':
      return SCORE_HISTORY_MANAGER_ROLES.includes(role);
    case 'player.manage':
    case 'user.manage':
    case 'bracket.manage':
    case 'match.override':
    case 'match.resolveReview':
    case 'absence.reverse':
    case 'segment.manage':
    case 'settings.manage':
    case 'audit.read':
    case 'results.read':
    case 'consistency.check':
    case 'consistency.repair':
      return false;
    default:
      return false;
  }
}

export function assertRepoPermission(
  db: DatabaseSnapshot,
  actorUserId: string | null | undefined,
  action: RepoAction,
  context?: {
    game?: Match | null;
    match?: Match | null;
    targetPlayerId?: string;
    targetJudgeId?: string;
  }
): User | null {
  const match = context?.match ?? context?.game ?? null;

  // Interactive landing-page exhibition demo table is intentionally open to visitors/pitch presenters
  if (
    match?.isDemo &&
    (action === 'game.operate' ||
      action === 'match.operate' ||
      action === 'score.operate')
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

  // Enforce scorer/judge match isolation (AGENTS.md §4 & §15.5)
  if (
    (action === 'game.operate' ||
      action === 'match.operate' ||
      action === 'score.operate') &&
    role === 'scorer' &&
    match &&
    match.judgeUserId !== actor.id
  ) {
    throw new PermissionDeniedError(
      action,
      role,
      `Judge "${actor.name}" is not assigned to match "${match.tableName}".`
    );
  }

  // Enforce player contact visibility (AGENTS.md §15.5):
  // Scorers ONLY see contact info for players in their assigned matches!
  if (action === 'contact.viewPlayer' && role === 'scorer') {
    const pid = context?.targetPlayerId;
    const isAssigned = Boolean(
      pid &&
        db.matches.some(
          (m) =>
            m.judgeUserId === actor.id &&
            m.participants.some((p) => p.playerId === pid)
        )
    );
    if (!isAssigned) {
      throw new PermissionDeniedError(
        action,
        role,
        `Judge "${actor.name}" may only view contact details for players in assigned matches.`
      );
    }
  }

  // Enforce judge contact visibility for players (AGENTS.md §15.3 & §15.5):
  // Players ONLY see the judge contact for their own upcoming/live match!
  if (action === 'contact.viewJudge' && role === 'player') {
    const jid = context?.targetJudgeId;
    const isOwnMatchJudge = Boolean(
      jid &&
        actor.playerId &&
        db.matches.some(
          (m) =>
            m.judgeUserId === jid &&
            (m.status === 'scheduled' || m.status === 'live') &&
            m.participants.some((p) => p.playerId === actor.playerId)
        )
    );
    if (!isOwnMatchJudge) {
      throw new PermissionDeniedError(
        action,
        role,
        'Players may only view judge contact details for their own upcoming or live match.'
      );
    }
  }

  // Player updating their own avatar or profile only
  if (
    (action === 'player.updateOwnAvatar' ||
      action === 'player.updateOwnProfile') &&
    role === 'player' &&
    (!context?.targetPlayerId || actor.playerId !== context.targetPlayerId)
  ) {
    throw new PermissionDeniedError(
      action,
      role,
      'Players may only update their own profile and avatar.'
    );
  }

  return actor;
}

/**
 * Resolves the effective viewer role from either an explicit viewerRole
 * or an actorUserId looked up against db.users.
 */
export function resolveViewerRole(
  db: DatabaseSnapshot,
  options?: {
    viewerRole?: UserRole | 'visitor' | null;
    actorUserId?: string | null;
  }
): UserRole | 'visitor' | null {
  if (options?.viewerRole) {
    return options.viewerRole;
  }
  if (options?.actorUserId) {
    const actor = resolveActorUser(db, options.actorUserId);
    return actor?.role ?? 'visitor';
  }
  return null;
}

/**
 * Repository-level segment secrecy filter (AGENTS.md §15.3):
 * Players and public visitors MUST NOT receive segment names/order/IDs for upcoming or live matches
 * so segments stay a surprise until finished (or shown live on venue Big Screen).
 */
export function redactMatchForRole(
  match: Match,
  role?: UserRole | 'visitor' | null
): Match {
  if (
    !role ||
    role === 'superAdmin' ||
    role === 'scorer' ||
    role === 'content' ||
    role === 'checkIn'
  ) {
    return match;
  }
  // For 'player' role (and public 'visitor' reads):
  // Hide segment lineup on matches that are NOT finished!
  if (match.status !== 'finished' && !match.isDemo) {
    return {
      ...match,
      segmentIds: [],
      currentSegmentIndex: 0,
    };
  }
  return match;
}

/**
 * Repository-level score event segment redaction (AGENTS.md §15.3):
 * For 'player' and 'visitor' roles, hides segmentId on ScoreEvents belonging
 * to unfinished matches so live score events cannot leak the active segment.
 */
export function redactScoreEventForRole(
  event: ScoreEvent,
  match: Match | undefined | null,
  role?: UserRole | 'visitor' | null
): ScoreEvent {
  if (
    !role ||
    role === 'superAdmin' ||
    role === 'scorer' ||
    role === 'content' ||
    role === 'checkIn'
  ) {
    return event;
  }
  if (!match || (match.status !== 'finished' && !match.isDemo)) {
    return {
      ...event,
      segmentId: '',
    };
  }
  return event;
}
