import test from "node:test";
import assert from "node:assert/strict";
import type { AbilityContext, AbilityDecision } from "../ability.ts";
import { nightArmFor, nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

function context(overrides: Partial<AbilityContext> = {}): AbilityContext {
  return {
    actorId: "1",
    targetIds: ["4"],
    chosenRoleId: null,
    drunkId: null,
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

test("the Devil's Advocate module declares a step for every night, and the choice replaces the last (BMR-DEVILSADVOCATE-01)", () => {
  assert.deepEqual(nightStepFor(role, 1), {
    target: "one-any",
    noteKey: "note.bmr.devilAdvocateFirst",
  });
  for (const night of [2, 5]) {
    assert.deepEqual(nightStepFor(role, night), {
      target: "one-any",
      noteKey: "note.bmr.devilAdvocateOther",
    });
  }
  for (const night of [1, 2, 5]) {
    assert.deepEqual(nightArmFor(role, night)?.endsOnUse, ["survives-execution"]);
  }
});

test("a healthy Devil's Advocate records the choice and protects the player from tomorrow's execution (BMR-DEVILSADVOCATE-01, BMR-DEVILSADVOCATE-02)", () => {
  assert.deepEqual(resolve(), {
    kind: "effects",
    effects: [
      { kind: "record-choice", playerId: "4" },
      {
        kind: "timed-effect",
        effect: "survives-execution",
        playerId: "4",
        expires: { phase: "night", number: 3 },
      },
    ],
  });
  assert.deepEqual(resolve({ at: { phase: "night", number: 1 }, targetIds: ["1"] }), {
    kind: "effects",
    effects: [
      { kind: "record-choice", playerId: "1" },
      {
        kind: "timed-effect",
        effect: "survives-execution",
        playerId: "1",
        expires: { phase: "night", number: 2 },
      },
    ],
  });
});

test("an impaired Devil's Advocate protects nobody but the choice is recorded (BMR-DEVILSADVOCATE-01, BMR-DEVILSADVOCATE-02)", () => {
  assert.deepEqual(resolve({ impaired: true }), {
    kind: "suppressed",
    effects: [{ kind: "record-choice", playerId: "4" }],
  });
});

test("a Devil's Advocate step without a player records nothing", () => {
  assert.deepEqual(resolve({ targetIds: [] }), { kind: "no-effect" });
  assert.deepEqual(resolve({ targetIds: [], impaired: true }), { kind: "no-effect" });
});
