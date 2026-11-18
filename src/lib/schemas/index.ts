import { z } from 'zod';

export const LanguageSchema = z.enum(['en', 'ar']);
export type Language = z.infer<typeof LanguageSchema>;

export const LocalizedStringSchema = z.object({
  en: z.string(),
  ar: z.string(),
});
export type LocalizedString = z.infer<typeof LocalizedStringSchema>;

// 1. Player
export const PlayerStatusSchema = z.enum([
  'registered',
  'checkedIn',
  'absent',
  'active',
  'eliminated',
  'finalist',
]);
export type PlayerStatus = z.infer<typeof PlayerStatusSchema>;

export const PlayerStatsSchema = z.object({
  gamesPlayed: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  totalPoints: z.number().int(),
});
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;

export const PlayerSchema = z.object({
  id: z.string(),
  fullName: z.string().min(1),
  fullNameAr: z.string().default(''),
  nickname: z.string().min(1),
  nicknameAr: z.string().default(''),
  avatarSeed: z.string(),
  phone: z.string(),
  email: z.string().email(),
  status: PlayerStatusSchema,
  seed: z.number().int().nonnegative(),
  isHost: z.boolean().optional().default(false),
  stats: PlayerStatsSchema,
  createdAt: z.string(),
});
export type Player = z.infer<typeof PlayerSchema>;

// 2. User
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
  role: UserRoleSchema,
  playerId: z.string().optional(),
  language: LanguageSchema.default('en'),
  titleEn: z.string().optional(),
  titleAr: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

// 3. Round
export const RoundStatusSchema = z.enum(['upcoming', 'live', 'done']);
export type RoundStatus = z.infer<typeof RoundStatusSchema>;

export const RoundSchema = z.object({
  id: z.string(),
  name: LocalizedStringSchema,
  order: z.number().int().positive(),
  advancePerGame: z.number().int().positive(),
  status: RoundStatusSchema,
});
export type Round = z.infer<typeof RoundSchema>;

// 4. Segment
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
  presetPoints: z.array(z.number().int()),
  order: z.number().int().positive(),
});
export type Segment = z.infer<typeof SegmentSchema>;

// 5. Game ("Session")
export const GameStatusSchema = z.enum(['scheduled', 'live', 'finished']);
export type GameStatus = z.infer<typeof GameStatusSchema>;

export const GameTimerStateSchema = z.object({
  status: z.enum(['idle', 'running', 'paused']),
  durationSec: z.number().int().nonnegative(),
  remainingSec: z.number().int().nonnegative(),
  endsAt: z.string().nullable().optional(),
});
export type GameTimerState = z.infer<typeof GameTimerStateSchema>;

export const GameSchema = z.object({
  id: z.string(),
  roundId: z.string(),
  tableName: z.string(),
  tableNameAr: z.string().default(''),
  scheduledAt: z.string(),
  status: GameStatusSchema,
  scorerUserId: z.string(),
  playerIds: z.tuple([z.string(), z.string(), z.string()]),
  currentSegmentIndex: z.number().int().nonnegative(),
  segmentIds: z.array(z.string()).min(1),
  winnerPlayerId: z.string().optional(),
  advancingPlayerIds: z.array(z.string()).optional(),
  isFinal: z.boolean().default(false),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  activeBuzzPlayerId: z.string().nullable().optional(),
  timer: GameTimerStateSchema.optional(),
  podOrder: z.number().int().positive().optional(),
  isDemo: z.boolean().optional(),
});
export type Game = z.infer<typeof GameSchema>;

// 6. ScoreEvent
export const ScoreEventKindSchema = z.enum(['preset', 'custom', 'undo']);
export type ScoreEventKind = z.infer<typeof ScoreEventKindSchema>;

export const ScoreEventSchema = z.object({
  id: z.string(),
  gameId: z.string(),
  segmentId: z.string(),
  playerId: z.string(),
  delta: z.number().int(),
  note: z.string().optional(),
  kind: ScoreEventKindSchema,
  byUserId: z.string(),
  undoneByEventId: z.string().optional(),
  targetEventId: z.string().optional(),
  createdAt: z.string(),
});
export type ScoreEvent = z.infer<typeof ScoreEventSchema>;

// 7. BuzzEvent
export const BuzzEventSchema = z.object({
  id: z.string(),
  gameId: z.string(),
  segmentId: z.string(),
  playerId: z.string(),
  byUserId: z.string(),
  cleared: z.boolean().optional().default(false),
  createdAt: z.string(),
});
export type BuzzEvent = z.infer<typeof BuzzEventSchema>;

// 8. AuditEntry
export const AuditEntityTypeSchema = z.enum([
  'score',
  'buzz',
  'game',
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
  createdAt: z.string(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

// 9. Sponsor
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

// 10. ContentItem
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

// 11. Settings
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
  bracketConfig: BracketConfigSchema,
  updatedAt: z.string(),
});
export type Settings = z.infer<typeof SettingsSchema>;

// Full Database Snapshot Schema
export const DatabaseSnapshotSchema = z.object({
  version: z.number(),
  players: z.array(PlayerSchema),
  users: z.array(UserSchema),
  rounds: z.array(RoundSchema),
  segments: z.array(SegmentSchema),
  games: z.array(GameSchema),
  scoreEvents: z.array(ScoreEventSchema),
  buzzEvents: z.array(BuzzEventSchema),
  auditEntries: z.array(AuditEntrySchema),
  sponsors: z.array(SponsorSchema),
  contentItems: z.array(ContentItemSchema),
  settings: SettingsSchema,
});
export type DatabaseSnapshot = z.infer<typeof DatabaseSnapshotSchema>;
