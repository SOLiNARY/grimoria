# Tasks

- [x] Establish a local swap before checking published names, draft order and the blocked commit.
- [x] Wait for the requested scenario screen and exercise the supported seat route in the language checks.

## Verification

- RED: Upstream PR #510 failed the seat-draft assertion in `node scripts/browser-check.ts`. In `node scripts/run-scenarios.ts`, the privacy scenario observed zero locked seat views, and the setup scenario found an empty reminder list.
- GREEN: `node scripts/openspec-check.ts` passed. Strict OpenSpec validation passed for all 42 changes and 27 specs.
- Browser verification commands: `node scripts/browser-check.ts` and `node scripts/run-scenarios.ts`.
