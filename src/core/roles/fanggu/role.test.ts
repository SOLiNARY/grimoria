import test from "node:test";
import assert from "node:assert/strict";
import type { AbilityContext, AbilityDecision } from "../ability.ts";
import { nightArmFor, nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

function context(overrides: Partial<AbilityContext> = {}): AbilityContext {
  return {
    actorId: "1",
    targetIds: ["2"],
    chosenRoleId: null,
    drunkId: null,
    impaired: false,
    at: { phase: "night", number: 2 },
    pendings: [],
    actualRoleOf: (id) => (id === "1" ? "fanggu" : id === "2" ? "klutz" : null),
    hasPlayer: (id) => id === "1" || id === "2",
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

test("the Fang Gu module declares a step from the second night and ends nothing on use (SNV-FANGGU-01)", () => {
  assert.equal(nightStepFor(role, 1), undefined);
  assert.equal(nightResolverFor(role, 1), undefined);
  for (const night of [2, 5]) {
    assert.deepEqual(nightStepFor(role, night), { target: "one-any", canKill: true });
    assert.equal(nightArmFor(role, night)?.endsOnUse, undefined);
  }
});

test("the Fang Gu's step resolves to nothing, healthy or impaired: the host marks the death on the outcome (SNV-FANGGU-01, SNV-FANGGU-04)", () => {
  assert.deepEqual(resolve(), { kind: "no-effect" });
  assert.deepEqual(resolve({ impaired: true }), { kind: "no-effect" });
  assert.deepEqual(resolve({ at: { phase: "night", number: 4 } }), { kind: "no-effect" });
});
