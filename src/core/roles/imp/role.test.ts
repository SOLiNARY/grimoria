import test from "node:test";
import assert from "node:assert/strict";
import type { AbilityContext, AbilityDecision } from "../ability.ts";
import { nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

function context(overrides: Partial<AbilityContext> = {}): AbilityContext {
  return {
    actorId: "7",
    targetIds: ["2"],
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

test("the Imp module declares its step for every night except the first (TB-IMP-01)", () => {
  assert.equal(nightStepFor(role, 1), undefined);
  assert.equal(nightResolverFor(role, 1), undefined);
  assert.deepEqual(nightStepFor(role, 2), { target: "one-any" });
  assert.deepEqual(nightStepFor(role, 5), { target: "one-any" });
});

test("the Imp attacks the chosen player under its own log title (TB-IMP-01)", () => {
  assert.deepEqual(resolve(), { kind: "attack", playerId: "2", title: "Имп атакует" });
});

test("an Imp that chooses themself returns the same attack on their own seat (TB-IMP-01)", () => {
  assert.deepEqual(resolve({ targetIds: ["7"] }), {
    kind: "attack",
    playerId: "7",
    title: "Имп атакует",
  });
});

test("an impaired Imp returns the same attack: the shared attack path stops it (TB-IMP-01)", () => {
  assert.deepEqual(resolve({ impaired: true }), resolve());
});

test("an Imp step without a target returns no effect", () => {
  assert.deepEqual(resolve({ targetIds: [] }), { kind: "no-effect" });
});

test("the Imp module declares the attack and the succession as two capabilities (TB-IMP-01)", () => {
  assert.deepEqual(
    role.capabilities.map((capability) => capability.kind),
    ["night-step", "death-trigger"],
  );
  assert.equal("nightStep" in role, false, "the legacy night step is gone");
});
