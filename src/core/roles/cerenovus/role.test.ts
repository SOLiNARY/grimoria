import test from "node:test";
import assert from "node:assert/strict";
import type { AbilityContext, AbilityDecision } from "../ability.ts";
import { nightArmFor, nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

function context(overrides: Partial<AbilityContext> = {}): AbilityContext {
  return {
    actorId: "7",
    targetIds: ["2"],
    chosenRoleId: "artist",
    drunkId: null,
    impaired: false,
    at: { phase: "night", number: 1 },
    pendings: [],
    actualRoleOf: (id) => (id === "7" ? "cerenovus" : id === "2" ? "oracle" : null),
    hasPlayer: (id) => id === "7" || id === "2",
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

test("the Cerenovus module declares one step for every night and ends nothing on use (SNV-CERENOVUS-01)", () => {
  for (const night of [1, 2, 5]) {
    assert.deepEqual(nightStepFor(role, night), { target: "one-any", infoKind: "note" });
    assert.equal(nightArmFor(role, night)?.endsOnUse, undefined);
  }
});

test("a healthy Cerenovus makes the chosen player mad about the character until the next dawn (SNV-CERENOVUS-01)", () => {
  assert.deepEqual(resolve(), {
    kind: "effects",
    effects: [
      {
        kind: "madness",
        playerId: "2",
        roleId: "artist",
        expires: { phase: "day", number: 2 },
      },
    ],
    note: {
      key: "note.madness",
      vars: { name: "P2", role: "artist" },
      text: "P2 должен быть «помешан» на роли Художник до следующего рассвета.",
    },
  });
  const later = resolve({ at: { phase: "night", number: 4 }, chosenRoleId: "sage" });
  assert.equal(later.kind, "effects");
  assert.deepEqual(later.kind === "effects" ? later.effects[0] : null, {
    kind: "madness",
    playerId: "2",
    roleId: "sage",
    expires: { phase: "day", number: 5 },
  });
});

test("a Cerenovus who names no character, or who is drunk or poisoned, makes nobody mad (SNV-CERENOVUS-01)", () => {
  assert.deepEqual(resolve({ chosenRoleId: null }), { kind: "no-effect" });
  assert.deepEqual(resolve({ impaired: true }), { kind: "no-effect" });
  assert.deepEqual(resolve({ targetIds: [] }), { kind: "no-effect" });
});
