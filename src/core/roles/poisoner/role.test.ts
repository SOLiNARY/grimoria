import test from "node:test";
import assert from "node:assert/strict";
import type { AbilityContext, AbilityDecision } from "../ability.ts";
import { nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

function context(overrides: Partial<AbilityContext> = {}): AbilityContext {
  return {
    actorId: "6",
    targetIds: ["3"],
    chosenRoleId: null,
    impaired: false,
    at: { phase: "night", number: 2 },
    pendings: [],
    actualRoleOf: () => null,
    hasPlayer: () => true,
    nameOf: (id) => "P" + id,
    ...overrides,
  };
}

function resolve(overrides: Partial<AbilityContext> = {}): AbilityDecision {
  const facts = context(overrides);
  const resolver = nightResolverFor(role, facts.at.number);
  assert.ok(resolver, "the module owns the resolution");
  return resolver(facts);
}

test("the Poisoner module declares one step for every night", () => {
  assert.deepEqual(nightStepFor(role, 1), { target: "one-any" });
  assert.deepEqual(nightStepFor(role, 2), { target: "one-any" });
});

test("a healthy Poisoner returns one poison for tonight and tomorrow day (TB-POISONER-01)", () => {
  assert.deepEqual(resolve(), {
    kind: "effects",
    effects: [
      {
        kind: "timed-effect",
        effect: "poison",
        playerId: "3",
        expires: { phase: "night", number: 3 },
        replacesPrevious: true,
      },
    ],
    note: { key: "note.poisoned", vars: { name: "P3" }, text: "Отравлен: P3." },
  });
});

test("the first-night poison also ends at the next dusk (TB-POISONER-01)", () => {
  const decision = resolve({ at: { phase: "night", number: 1 } });
  assert.equal(decision.kind, "effects");
  if (decision.kind !== "effects") return;
  assert.deepEqual(decision.effects[0], {
    kind: "timed-effect",
    effect: "poison",
    playerId: "3",
    expires: { phase: "night", number: 2 },
    replacesPrevious: true,
  });
});

test("the Poisoner may choose any player, themself included (TB-POISONER-01)", () => {
  const decision = resolve({ targetIds: ["6"] });
  assert.equal(decision.kind, "effects");
  if (decision.kind !== "effects") return;
  assert.equal(decision.effects.length, 1);
  assert.equal(decision.effects[0]!.kind, "timed-effect");
  assert.equal("playerId" in decision.effects[0]! && decision.effects[0]!.playerId, "6");
});

test("an impaired Poisoner reports a suppressed ability (TB-POISONER-01)", () => {
  assert.deepEqual(resolve({ impaired: true }), { kind: "suppressed" });
});

test("a Poisoner step without a target returns no effect", () => {
  assert.deepEqual(resolve({ targetIds: [] }), { kind: "no-effect" });
});
