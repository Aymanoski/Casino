import type {
  AbsenceEvent,
  BuzzEvent,
  CheckInEvent,
  Group,
  Match,
  MatchLifecycleEvent,
  MatchResult,
  MatchStatus,
  Player,
  PlayerStats,
  PlayerStatus,
  Round,
  ScoreEvent,
  TournamentSettings,
} from '@/lib/schemas';

export interface ParticipantScoreSummary {
  playerId: string;
  points: number;
  yellowCards: number;
  redCards: number;
  absent: boolean;
  guest: boolean;
  rank: number;
}

export interface ComputedMatchOutcome {
  matchId: string;
  status: MatchStatus;
  result: MatchResult | null;
  standings: ParticipantScoreSummary[];
  totals: Record<string, number>;
  yellowCardsByPlayer: Record<string, number>;
  redCardsByPlayer: Record<string, number>;
  absentPlayerIds: string[];
  tiedPlayerIds: string[];
  /** True when a final match has an absent finalist or both 1v1 players are absent */
  requiresAdminDecision: boolean;
  activeBuzzPlayerId: string | null;
  startedAt?: string;
  finishedAt?: string;
  needsReviewReason?: string;
}

export type GroupTieBreakReason =
  | 'points'
  | 'h2h'
  | 'pointsDiff'
  | 'cards'
  | 'tieBreakMatch'
  | 'deadlock';

export interface GroupStandingRow {
  playerId: string;
  rank: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  groupPoints: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  redCards: number;
  yellowCards: number;
  absences: number;
  qualified: boolean;
  tiedForCutoff: boolean;
  tieBreakReason?: GroupTieBreakReason;
}

export interface ComputedGroupStandings {
  groupId: string;
  groupNumber: number;
  isComplete: boolean;
  regularMatchesTotal: number;
  regularMatchesFinished: number;
  rows: GroupStandingRow[];
  qualifierPlayerIds: string[];
  needsTieBreakMatch: boolean;
  tiedCutoffPlayerIds: string[];
  tieBreakApplied: GroupTieBreakReason;
  hasThreeWayCycle: boolean;
}

export interface ScheduleConflict {
  kind: 'player' | 'table' | 'judge';
  matchId: string;
  conflictingMatchId: string;
  conflictingTableName: string;
  conflictingTableNameAr: string;
  resourceId: string;
  slotStartIso: string;
  messageEn: string;
  messageAr: string;
}

export interface SettingsImpactPreview {
  tier: 'none' | 'scoring' | 'schedule' | 'structural';
  requiresConfirmation: boolean;
  tournamentStarted: boolean;
  affectedScheduledCount: number;
  affectedActiveOrFinishedCount: number;
  affectedGroupsCount: number;
  cascadeImpact?: CascadeImpact;
  summaryEn: string;
  summaryAr: string;
}

export interface QualifierSlot {
  groupId: string;
  groupNumber: number;
  groupRank: number;
  playerId: string | null;
  groupPoints: number;
  pointsDiff: number;
  pointsFor: number;
  redCards: number;
  yellowCards: number;
  placeholderLabelEn: string;
  placeholderLabelAr: string;
}

export interface ByeAllocation {
  bracketSize: number;
  qualifierCount: number;
  byesCount: number;
  allGroupsComplete: boolean;
  /** Qualifiers ranked best-first who receive a Round 1 BYE */
  byeRecipients: QualifierSlot[];
  /** Remaining qualifiers who play Round 1 1v1 matches in group-number / rank order */
  round1PlayIn: QualifierSlot[];
}

export interface TournamentEngineInput {
  players: Player[];
  groups: Group[];
  rounds: Round[];
  matches: Match[];
  scoreEvents: ScoreEvent[];
  absenceEvents: AbsenceEvent[];
  buzzEvents: BuzzEvent[];
  matchEvents: MatchLifecycleEvent[];
  checkInEvents: CheckInEvent[];
  settings: TournamentSettings;
}

export interface CascadeAffectedMatch {
  matchId: string;
  tableName: string;
  tableNameAr: string;
  roundId: string;
  currentStatus: MatchStatus;
  beforeParticipantIds: Array<string | null>;
  expectedParticipantIds: Array<string | null>;
  action: 'auto_update' | 'needs_review' | 'invalidate_replay';
  reasonEn: string;
  reasonAr: string;
}

export interface CascadeWinnerChange {
  matchId: string;
  tableName: string;
  beforeStatus: MatchStatus;
  afterStatus: MatchStatus;
  beforeWinnerId: string | null;
  afterWinnerId: string | null;
}

export interface CascadeImpact {
  hasImpact: boolean;
  requiresConfirmation: boolean;
  winnerChanges: CascadeWinnerChange[];
  affectedMatches: CascadeAffectedMatch[];
  autoUpdatedMatches: CascadeAffectedMatch[];
  reviewRequiredMatches: CascadeAffectedMatch[];
  summaryEn: string;
  summaryAr: string;
}

export interface PropagationOutput {
  matches: Match[];
  rounds: Round[];
  players: Player[];
  matchOutcomes: Map<string, ComputedMatchOutcome>;
  groupStandings: Map<string, ComputedGroupStandings>;
  qualifiers: QualifierSlot[];
  byeAllocation: ByeAllocation;
  playerStatsMap: Map<string, PlayerStats>;
  playerStatusMap: Map<string, PlayerStatus>;
  cascadeChanges: CascadeAffectedMatch[];
  winnerChanges: CascadeWinnerChange[];
}

export type InvariantCode =
  | 'FINISHED_MATCH_SINGLE_VALID_WINNER'
  | 'NO_FINISHED_MATCH_TIED'
  | 'FINISHED_GROUP_COMPLETE_STANDINGS'
  | 'QUALIFIERS_MATCH_TOP_N'
  | 'KNOCKOUT_PARTICIPANTS_MATCH_FEEDERS'
  | 'PLAYER_AT_MOST_ONE_LIVE_MATCH'
  | 'STORED_STATS_MATCH_RECOMPUTED'
  | 'NO_ORPHAN_EVENTS'
  | 'MARWAN_EXCLUDED_FROM_STANDINGS';

export interface InvariantViolation {
  code: InvariantCode;
  severity: 'error' | 'warning';
  entityType: 'match' | 'group' | 'player' | 'event' | 'round';
  entityId: string;
  messageEn: string;
  messageAr: string;
  details?: Record<string, unknown>;
}

export interface ConsistencyReport {
  ok: boolean;
  checkedAt: string;
  totalChecks: number;
  violations: InvariantViolation[];
  summary: {
    matchesChecked: number;
    groupsChecked: number;
    playersChecked: number;
    eventsChecked: number;
    errorCount: number;
    warningCount: number;
  };
}

export interface LeaderboardRow {
  rank: number;
  player: Player;
  totalPoints: number;
  matchesPlayed: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  groupPoints: number;
  yellowCards: number;
  redCards: number;
  absences: number;
}
