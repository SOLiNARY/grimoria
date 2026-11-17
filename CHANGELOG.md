# Changelog

All notable changes to Grimoria are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Wake a new Demon once, the night it takes the role: a named heir is woken right after the host's choice, and the next night no longer repeats the YOU ARE wake; saved games keep the wakes they recorded
- Let a Pukka poisoned by its own poison choose a sober Goon: the Pukka is drunk until dusk and the Goon turns evil, where the choice was refused as an effect cycle
- Ask the host for the Mayor's fate: choosing the Mayor as the Demon's target from a seat leaves the redirect unanswered and the step blocked, where the tap answered "the Mayor dies"
- Ask for the Demon's heir first: after an Imp self-kill with several Minions alive, the dock and the centre of the table name the heir question and offer the Minions, and no control of the next step is shown until the host names one
- Label a registration as one: the count of a healthy Chef beside a Spy is labelled a registration, not false information

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

[Unreleased]: https://github.com/hose1021/grimoria/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/hose1021/grimoria/releases/tag/v0.1.0
