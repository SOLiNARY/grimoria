## ADDED Requirements

### Requirement: Swap decision

The transformation contract SHALL expose a `swap` decision that names the
player the acting seat swaps characters with, whether the two also exchange
alignments, and whether the player is then poisoned for good by the acting
ability. The engine SHALL apply it through the shared swap and, when the
player is poisoned, SHALL write one permanent poison after the swap with an
id made of the acting ability, the acting seat and the player. The decision
SHALL NOT name the poison's id, its source or the seat the swap starts
from. The `no-effect` decision SHALL accept the reason `not-demon`.

**Source**: [Snake Charmer r2905](https://wiki.bloodontheclocktower.com/index.php?title=Snake_Charmer&oldid=2905); `docs/adr/0002-engine-contracts.md` §2; [Issue #200](https://github.com/hose1021/grimoria/issues/200)
**Tests**: `src/core/engine/snv.test.ts`, `src/core/roles/snakecharmer/role.test.ts`, `src/core/roles/ability.test-d.ts`

#### Scenario: A swap with the poison

- **WHEN** the Snake Charmer's capability returns a swap with the Demon, with alignments and the poison
- **THEN** the two seats exchange characters and alignments, tonight's steps are requeued, and a permanent poison from the acting seat on the old Demon is written after the swap's reconciled effects

#### Scenario: Another id, source or seat

- **WHEN** a role names the poison's id or the seat the swap starts from, or leaves out the alignments
- **THEN** the type check rejects the module

### Requirement: The Snake Charmer swaps with a chosen Demon through its capabilities

The Snake Charmer role module SHALL declare its step on one `night-step`
capability for every night, without a night-step resolver, and its rule on
a `transformation` capability. A sober and healthy Snake Charmer who
chooses the Demon SHALL swap characters and alignments with it, and the old
Demon SHALL be poisoned for good. A player who is not the Demon, or a drunk
or poisoned Snake Charmer, SHALL change nothing and the step SHALL get the
shared note. The command SHALL still refuse a dead player with `error.55`.

**Source**: [Snake Charmer r2905](https://wiki.bloodontheclocktower.com/index.php?title=Snake_Charmer&oldid=2905); [Philosopher r2421](https://wiki.bloodontheclocktower.com/index.php?title=Philosopher&oldid=2421); [Issue #200](https://github.com/hose1021/grimoria/issues/200)
**Tests**: `src/core/roles/snakecharmer/role.test.ts`, `src/core/engine/snv.test.ts`, `scripts/role-ownership.test.ts`

#### Scenario: The Demon chosen

- **WHEN** a sober and healthy Snake Charmer chooses the Demon on a later night
- **THEN** the Snake Charmer becomes the evil Demon and wakes as it tonight, and the Demon becomes the good, poisoned Snake Charmer

#### Scenario: No Demon, or an impaired Snake Charmer

- **WHEN** the Snake Charmer chooses a Minion, or is drunk or poisoned
- **THEN** no character, alignment or effect changes and the step gets the shared note

#### Scenario: A dead player

- **WHEN** the Snake Charmer chooses a dead player
- **THEN** the command is rejected with `error.55` and the state is unchanged

#### Scenario: A Philosopher with the ability

- **WHEN** a Philosopher with the Snake Charmer's ability chooses the Demon
- **THEN** the Philosopher becomes the Demon and the Demon becomes a poisoned Philosopher

### Requirement: The Pit-Hag declares its step from the second night

The Pit-Hag role module SHALL declare its step on one `night-step`
capability for the nights after the first, without a night-step resolver,
beside its `transformation` capability, and SHALL NOT declare a legacy night
step. Its change, its no-op for a character in play, its failure while
impaired and a Demon it makes SHALL stay as before.

**Source**: [Pit-Hag r2998](https://wiki.bloodontheclocktower.com/index.php?title=Pit-Hag&oldid=2998); [Issue #200](https://github.com/hose1021/grimoria/issues/200)
**Tests**: `src/core/roles/pithag/role.test.ts`, `src/core/engine/snv.test.ts`, `scripts/role-ownership.test.ts`

#### Scenario: The first night

- **WHEN** the first night starts with a Pit-Hag in play
- **THEN** the queue holds no Pit-Hag step

#### Scenario: A Demon made

- **WHEN** the Pit-Hag makes a player a Demon on a later night
- **THEN** the new Demon does not wake tonight and the host marks the night's deaths on the Pit-Hag's step

### Requirement: Moving the Snake Charmer and the Pit-Hag changes no outcome

Moving the two steps and the Snake Charmer's rule to capabilities SHALL NOT
change a night queue, a step record, a character, an alignment, an effect
with its id, flag and order, a death, a log line, a command result or the
order of draws from the command ports for the same starting state and the
same commands.

**Source**: `docs/adr/0002-engine-contracts.md` "Migration order"; [Issue #200](https://github.com/hose1021/grimoria/issues/200)
**Tests**: `src/core/engine/snv.test.ts`

#### Scenario: The same commands

- **WHEN** the same Snake Charmer or Pit-Hag step is completed before and after the move
- **THEN** the step, the seats, the effects in order, the log line and the draws from the command ports are identical

#### Scenario: A journal

- **WHEN** a journal with these steps recorded before the move is replayed after it
- **THEN** the replay ends in the same state
