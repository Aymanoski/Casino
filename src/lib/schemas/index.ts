import { z } from 'zod';

export const LanguageSchema = z.enum(['en', 'ar']);
export type Language = z.infer<typeof LanguageSchema>;

export const LocalizedStringSchema = z.object({
  en: z.string(),
  ar: z.string(),
});
export type LocalizedString = z.infer<typeof LocalizedStringSchema>;

// Deterministic library of 24 3D-style fallback avatar keys (AGENTS.md §15.3)
export const AVATAR_LIBRARY_KEYS = [
  'avatar-01',
  'avatar-02',
  'avatar-03',
  'avatar-04',
  'avatar-05',
  'avatar-06',
  'avatar-07',
  'avatar-08',
  'avatar-09',
  'avatar-10',
  'avatar-11',
  'avatar-12',
  'avatar-13',
  'avatar-14',
  'avatar-15',
  'avatar-16',
  'avatar-17',
  'avatar-18',
  'avatar-19',
  'avatar-20',
  'avatar-21',
  'avatar-22',
  'avatar-23',
  'avatar-24',
] as const;

export const MARWAN_PLAYER_ID = 'player-marwan';

// 1. Contact & Avatar (AGENTS.md §15.5)
export const PlayerContactSchema = z.object({
  phone: z.string(),
  whatsapp: z.string(),
  email: z.string().email(),
});
export type PlayerContact = z.infer<typeof PlayerContactSchema>;

export const AvatarSchema = z.object({
  photoUrl: z.string().nullable().optional(),
  avatarKey: z.string(),
});
export type Avatar = z.infer<typeof AvatarSchema>;

// 2. Player
export const PlayerStatusSchema = z.enum([
  'registered',
  'checkedIn',
  'absent',
  'active',
  'eliminated',
  'finalist',
]);
export type PlayerStatus = z.infer<typeof PlayerStatusSchema>;

export const CheckInStatusSchema = z.enum(['registered', 'checkedIn', 'absent']);
export type CheckInStatus = z.infer<typeof CheckInStatusSchema>;

export const PlayerStatsSchema = z.object({
  matchesPlayed: z.number().int().nonnegative().default(0),
  /** Compatibility alias of matchesPlayed for existing UI components */
  gamesPlayed: z.number().int().nonnegative().default(0),
  wins: z.number().int().nonnegative().default(0),
  losses: z.number().int().nonnegative().default(0),
  totalPoints: z.number().int().default(0),
  groupPoints: z.number().int().nonnegative().default(0),
  yellowCards: z.number().int().nonnegative().default(0),
  redCards: z.number().int().nonnegative().default(0),
  absences: z.number().int().nonnegative().default(0),
});
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;

export const PlayerSchema = z.object({
  id: z.string(),
  fullName: z.string().min(1),
  fullNameAr: z.string().default(''),
  nickname: z.string().min(1),
  nicknameAr: z.string().default(''),
  avatarSeed: z.string(),
  avatar: AvatarSchema,
  contact: PlayerContactSchema,
  /** Convenience mirrors of contact.phone / contact.email */
  phone: z.string(),
  email: z.string().email(),
  seed: z.number().int().nonnegative(),
  /** True for Marwan Serry guest finalist (excluded from rankings/standings/stats) */
  isGuest: z.boolean().default(false),
  /** Compatibility alias of isGuest */
  isHost: z.boolean().optional().default(false),
  /**
   * Engine-materialized projections (NEVER written directly outside /lib/engine & /lib/commands).
   * Always 100% recomputable from the append-only event log.
   */
  status: PlayerStatusSchema,
  stats: PlayerStatsSchema,
  createdAt: z.string(),
});
export type Player = z.infer<typeof PlayerSchema>;

