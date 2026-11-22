#!/usr/bin/env node
/**
 * Architecture & Derived-State Guard Linter (scripts/check-derived-writes.mjs)
 *
 * Uses the TypeScript AST compiler API to enforce AGENTS.md §15.4:
 * 1. Code outside /lib/engine, /lib/commands, /lib/seed, and /lib/schemas MUST NEVER
 *    directly write derived state fields (winnerPlayerId, winnerId, advancingPlayerIds,
 *    result, stats, or entity .status / .rank mutations).
 * 2. /lib/engine MUST stay 100% pure (zero imports of storage, realtime, commands, react, or next).
 * 3. UI code (src/app, src/components) MUST NEVER import /lib/storage or /lib/seed directly.
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');

const FORBIDDEN_DERIVED_WRITE_PROPS = new Set([
  'winnerPlayerId',
  'winnerId',
  'advancingPlayerIds',
  'stats',
  'qualified',
  'qualificationStatus',
  'totalResponseTimeMs',
]);

// Matches object keys written in repo/UI mutation payloads (e.g. update(..., { status: ... }))
const FORBIDDEN_MUTATION_OBJECT_KEYS = new Set([
  'winnerPlayerId',
  'winnerId',
  'advancingPlayerIds',
  'qualified',
  'qualificationStatus',
  'totalResponseTimeMs',
]);

const ENGINE_FORBIDDEN_IMPORTS = [
  '@/lib/storage',
  '@/lib/realtime',
  '@/lib/commands',
  '@/lib/repos',
  'react',
  'next',
  'idb',
];

const UI_FORBIDDEN_IMPORTS = ['@/lib/storage', '@/lib/seed'];

function walkTsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsFiles(full, out);
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.d.ts')
    ) {
      out.push(full);
    }
  }
  return out;
}

function relUnix(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function isAllowedToWriteDerived(relPath) {
  return (
    relPath.startsWith('src/lib/engine/') ||
    relPath.startsWith('src/lib/commands/') ||
    relPath.startsWith('src/lib/seed/') ||
    relPath.startsWith('src/lib/schemas/') ||
    relPath.includes('.test.') ||
    relPath.includes('/__tests__/')
  );
}

const violations = [];

for (const filePath of walkTsFiles(SRC_DIR)) {
  const rel = relUnix(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const scriptKind = filePath.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);

  const report = (node, rule, msg) => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    violations.push(`${rel}:${line + 1}:${character + 1} [${rule}] ${msg}`);
  };

  const inEngine = rel.startsWith('src/lib/engine/');
  const inUi = rel.startsWith('src/app/') || rel.startsWith('src/components/');
  const canWriteDerived = isAllowedToWriteDerived(rel);

  function visit(node) {
    // Rule A: Import boundary enforcement
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (inEngine) {
        for (const bad of ENGINE_FORBIDDEN_IMPORTS) {
          if (spec === bad || spec.startsWith(`${bad}/`)) {
            report(
              node,
              'pure-engine',
              `Pure engine (/lib/engine) must not import "${spec}".`
            );
          }
        }
      }
      if (inUi) {
        for (const bad of UI_FORBIDDEN_IMPORTS) {
          if (spec === bad || spec.startsWith(`${bad}/`)) {
            report(
              node,
              'ui-boundary',
              `UI layer must not import "${spec}" directly; use /lib/repos or /lib/commands.`
            );
          }
        }
      }
    }

    // Rule B: No direct writes to derived fields outside /lib/engine and /lib/commands
    if (!canWriteDerived) {
      // B1. Direct property assignment: target.winnerPlayerId = ..., target.status = ..., target.rank = ...
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(node.left)
      ) {
        const propName = node.left.name.text;
        const leftText = node.left.getText(sf);
        if (
          FORBIDDEN_DERIVED_WRITE_PROPS.has(propName) ||
          propName === 'rank' ||
          (propName === 'status' &&
            /\b(match|game|player|round)\b/i.test(leftText))
        ) {
          report(
            node,
            'no-derived-write',
            `Direct assignment to derived field "${leftText}" is forbidden outside /lib/engine and /lib/commands.`
          );
        }
      }

      // B2. Forbidden keys passed into repo/command mutation calls (e.g. gameRepo.update(id, { winnerPlayerId: ..., status: ... }))
      if (ts.isCallExpression(node)) {
        const calleeText = node.expression.getText(sf);
        const isRepoWriteCall =
          /\b(matchRepo|gameRepo|playerRepo|roundRepo|scoreRepo|quizRepo)\.(create|update|bulkCreate)\b/.test(
            calleeText
          );
        if (isRepoWriteCall) {
          for (const arg of node.arguments) {
            if (ts.isObjectLiteralExpression(arg)) {
              for (const prop of arg.properties) {
                if (
                  (ts.isPropertyAssignment(prop) ||
                    ts.isShorthandPropertyAssignment(prop)) &&
                  ts.isIdentifier(prop.name)
                ) {
                  const key = prop.name.text;
                  if (
                    FORBIDDEN_MUTATION_OBJECT_KEYS.has(key) ||
                    key === 'status' ||
                    key === 'result' ||
                    key === 'stats' ||
                    key === 'rank'
                  ) {
                    report(
                      prop,
                      'no-derived-write',
                      `Passing derived field "${key}" into ${calleeText}() is forbidden; derive it via /lib/engine commands instead.`
                    );
                  }
                }
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);
}

if (violations.length > 0) {
  console.error('\nDerived-State & Architecture Guard FAILED:\n');
  for (const v of violations) {
    console.error(`  ✖ ${v}`);
  }
  console.error(`\nTotal violations: ${violations.length}\n`);
  process.exit(1);
}

console.log('✓ Derived-State & Architecture Guard passed (0 violations).');
