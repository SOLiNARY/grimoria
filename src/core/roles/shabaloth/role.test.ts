import test from "node:test";
import assert from "node:assert/strict";
import type { RoleId } from "../../model/types.ts";
import type { AbilityContext, AbilityDecision } from "../ability.ts";
import { nightArmFor, nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

const SEATS: Record<string, RoleId> = {
  "3": "goon",
  "4": "chambermaid",
  "5": "gossip",
  "6": "sailor",
  "7": "shabaloth",
};

function context(overrides: Partial<AbilityContext> = {}): AbilityContext {
  return {
    actorId: "7",
    targetIds: ["4", "5"],
    chosenRoleId: null,
    drunkId: null,
    impaired: false,
    at: { phase: "night", number: 2 },
    pendings: [],
    actualRoleOf: (id) => SEATS[id] ?? null,
    hasPlayer: (id) => id in SEATS,
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

test("the Shabaloth module declares a step from the second night and ends nothing on use (BMR-SHABALOTH-01)", () => {
  assert.equal(nightStepFor(role, 1), undefined);
  assert.equal(nightResolverFor(role, 1), undefined);
  for (const night of [2, 5]) {
    assert.deepEqual(nightStepFor(role, night), {
      target: "two",
      canKill: true,
      canResurrect: true,
      noteKey: "note.bmr.shabaloth",
    });
    assert.equal(nightArmFor(role, night)?.endsOnUse, undefined);
  }
});

test("a healthy Shabaloth records its two players, in the host's order (BMR-SHABALOTH-01)", () => {
  assert.deepEqual(resolve(), {
    kind: "effects",
    effects: [{ kind: "record-choices", playerIds: ["4", "5"] }],
  });
  assert.deepEqual(resolve({ targetIds: ["5", "4"] }), {
    kind: "effects",
    effects: [{ kind: "record-choices", playerIds: ["5", "4"] }],
  });
});

test("the record holds two players at most, and a step without players records nothing", () => {
  assert.deepEqual(resolve({ targetIds: ["4", "5", "6"] }), {
    kind: "effects",
    effects: [{ kind: "record-choices", playerIds: ["4", "5"] }],
  });
  assert.deepEqual(resolve({ targetIds: [] }), { kind: "no-effect" });
});

test("a drunk or poisoned Shabaloth records no choice", () => {
  assert.deepEqual(resolve({ impaired: true }), { kind: "no-effect" });
});