// 3. User
export const UserRoleSchema = z.enum([
  'superAdmin',
  'scorer',
  'checkIn',
  'content',
  'player',
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  nameAr: z.string().default(''),
  email: z.string().email(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  role: UserRoleSchema,
  playerId: z.string().optional(),
  language: LanguageSchema.default('en'),
  titleEn: z.string().optional(),
  titleAr: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

// 4. Group (AGENTS.md §15.1 & §15.5)
export const GroupSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  nameEn: z.string(),
  nameAr: z.string(),
  roundId: z.string().default('round-groups'),
  playerIds: z.array(z.string()),
});
export type Group = z.infer<typeof GroupSchema>;

// 5. Round
export const RoundStatusSchema = z.enum(['upcoming', 'live', 'done']);
export type RoundStatus = z.infer<typeof RoundStatusSchema>;

export const RoundStageSchema = z.enum(['group', 'knockout', 'final']);
export type RoundStage = z.infer<typeof RoundStageSchema>;

export const RoundSchema = z.object({
  id: z.string(),
  name: LocalizedStringSchema,
  order: z.number().int().positive(),
  stage: RoundStageSchema.default('knockout'),
  advancePerGame: z.number().int().positive().default(1),
  /** Engine-derived status */
  status: RoundStatusSchema,
});
export type Round = z.infer<typeof RoundSchema>;

// 6. Segment
export const SegmentCategorySchema = z.enum([
  'music',
  'wordplay',
  'popculture',
  'general',
  'special',
]);
export type SegmentCategory = z.infer<typeof SegmentCategorySchema>;

export const SegmentSchema = z.object({
  id: z.string(),
  nameEn: z.string().min(1),
  nameAr: z.string().min(1),
  category: SegmentCategorySchema,
  descriptionEn: z.string(),
  descriptionAr: z.string(),
  durationSec: z.number().int().positive().optional(),
  /** Retained for metadata/legacy views; Scorer Console v2 uses +1/-1/Yellow/Red */
  presetPoints: z.array(z.number().int()).default([1, -1]),
  order: z.number().int().positive(),
});
export type Segment = z.infer<typeof SegmentSchema>;

// 7. Match (replaces Game per AGENTS.md §15.1 & §15.5)
export const MatchTypeSchema = z.enum(['group', 'knockout', 'final']);
export type MatchType = z.infer<typeof MatchTypeSchema>;

export const MatchStatusSchema = z.enum([
  'scheduled',
  'live',
  'needsTieBreak',
  'finished',
  'void',
  'needsReview',
]);
export type MatchStatus = z.infer<typeof MatchStatusSchema>;
/** Compatibility alias */
export const GameStatusSchema = MatchStatusSchema;
export type GameStatus = MatchStatus;

export const MatchTimerStateSchema = z.object({
  status: z.enum(['idle', 'running', 'paused']),
  durationSec: z.number().int().nonnegative(),
  remainingSec: z.number().int().nonnegative(),
  endsAt: z.string().nullable().optional(),
});
export type MatchTimerState = z.infer<typeof MatchTimerStateSchema>;
export type GameTimerState = MatchTimerState;

export const MatchFeederSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), playerId: z.string() }),
  z.object({ kind: z.literal('guest'), playerId: z.string() }),
  z.object({
    kind: z.literal('group'),
    groupId: z.string(),
    groupNumber: z.number().int().positive(),
    rank: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('match'),
    matchId: z.string(),
    outcome: z.literal('winner'),
  }),
  z.object({
    kind: z.literal('bestGroupWinner'),
    byeRankIndex: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('remainingGroupQualifier'),
    qualifierIndex: z.number().int().nonnegative(),
  }),
  z.object({ kind: z.literal('bye') }),
]);
export type MatchFeeder = z.infer<typeof MatchFeederSchema>;

export const MatchParticipantSchema = z.object({
  slotIndex: z.number().int().nonnegative(),
  playerId: z.string().nullable(),
  guest: z.boolean().optional(),
  isBye: z.boolean().optional(),
  placeholderLabelEn: z.string().optional(),
  placeholderLabelAr: z.string().optional(),
  feeder: MatchFeederSchema.optional(),
});
export type MatchParticipant = z.infer<typeof MatchParticipantSchema>;

export const MatchResultTypeSchema = z.enum(['normal', 'walkover', 'void']);
export type MatchResultType = z.infer<typeof MatchResultTypeSchema>;

export const MatchResultReasonSchema = z.enum([
  'score',
  'absence',
  'bye',
  'override',
  'both_absent',
]);
export type MatchResultReason = z.infer<typeof MatchResultReasonSchema>;

export const MatchResultSchema = z.object({
  type: MatchResultTypeSchema,
  winnerId: z.string().optional(),
  reason: MatchResultReasonSchema.optional(),
  overridden: z.boolean().optional(),
});
export type MatchResult = z.infer<typeof MatchResultSchema>;

