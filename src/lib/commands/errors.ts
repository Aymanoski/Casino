import type { CascadeImpact, ConsistencyReport } from '@/lib/engine';

export class VersionConflictError extends Error {
  readonly code = 'VERSION_CONFLICT';
  readonly matchId: string;
  readonly expectedVersion: number;
  readonly actualVersion: number;

  constructor(matchId: string, expectedVersion: number, actualVersion: number) {
    super(
      `This match was updated in another window (expected v${expectedVersion}, found v${actualVersion}). Please refresh to see the latest state before trying again.`
    );
    this.name = 'VersionConflictError';
    this.matchId = matchId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export class CascadeConfirmationRequiredError extends Error {
  readonly code = 'CASCADE_CONFIRMATION_REQUIRED';
  readonly impact: CascadeImpact;

  constructor(impact: CascadeImpact) {
    super(impact.summaryEn);
    this.name = 'CascadeConfirmationRequiredError';
    this.impact = impact;
  }
}

export class InvariantViolationError extends Error {
  readonly code = 'INVARIANT_VIOLATION';
  readonly report: ConsistencyReport;

  constructor(report: ConsistencyReport) {
    const first = report.violations[0];
    super(
      `Data consistency invariant violated (${report.violations.length} issue(s)): ${first?.messageEn ?? 'Unknown violation'}`
    );
    this.name = 'InvariantViolationError';
    this.report = report;
  }
}

export class CommandValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'CommandValidationError';
  }
}
