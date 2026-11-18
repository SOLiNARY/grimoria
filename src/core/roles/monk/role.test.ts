import test from "node:test";
import assert from "node:assert/strict";
import type { AbilityContext, AbilityDecision } from "../ability.ts";
import { nightResolverFor, nightStepFor } from "../night-step.ts";
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

test("the Monk module declares a step for every night except the first (TB-MONK-01)", () => {
  assert.equal(nightStepFor(role, 1), undefined);
  assert.equal(nightResolverFor(role, 1), undefined);
  assert.deepEqual(nightStepFor(role, 2), { target: "one-other" });
  assert.deepEqual(nightStepFor(role, 5), { target: "one-other" });
});

test("a healthy Monk returns one protection that ends at dawn (TB-MONK-01)", () => {
  assert.deepEqual(resolve(), {
    kind: "effects",
    effects: [
      {
        kind: "timed-effect",
        effect: "protected",
        playerId: "4",
        expires: { phase: "day", number: 2 },
        replacesPrevious: true,
      },
    ],
    note: { key: "note.protected", vars: { name: "P4" }, text: "Защищён этой ночью: P4." },
  });
});

test("the Monk protection belongs to the night it was given (TB-MONK-01)", () => {
  const decision = resolve({ at: { phase: "night", number: 4 }, targetIds: ["5"] });
  assert.equal(decision.kind, "effects");
  if (decision.kind !== "effects") return;
  assert.deepEqual(decision.effects, [
    {
      kind: "timed-effect",
      effect: "protected",
      playerId: "5",
      expires: { phase: "day", number: 4 },
      replacesPrevious: true,
    },
  ]);
});

test("an impaired Monk reports a suppressed ability (TB-MONK-01)", () => {
  assert.deepEqual(resolve({ impaired: true }), { kind: "suppressed" });
});

test("a Monk step without a target returns no effect", () => {
  assert.deepEqual(resolve({ targetIds: [] }), { kind: "no-effect" });
});
