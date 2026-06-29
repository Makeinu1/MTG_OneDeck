import { readFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const files = {
  engineSpec: 'docs/engine-spec.md',
  acceptance: 'docs/acceptance.md',
};

function read(path) {
  return readFileSync(path, 'utf8');
}

function requireIncludes(label, source, needle, problems) {
  if (!source.includes(needle)) {
    problems.push(`${label}: missing ${JSON.stringify(needle)}`);
  }
}

export function verifyQ1DocsContract(input) {
  const engineSpec = input.engineSpec;
  const acceptance = input.acceptance;
  const labels = {
    engineSpec: input.engineSpecLabel ?? files.engineSpec,
    acceptance: input.acceptanceLabel ?? files.acceptance,
  };
  const problems = [];

  for (const needle of [
    'M0-FREEZE の CR-grounding overlay 正本は `research/cr-grounding/m0-freeze-overlay.json`',
    '`research/cr-grounding/m0-freeze-decision-record.md`',
    '`research/cr-grounding/m0-freeze-evidence-audit.md`',
    '`research/cr-grounding/m0-freeze-traceability-matrix.md`',
    'CONTRACT-UPDATE READY / M0-FREEZE NOT COMPLETE',
    'docs契約反映、scorecard overlay配線、scorecard再生成、Fable最終承認',
    'legacyFrozen',
    'crGroundingOverlay',
    'crGroundingOverlayApproved',
    'crGroundingOverlayProblems',
    'CR-grounding Overlay',
    'R-FREEZE Designs',
    'required-pass',
    'core-pass-only',
    'boundary-pass-only',
    'partial-allowed-*',
    '`frozen = legacyFrozen && crGroundingOverlayApproved`',
    '`PARTIAL` / `PASS(core)` / `PASS(boundary)` は plain `PASS` に変換しない',
  ]) {
    requireIncludes(labels.engineSpec, engineSpec, needle, problems);
  }

  for (const needle of [
    'M0-FREEZE は旧 M-CONTRACT scorecard に加えて CR-grounding overlay を確認する',
    '| CRG-1 CR 2026-06-19 fixed | required PASS |',
    '| CRG-2 CR-grounded golden cases defined | required PASS |',
    '| CRG-3 Commander tax CR 903.8 | required PASS |',
    '| CRG-4 Mana abilities CR 605 | PARTIAL allowed only if CR 605.1b/605.4a is explicit S-* carry |',
    '| CRG-4.5 Commander zone choice CR 903.9a/b | PARTIAL allowed only if generic rule choice is explicit S-CHOICE carry |',
    '| CRG-5 Token death CR 111.7/704.5d | required PASS |',
    '| CRG-6 Trigger/SBA/priority CR 603/704/117 | PARTIAL allowed only if 603.3b second bucket and full SBA are explicit S-* carry |',
    '| CRG-7 Zone movement/LKI CR 400.7/603.10a | PASS(core); CR 400.7 exceptions and full effective-characteristics snapshot remain S-* carry |',
    '| CRG-8 2026-06-19 new vocabulary | PASS(boundary); Heal / Power-up / Teamwork / Preparation executors remain scope-boundary |',
    'Acceptance rule: 未実装機構を `PASS` に混ぜない。',
    '`research/cr-grounding/m0-freeze-overlay.json`',
    '`research/cr-grounding/m0-freeze-review-packet.md`',
    '`research/cr-grounding/m0-freeze-review-sheet.md`',
    '`research/cr-grounding/m0-freeze-decision-record.md`',
    '`research/cr-grounding/m0-freeze-evidence-audit.md`',
    '`research/cr-grounding/m0-freeze-traceability-matrix.md`',
    '`research/cr-grounding/docs-contract-update-map.md`',
  ]) {
    requireIncludes(labels.acceptance, acceptance, needle, problems);
  }

  return problems;
}

export function printQ1DocsContractResult(problems) {
  if (problems.length > 0) {
    console.error('Q1 docs contract verification failed:');
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    return false;
  }

  console.log('Q1 docs contract verification passed.');
  return true;
}

function main() {
  const problems = verifyQ1DocsContract({
    engineSpec: read(files.engineSpec),
    acceptance: read(files.acceptance),
  });
  if (!printQ1DocsContractResult(problems)) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
