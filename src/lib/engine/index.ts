/**
 * Pure Tournament Engine (/lib/engine)
 *
 * ZERO UI imports, ZERO React imports, ZERO storage imports, ZERO realtime imports.
 * Every derived value in the entire platform (match winner/status, group standings,
 * qualifiers, BYE assignments, knockout participants, round statuses, player stats/status,
 * leaderboards, cascade impact, and consistency invariants) is computed here purely
 * from the append-only event log and structural definitions.
 */

export * from './types';
export * from './match';
export * from './groups';
export * from './knockout';
export * from './players';
export * from './scheduler';
export * from './cascade';
export * from './invariants';
