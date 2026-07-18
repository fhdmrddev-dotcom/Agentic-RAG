// Phase 155 (A11Y-01 / D-02 + operator decision D-155-01-A):
// Accessibility-SCOPED lint config. Enforces ONLY the eslint-plugin-jsx-a11y
// recommended rule-set (at error severity) over the app source — NOT the
// ~160 pre-existing non-a11y errors (@typescript-eslint/no-explicit-any,
// no-unused-vars, react-refresh/only-export-components, import/first,
// react-hooks/*) that the full `eslint .` config surfaces.
//
// This is the CI gate for Phase 155: `npm run lint:a11y` must exit 0 so an
// a11y regression cannot merge, while the general lint-debt cleanup is left
// to a future phase (the full `npm run lint` = `eslint .` script is kept in
// package.json for that work — it is just not gated on in CI this phase).
//
// Notes:
// - The TypeScript parser is required so `.tsx` files parse (espree, ESLint's
//   default parser, cannot read TS syntax). Only jsx-a11y rules are enabled.
// - `react-hooks` + `@typescript-eslint` are registered with NO rules turned
//   on, purely so their names resolve in the many inline `eslint-disable`
//   directives already in the source (otherwise ESLint reports "Definition
//   for rule 'X' was not found" and the gate can never exit 0). No non-a11y
//   rule is ENFORCED — the plugins are present only to satisfy the directives.
// - Test files (`*.test.tsx`, `__tests__/`, `*.d.ts`) are excluded: they carry
//   no jsx-a11y violations (they are not shipped UI) and their `import/first`
//   disable directives reference eslint-plugin-import, which this repo does
//   not install.
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    '**/*.test.{ts,tsx}',
    '**/*.spec.{ts,tsx}',
    '**/__tests__/**',
    '**/*.d.ts',
  ]),
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: {
      // Source files legitimately carry disable directives for the full
      // `eslint .` config; don't flag them as unused under this a11y subset.
      reportUnusedDisableDirectives: 'off',
    },
    // ONLY the jsx-a11y recommended rules are enforced.
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
])
