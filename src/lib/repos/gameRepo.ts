/**
 * Compatibility alias during CR1 migration: `Game` was renamed to `Match` per AGENTS.md §15.1.
 * All calls delegate directly to `matchRepo` and the atomic Command Pipeline.
 */
export {
  matchRepo as gameRepo,
  type BracketRoundSpec,
  type FinishGameResult,
  type GenerateBracketInput,
  type GenerateBracketResult,
} from './matchRepo';
