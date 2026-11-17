# Changelog

All notable changes to Grimoria are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-11-17

### Changed

- Move the night steps of the Poisoner, Monk, Butler, Imp, Spy, Gambler and Pukka, and the information answers of the Empath, Fortune Teller, Chef, Undertaker, Ravenkeeper, Washerwoman, Librarian and Investigator, from the engine into their role capabilities, with behavior pinned by tests before each move (#200)
- Let a role module answer its own step: the information decision now returns `answer`, `prepared` or `grimoire` beside the legal alternatives, and the ownership ledger counts five roles on typed capabilities alone, up from one, with fifteen more holding a capability and an engine reference (#200)
- Show a stored "zero are in play" as an answer in the secrets screen only for the Librarian; the Washerwoman and Investigator editors keep the fields the host prepares one with (#200)
- Record the new ownership in ADR 0002, `docs/role-ownership.md`, the per-role `rule.md` dossiers and the eleven OpenSpec changes behind the migration (#200)

### Fixed

- Answer a prepared "zero are in play" only for the Librarian; a zero held for another role no longer answers its step, and commands recorded under earlier ruleset versions replay unchanged (#200)

## [0.1.0] - 2026-11-16

### Added

- Add the release identity: a canonical `VERSION`, the mirrored `package.json` version, `CHANGELOG.md`, and `node scripts/check-version.ts` in `npm run verify` and CI; the build reports the version on the help screen
- Add the host table for Trouble Brewing, Bad Moon Rising and Sects & Violets: seating, first night, other nights, dawn, day, nominations, execution and win resolution through one command journal with undo
- Add the role sheet, player handoff, public view and Storyteller help over the pinned `ru`, `en` and `az` catalogues
- Add the command journal and deterministic replay behind undo/redo and save recovery
- Add save versioning with schema v4 migration, import/export with the secrets warning, and the teaching demo on its own in-memory game
- Add the offline app: a precached service worker, an update prompt that saves every open window before activation, and a 404 fallback for project subpaths
- Add the OpenSpec workflow, the pinned official rule snapshots and the per-role rule documents behind every verified mechanism
- Add the obsidian palette, the stadium table console and the shared setup and secrets component standard

### Changed

- Adopt GitFlow: `dev` integrates work, `hotfix/*` merges into `main` and back, every merge into `main` changes the version, and commit and PR titles end with the issue reference `(#N)`

### Security

- Add the public and player projections that omit secret roles, bluffs and notes from shared views

[Unreleased]: https://github.com/hose1021/grimoria/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/hose1021/grimoria/releases/tag/v0.1.1
[0.1.0]: https://github.com/hose1021/grimoria/releases/tag/v0.1.0
