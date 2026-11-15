# ADR 0001: Role capability contract and one rules coordinator

- Status: Proposed
- Date: 2026-11-15
- Issue: [#200](https://github.com/hose1021/grimoria/issues/200)
- Extends: [#177](https://github.com/hose1021/grimoria/issues/177) role modules

## Context

`src/core/roles/registry.ts` already keeps one module for each of the 72
supported characters, and the type checker fails when a supported id has no
module. The module contract from #177 owns only the night step and the death
hook. Role resolution that runs when a night step completes is still a role
literal inside the edition files: `src/core/engine/bmr.ts`,
`src/core/engine/sv.ts` and the Trouble Brewing remainder in `night.ts`.

That shape has three costs:

- A role's rule is split between its module (when it wakes, what it targets)
  and an edition file (what the choice does), so ownership is not visible.
- The edition files mix role rules with shared mechanics, so a change cannot be
  reviewed as one role.
- A new role branch can reach any private helper, so nothing prevents a role
  path from writing unrelated state, setting a winner or duplicating an
  invariant.

The pinned official text stays the rules authority. This ADR changes no rule;
it defines the contract that later, separately reviewed slices use to move
existing rule behavior into modules.

## Decision

### 1. A role declares a capability; the engine executes it

A role module may declare an optional `ability` whose `resolve` receives
read-only facts and returns a typed decision. The engine coordinator validates
nothing new: the existing target validation, impairment graph, death flow,
journal and win pass stay where they are. The module decides only what its own
rule says.

The capability is opt-in per role, not a giant optional callback interface.
Each later slice adds a capability only when a real rule needs it.

```ts
export interface RoleAbility {
  resolve(context: AbilityContext): AbilityDecision;
}

export type AbilityDecision =
  | { readonly kind: "effects"; readonly effects: readonly RoleEffect[] }
  | { readonly kind: "suppressed" }
  | { readonly kind: "no-effect" };

export type RoleEffect = {
  readonly kind: "kill";
  readonly playerId: string;
};
```

`effects` is the only variant that changes game state. `suppressed` means the
ability did nothing because its owner is drunk or poisoned; the engine writes
the shared failure note, so the note text and locale key have one owner.
`no-effect` means the rule resolved without a consequence.

An intent names the target and the mechanic, never the acting ability or the
edition: the engine derives both from the module that returned it, so a role
cannot record a death under another ability's name.

The union grows only with a migrated role. Host adjudication that happens
during resolution (Artist, Savant, Dreamer) is a later variant with a legal
option list; the Gambler's guess is already a host-answered input to the step,
so the pilot does not need it and no unused variant is added.

### 2. The context is read-only and minimal

```ts
export interface AbilityContext {
  readonly actorId: string;
  readonly targetIds: readonly string[];
  readonly chosenRoleId: RoleId | null;
  readonly impaired: boolean;
  actualRoleOf(playerId: string): RoleId | null;
  hasPlayer(playerId: string): boolean;
}
```

The context exposes facts, never the game state. A role cannot mutate a player,
push an effect, write the journal, load storage or set a winner.

- `actualRoleOf` is the character on the seat. It is never a registration, a
  bluff, a shown mask or a borrowed ability.
- `chosenRoleId` is the host's character answer for the step, validated by the
  existing command path. The Courtier's character choice and the Gambler's guess
  share that channel today.
- `impaired` is the result of the single effect graph. The role decides what its
  own rule does with it; the consequence is not assumed by the engine, because
  the Assassin's Goon exception and the Courtier's spent once-per-game differ.

Registration, displayed character and alignment changes are Storyteller
decisions. The context does not compute them; a role that needs one receives it
as a host-answered input. This keeps the rule "no silent decision for the
Storyteller" in the type system instead of a convention.

### 3. The engine applies intents through the shared mechanics

`src/core/engine/ability.ts` is the one coordinator for this contract. It builds
the context, calls the resolver and applies each effect through the existing
shared path. A `kill` intent goes through `kill()` from `death.ts`, so
protection, the Fool, the Zombuul, the Sailor, the Tea Lady, impairment
bookkeeping and `checkWin` behave exactly as before. The engine records the
module's own identifier as the ability on the death entry and derives the
edition marker; neither comes from the role's intent.

The coordinator is not an event bus and does not create a second journal. The
existing journal, effect graph, replay and `pg.game.v4` state stay the only
ones.

### 4. Dependency direction

- A capability resolver may import `src/core/model` types and
  `src/core/roles/ability.ts`. It must not import `src/core/engine`.
- The engine imports the registry and the contract types. On the capability path
  the direction is one way, `engine → roles`; this change adds no reverse
  import.
- The registry stays an object literal checked by the compiler against
  `SupportedRoleId`, so a missing module still fails `npm run typecheck`.
  Behavioral coverage is asserted by tests per role, not by registry presence.

The #177 modules keep their engine imports: `imp/role.ts` imports
`becomeDemon`, and `roles/sv-common.ts` imports `engine/context.ts` and
`engine/retention.ts`. Removing those edges is a later slice; this ADR forbids
adding new ones on the capability path.

### 5. The step completion calls the capability once

For this slice, the Bad Moon Rising step completion calls the coordinator after
the shared pre-checks and after the Goon trigger, then returns. A module that
declares `ability` never falls through to the old role switch, so a missing
branch is a visible test failure, not a silent fallback.

Binding a capability to a specific step kind (a day action, a death-triggered
wake) is a later slice. This change binds it to the role's night step, which is
the only step the Gambler has.

## Consequences

- The Gambler rule now lives in `src/core/roles/gambler/role.ts` and is tested
  in isolation without a game fixture, while the existing engine tests still
  prove the integrated outcome.
- A later role migration has a fixed shape: read-only facts in, typed effects
  out, one shared applier. Review can compare one module instead of one edition
  file.
- The engine keeps one coordinator, one death path and one effect graph. The
  cost is one dispatch check per role step.
- Character identity is explicit: `actualRoleOf` cannot accidentally return a
  registration-dependent value. A role that needs registration must ask the
  Storyteller.

## Rejected alternatives

- **A hook per concern on `RoleModule`.** It recreates the edition switch as a
  wider interface and moves behavior without a requirement or an isolating test.
- **Passing `GameState` into the resolver.** It invites a role to mutate
  unrelated state and hides the real inputs of the rule.
- **A parallel event bus or a second ledger.** The repository already has a
  journal and an effect graph; a second history would break replay and
  determinism guarantees.
- **Migrating every role in one change.** The Gambler pilot proves the shape
  first; Pukka needs effect lifetimes and a delayed victim, which the contract
  does not yet model honestly.
- **A generic "strategy" for passive roles.** A passive role has no resolution;
  an empty resolver would be an anemic wrapper.

## Migration slices

Each slice is an owner-reviewed pull request and a separate OpenSpec change
when it changes behavior. A slice may not merge out of order with its base.

1. **This change:** contract, coordinator, Gambler migration, characterization
   tests. Behavior-preserving.
2. **Pukka:** delayed poison and death. Needs an effect intent with a lifetime,
   a previous-victim fact and the impairment-suspension rule. Pinned r3074 and
   the existing seven `BMR-PUKKA-*` rules are the source.
3. **Information and host-choice abilities:** Dreamer, Savant, Artist,
   Mathematician. Needs the pending-choice variant and private day workflows.
4. **Execution, death and transformation contributions:** Assassin, Mastermind,
   Evil Twin, character swaps.
5. **The remaining edition branches, one scenario at a time,** after the
   contract has proved itself on the pilot.

## Verification

- Behavior-preserving proof: the Gambler characterization test passes before and
  after the move, including the death record fields and the dead-target rule.
- Contract proof: the resolver returns an intent for a wrong guess, no intent for
  a correct guess, and `suppressed` when impaired.
- Existing suites: `src/core/engine/bmr.test.ts` and the full `npm run verify`.
- Rules check: compliant against `docs/official/wiki/Gambler.r3073.wikitext`.