export const MatchSchema = z.object({
  id: z.string(),
  type: MatchTypeSchema,
  groupId: z.string().optional(),
  roundId: z.string(),
  round: z.number().int().positive(),
  slot: z.number().int().positive(),
  isGroupTieBreak: z.boolean().optional(),
  participants: z.array(MatchParticipantSchema).min(2),
  /** Engine-synced projection of participant IDs / placeholder tokens */
  playerIds: z.array(z.string()).min(2),
  tableNumber: z.number().int().positive(),
  tableName: z.string(),
  tableNameAr: z.string().default(''),
  scheduledAt: z.string(),
  judgeUserId: z.string(),
  /** Compatibility alias mirroring judgeUserId */
  scorerUserId: z.string(),
  segmentIds: z.array(z.string()).min(1),
  currentSegmentIndex: z.number().int().nonnegative(),
  /** Engine-derived fields (NEVER written directly outside /lib/engine & /lib/commands) */
  status: MatchStatusSchema,
  result: MatchResultSchema.nullable().optional(),
  winnerPlayerId: z.string().optional(),
  advancingPlayerIds: z.array(z.string()).optional(),
  needsReviewReason: z.string().optional(),
  isFinal: z.boolean().default(false),
  isDemo: z.boolean().optional().default(false),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  activeBuzzPlayerId: z.string().nullable().optional(),
  timer: MatchTimerStateSchema.optional(),
  podOrder: z.number().int().positive().optional(),
  /** Incremented when invalidated for replay so old events stay in append-only log */
  replayEpoch: z.number().int().nonnegative().default(0),
  /** Optimistic concurrency control version number */
  version: z.number().int().positive().default(1),
});
export type Match = z.infer<typeof MatchSchema>;
/** Compatibility aliases during CR1 incremental migration */
export const GameSchema = MatchSchema;
export type Game = Match;

// 8. Append-Only Event Log Entities (Single Source of Truth — AGENTS.md §15.4 & §15.5)

export const ScoreEventKindSchema = z.enum(['point', 'yellow', 'red', 'undo']);
export type ScoreEventKind = z.infer<typeof ScoreEventKindSchema>;

export const ScoreEventSchema = z.object({
  id: z.string(),
  matchId: z.string(),
  /** Compatibility alias mirroring matchId */
  gameId: z.string(),
  segmentId: z.string(),
  playerId: z.string(),
  delta: z.number().int(),
  note: z.string().optional(),
  kind: ScoreEventKindSchema,
  byUserId: z.string(),
  /** Set on kind === 'undo' referencing the event being compensated */
  targetEventId: z.string().optional(),
  /** Derived/cached marker of the undo event that compensated this event */
  undoneByEventId: z.string().optional(),
  replayEpoch: z.number().int().nonnegative().optional().default(0),
  createdAt: z.string(),
});
export type ScoreEvent = z.infer<typeof ScoreEventSchema>;

export const AbsenceEventSchema = z.object({
  id: z.string(),
  matchId: z.string(),
  playerId: z.string(),
  action: z.enum(['marked', 'reversed']),
  reason: z.string().optional(),
  byUserId: z.string(),
  replayEpoch: z.number().int().nonnegative().optional().default(0),
  createdAt: z.string(),
});
export type AbsenceEvent = z.infer<typeof AbsenceEventSchema>;

export const BuzzEventSchema = z.object({
  id: z.string(),
  matchId: z.string(),
  /** Compatibility alias mirroring matchId */
  gameId: z.string(),
  segmentId: z.string(),
  playerId: z.string(),
  byUserId: z.string(),
  cleared: z.boolean().optional().default(false),
  replayEpoch: z.number().int().nonnegative().optional().default(0),
  createdAt: z.string(),
});
export type BuzzEvent = z.infer<typeof BuzzEventSchema>;

export const MatchLifecycleEventTypeSchema = z.enum([
  'started',
  'finished',
  'reopened',
  'tieBreakerOpened',
  'segmentChanged',
  'overrideResult',
  'markedNeedsReview',
  'reviewResolved',
  'invalidatedForReplay',
]);
export type MatchLifecycleEventType = z.infer<typeof MatchLifecycleEventTypeSchema>;

export const MatchLifecycleEventSchema = z.object({
  id: z.string(),
  matchId: z.string(),
  type: MatchLifecycleEventTypeSchema,
  byUserId: z.string(),
  reason: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  replayEpoch: z.number().int().nonnegative().optional().default(0),
  createdAt: z.string(),
});
export type MatchLifecycleEvent = z.infer<typeof MatchLifecycleEventSchema>;

export const CheckInEventSchema = z.object({
  id: z.string(),
  playerId: z.string(),
  status: CheckInStatusSchema,
  byUserId: z.string(),
  createdAt: z.string(),
});
export type CheckInEvent = z.infer<typeof CheckInEventSchema>;

// 9. AuditEntry
export const AuditEntityTypeSchema = z.enum([
  'score',
  'buzz',
  'absence',
  'match',
  'game',
  'group',
  'cascade',
  'contact',
  'player',
  'bracket',
  'round',
  'segment',
  'user',
  'sponsor',
  'content',
  'settings',
  'system',
]);
export type AuditEntityType = z.infer<typeof AuditEntityTypeSchema>;

