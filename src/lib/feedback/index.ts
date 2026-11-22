/**
 * Feedback Service (/lib/feedback)
 *
 * Hook points prepared in Phase 1 per AGENTS.md §12.
 * In Phases 1-9 (when settings.delightersEnabled is false), these methods are safe no-ops.
 * In Phase 10 ("start Delighters"), these will trigger Web Audio / Howler sound effects
 * and navigator.vibrate haptics when enabled by the user.
 */

export type FeedbackSoundName =
  | 'buzz'
  | 'score.positive'
  | 'score.negative'
  | 'score.undo'
  | 'segment.next'
  | 'timer.tick'
  | 'timer.urgent'
  | 'game.winner'
  | 'card.flip'
  | 'chip.clink'
  | 'quiz.started'
  | 'quiz.answered'
  | 'quiz.timedOut'
  | 'quiz.finished';

export type FeedbackHapticName =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'buzz'
  | 'winner'
  | 'warning';

export interface FeedbackService {
  play: (name: FeedbackSoundName) => void;
  haptic: (name: FeedbackHapticName) => void;
}

export const feedback: FeedbackService = {
  play: (_name: FeedbackSoundName) => {
    // No-op in Phases 1–9 (Delighters hook point)
  },
  haptic: (_name: FeedbackHapticName) => {
    // No-op in Phases 1–9 (Delighters hook point)
  },
};
