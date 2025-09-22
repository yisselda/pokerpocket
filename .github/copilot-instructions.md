Project: poker-pocket — lightweight offline Texas Hold'em CLI + embeddable engine

Goal
Be immediately productive making small feature changes, fixes, and tests for the TypeScript engine and CLI.

Quick facts
- Node >= 20 is required (see `package.json` `engines`).
- Source is in `src/` (TS, ESM). Build output is `dist/`.
- Key entry points: `src/cli.ts` (CLI runtime), `src/engine.ts` and `src/evaluator.ts` (exports).
- Types live in `src/types.ts` (use these to keep API and evaluator stable).

How to build & run locally (developer workflow)
- Build: `npm run build` (runs `tsc -p tsconfig.json` and writes to `dist/`).
- Run CLI in dev: `npm run dev` (uses `tsx src/cli.ts` — edits run immediately).
- Tests: `npm test` (uses `vitest run`). Use `npm run watch:test` for watch mode.

Project-specific patterns and conventions
- ESM / `type: "module"`: prefer `import`/`export` and top-level `await` where applicable.
- Exports map in `package.json`: public API surfaces are `./engine`, `./evaluator`, and `./types` — do not change these file paths without updating `package.json`.
- Small, pure utility functions: prefer pure, testable functions in `src/` (the evaluator should be deterministic and fast). See `src/types.ts` for canonical shape of `Card`, `EvalResult`, and `HandRank`.
- Use `bigint` for scores (see `EvalResult.score`). Preserve bigint operations across changes.

Integration points & external deps
- Dev-only dependencies: `typescript`, `vitest`, `tsx`. No runtime external dependencies are declared — this repo is intended to be self-contained.
- CLI install target: `bin` field points to `dist/cli.js` — publishing requires compiled `dist/` files.

Tests & expectations
- Tests use `vitest`. Keep tests fast and deterministic. Prefer unit tests over integration tests; mocking is rarely needed because there are no network or filesystem side-effects in the evaluator.

Examples from the codebase
- Types: `src/types.ts` defines `Card`, `HandRank`, and `EvalResult` — use these types when adding new functions or changing evaluator output.
- Scripts: `package.json` `dev` uses `tsx src/cli.ts` for rapid iteration — use it when validating CLI behavior.

When changing public API shapes (exported filenames, EvalResult, or types), update `package.json` `exports` and add/adjust unit tests that cover the shape change.

Edge cases for AI to watch for
- Do not assume `number` for large scores — `EvalResult.score` is `bigint`.
- When modifying card order or best-hand selection, ensure `best5` contains ordered `Card[]` of length 5 and `tiebreak` follows existing numeric ordering.

What not to change without human review
- `package.json` `exports` and `bin` fields (affects publishing and installed CLI behavior).
- `type: "module"` (switching module type changes build/runtime semantics).

If you need more context
- Open `src/` files; there are few files so reading them is fast. If a change affects packaging, run `npm run build` and ensure `dist/*` compiles without errors.

If something is unclear, ask a human for the intended CLI UX (commands/options) or whether the evaluator score semantics should change.

End of instructions.
