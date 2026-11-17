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
  "7": "po",
};

function context(overrides: Partial<AbilityContext> = {}): AbilityContext {
  return {
    actorId: "7",
    targetIds: ["4"],
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

function noOne(value: boolean): AbilityDecision {
  return { kind: "effects", effects: [{ kind: "record-no-one", noOne: value }] };
}

test("the Po module declares a step from the second night and ends nothing on use (BMR-PO-01)", () => {
  assert.equal(nightStepFor(role, 1), undefined);
  assert.equal(nightResolverFor(role, 1), undefined);
  for (const night of [2, 5]) {
    assert.deepEqual(nightStepFor(role, night), {
      target: "po",
      minTargets: 0,
      maxTargets: 3,
      canKill: true,
      noteKey: "note.bmr.po",
    });
    assert.equal(nightArmFor(role, night)?.endsOnUse, undefined);
  }
});

test("a Po who chooses no one records it, and one who chooses players records that it did (BMR-PO-01)", () => {
  assert.deepEqual(resolve({ targetIds: [] }), noOne(true));
  assert.deepEqual(resolve({ targetIds: ["4"] }), noOne(false));
  assert.deepEqual(resolve({ targetIds: ["4", "5", "6"] }), noOne(false));
  // Choosing the Goon is a choice of a player.
  assert.deepEqual(resolve({ targetIds: ["3"] }), noOne(false));
});

test("an impaired Po's choice is recorded the same way: the next night still takes three players (BMR-PO-01)", () => {
  assert.deepEqual(resolve({ targetIds: [], impaired: true }), noOne(true));
  assert.deepEqual(resolve({ targetIds: ["4"], impaired: true }), noOne(false));
});