export const AuditEntrySchema = z.object({
  id: z.string(),
  actorUserId: z.string(),
  action: z.string(),
  entityType: AuditEntityTypeSchema,
  entityId: z.string(),
  summary: z.string(),
  summaryAr: z.string().optional(),
  before: z.record(z.unknown()).nullable().optional(),
  after: z.record(z.unknown()).nullable().optional(),
  automatic: z.boolean().optional().default(false),
  createdAt: z.string(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

// 10. Sponsor
export const SponsorTierSchema = z.enum([
  'presenting',
  'finalNight',
  'segment',
  'community',
]);
export type SponsorTier = z.infer<typeof SponsorTierSchema>;

export const SponsorSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameAr: z.string().default(''),
  tier: SponsorTierSchema,
  tierLabelEn: z.string(),
  tierLabelAr: z.string(),
  logoText: z.string(),
  blurb: z.string(),
  blurbAr: z.string().default(''),
  benefitsEn: z.array(z.string()).default([]),
  benefitsAr: z.array(z.string()).default([]),
  order: z.number().int().positive().default(1),
});
export type Sponsor = z.infer<typeof SponsorSchema>;

// 11. ContentItem
export const ContentCategorySchema = z.enum([
  'announcement',
  'rule',
  'scheduleBlurb',
  'pitchCopy',
]);
export type ContentCategory = z.infer<typeof ContentCategorySchema>;

export const ContentItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  category: ContentCategorySchema,
  titleEn: z.string(),
  titleAr: z.string(),
  bodyEn: z.string(),
  bodyAr: z.string(),
  badgeEn: z.string().optional(),
  badgeAr: z.string().optional(),
  order: z.number().int().nonnegative(),
  updatedAt: z.string(),
});
export type ContentItem = z.infer<typeof ContentItemSchema>;

// 12. Settings (AGENTS.md §15.1 & §15.5)
export const TournamentSettingsSchema = z.object({
  totalPlayers: z.number().int().min(4).max(2048).default(720),
  groupSize: z.number().int().min(2).max(8).default(3),
  advancePerGroup: z.number().int().min(1).max(4).default(1),
  pointsPerGroupWin: z.number().int().min(1).max(10).default(3),
  tablesCount: z.number().int().min(1).max(64).default(12),
  slotMinutes: z.number().int().min(5).max(180).default(30),
  includeFinalWithMarwan: z.boolean().default(true),
});
export type TournamentSettings = z.infer<typeof TournamentSettingsSchema>;

export const BracketConfigSchema = z.object({
  totalPlayers: z.number().int().positive(),
  playersPerGame: z.number().int().positive(),
  round1Games: z.number().int().positive(),
  round2Games: z.number().int().positive(),
  semiGames: z.number().int().positive(),
  semiAdvanceCount: z.number().int().positive(),
});
export type BracketConfig = z.infer<typeof BracketConfigSchema>;

export const SettingsSchema = z.object({
  id: z.string().default('global-settings'),
  eventName: z.string(),
  eventNameAr: z.string(),
  eventDates: z.string(),
  eventDatesAr: z.string(),
  finalNightIso: z.string(),
  venue: z.string(),
  venueAr: z.string(),
  prizeText: z.string(),
  prizeTextAr: z.string(),
  contactEmail: z.string(),
  defaultLanguage: LanguageSchema,
  useArabicIndicDigits: z.boolean().default(false),
  delightersEnabled: z.boolean().default(false),
  soundEnabled: z.boolean().default(false),
  tournament: TournamentSettingsSchema,
  /** Compatibility view derived from tournament settings */
  bracketConfig: BracketConfigSchema,
  updatedAt: z.string(),
});
export type Settings = z.infer<typeof SettingsSchema>;

// Full Database Snapshot Schema (v3 — CR1 Event-Sourced Architecture)
export const DatabaseSnapshotSchema = z.object({
  version: z.number(),
  players: z.array(PlayerSchema),
  users: z.array(UserSchema),
  groups: z.array(GroupSchema),
  rounds: z.array(RoundSchema),
  segments: z.array(SegmentSchema),
  matches: z.array(MatchSchema),
  scoreEvents: z.array(ScoreEventSchema),
  absenceEvents: z.array(AbsenceEventSchema),
  buzzEvents: z.array(BuzzEventSchema),
  matchEvents: z.array(MatchLifecycleEventSchema),
  checkInEvents: z.array(CheckInEventSchema),
  auditEntries: z.array(AuditEntrySchema),
  sponsors: z.array(SponsorSchema),
  contentItems: z.array(ContentItemSchema),
  settings: SettingsSchema,
});
export type DatabaseSnapshot = z.infer<typeof DatabaseSnapshotSchema>;
