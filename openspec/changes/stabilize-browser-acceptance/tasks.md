# Tasks

- [x] Establish a local swap before checking published names, draft order and the blocked commit.
- [x] Wait for the requested scenario screen and exercise the supported seat route in the language checks.
- [x] Wait for the mobile setup screen before measuring its controls.

## Verification

- RED: Upstream PR #510 failed the seat-draft assertion in `node scripts/browser-check.ts`. In `node scripts/run-scenarios.ts`, the privacy scenario observed zero locked seat views, and the setup scenario found an empty reminder list.
- RED: Once the seat phase passed on Linux, the phone audit read an undefined route at 360×640 while the table loaded. [Browser job](https://github.com/SOLiNARY/grimoria/actions/runs/45994085750/job/140488980743)
- GREEN: All ten full-game scenarios passed on Linux, including privacy, setup and translations. Strict OpenSpec validation passed for all 42 changes and 27 specs. [Scenario job](https://github.com/SOLiNARY/grimoria/actions/runs/45994085750/job/140488980295)
- Browser verification commands: `node scripts/browser-check.ts` and `node scripts/run-scenarios.ts`.
