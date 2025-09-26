/**
 * @fileoverview Template catalog for createAgentFromTemplate.
 * Provides curated prompt scaffolds with parameterized renderers.
 */

/**
 * Render a Documentation Audit prompt.
 * @param {{ docPaths: string[]; guidelines?: string }} params
 */
function renderDocAudit(params) {
  const { docPaths, guidelines } = params;
  if (!Array.isArray(docPaths)) {
    throw new TypeError('docPaths must be an array of strings');
  }
  const paths = docPaths.join(', ');
  const extra = guidelines ? `\n\nGuidelines to follow:\n${guidelines}` : '';
  return [
    'Documentation Audit Task',
    '',
    'Please audit the documentation in the repository with the following goals:',
    '- Improve clarity, correctness, and consistency',
    '- Fix typos and grammar',
    '- Ensure links are valid',
    '- Add missing sections where appropriate',
    '',
    `Scope: ${paths}`,
    extra,
    '',
    'Deliverables:',
    '- Commit edits with clear messages',
    '- Summarize major changes in the PR description',
  ].filter(Boolean).join('\n');
}

/**
 * Render a TypeScript Type Cleanup prompt.
 * @param {{ strictMode?: boolean; includeDirs?: string[] }} params
 */
function renderTypeCleanup(params) {
  const { strictMode = true, includeDirs } = params || {};
  const dirs = Array.isArray(includeDirs) && includeDirs.length > 0 ? includeDirs.join(', ') : 'entire codebase';
  return [
    'TypeScript Type Cleanup Task',
    '',
    'Goals:',
    '- Remove `any` where feasible and replace with precise types',
    '- Add missing type annotations',
    '- Fix type errors and enable safer patterns',
    strictMode ? '- Ensure tsconfig uses strict mode (strict: true)' : null,
    '',
    `Focus: ${dirs}`,
    '',
    'Deliverables:',
    '- Pass typecheck (tsc) with no errors',
    '- Update ESLint rules if necessary to prevent regressions',
  ].filter(Boolean).join('\n');
}

/**
 * Render a Bug Hunt prompt.
 * @param {{ area: string; flaky?: boolean }} params
 */
function renderBugHunt(params) {
  const { area, flaky } = params;
  return [
    'Bug Hunt Task',
    '',
    `Target area: ${area}`,
    flaky ? '- Prioritize flaky tests and intermittent failures' : null,
    '',
    'Steps:',
    '- Reproduce the issue(s) consistently',
    '- Add or improve tests to capture failing behavior',
    '- Implement minimal, robust fixes',
    '- Verify fixes and update documentation if needed',
  ].filter(Boolean).join('\n');
}

export const templates = {
  docAudit: {
    title: 'Documentation Audit',
    render: renderDocAudit,
  },
  typeCleanup: {
    title: 'TypeScript Type Cleanup',
    render: renderTypeCleanup,
  },
  bugHunt: {
    title: 'Bug Hunt',
    render: renderBugHunt,
  },
};

