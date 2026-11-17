import test from "node:test";
import assert from "node:assert/strict";
import type { AbilityContext, AbilityDecision } from "../ability.ts";
import { nightResolverFor, nightStepFor } from "../night-step.ts";
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

// The reminder on the seat and the restriction that lasts through the next
// day's votes, until the following dusk.
const choice = (masterId: string, night: number) => [
  { kind: "record-master", playerId: masterId },
  {
    kind: "timed-effect",
    effect: "butler",
    playerId: masterId,
    expires: { phase: "night", number: night + 1 },
  },
];

test("the Butler module declares one step for every night (TB-BUTLER-01)", () => {
  assert.deepEqual(nightStepFor(role, 1), { target: "one-other" });
  assert.deepEqual(nightStepFor(role, 2), { target: "one-other" });
});

test("a healthy Butler records the master and is bound through tomorrow's votes (TB-BUTLER-01)", () => {
  assert.deepEqual(resolve(), {
    kind: "effects",
    effects: choice("2", 2),
    note: {
      key: "note.butlerMaster",
      vars: { name: "P2" },
      text: "Завтра голосует только вместе с: P2.",
    },
  });
});

test("the first-night choice also ends at the next dusk (TB-BUTLER-01)", () => {
  const decision = resolve({ at: { phase: "night", number: 1 } });
  assert.equal(decision.kind, "effects");
  if (decision.kind !== "effects") return;
  assert.deepEqual(decision.effects, choice("2", 1));
});

test("an impaired Butler still records the choice, as a suppressed ability (TB-BUTLER-01)", () => {
  assert.deepEqual(resolve({ impaired: true }), {
    kind: "suppressed",
    effects: choice("2", 2),
  });
});

test("the Butler does not replace an earlier record: it expires by its own date (TB-BUTLER-01)", () => {
  const decision = resolve();
  assert.equal(decision.kind, "effects");
  if (decision.kind !== "effects") return;
  const dated = decision.effects.find((effect) => effect.kind === "timed-effect");
  assert.ok(dated);
  assert.equal("replacesPrevious" in dated, false);
});

test("a Butler step without a target returns no effect", () => {
  assert.deepEqual(resolve({ targetIds: [] }), { kind: "no-effect" });
});
