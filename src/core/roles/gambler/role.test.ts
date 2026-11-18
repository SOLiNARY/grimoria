import test from "node:test";
import assert from "node:assert/strict";
import type { RoleId } from "../../model/types.ts";
import type { AbilityContext, AbilityDecision } from "../ability.ts";
import { nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

const CHARS: Record<string, RoleId> = { "1": "gambler", "2": "chambermaid", "3": "sailor" };

function context(overrides: Partial<AbilityContext> = {}): AbilityContext {
  return {
    actorId: "1",
    targetIds: ["2"],
    chosenRoleId: "chambermaid",
    drunkId: null,
    impaired: false,
    at: { phase: "night", number: 2 },
    pendings: [],
    actualRoleOf: (id) => CHARS[id] ?? null,
    hasPlayer: (id) => id in CHARS,
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

test("the Gambler module declares its step and its resolver from the second night (BMR-GAMBLER-01)", () => {
  const step = { target: "one-any", canKill: false, noteKey: "note.bmr.gambler" };
  assert.equal(nightStepFor(role, 1), undefined, "Each night*: not on the first night");
  assert.equal(nightResolverFor(role, 1), undefined);
  assert.deepEqual(nightStepFor(role, 2), step);
  assert.deepEqual(nightStepFor(role, 5), step);
  assert.ok(nightResolverFor(role, 2), "the module owns the resolution");
  assert.deepEqual(
    (role.capabilities ?? []).map((capability) => capability.kind),
    ["night-step"],
  );
});

test("a wrong Gambler guess returns one fatal intent for the actor (BMR-GAMBLER-01)", () => {
  assert.deepEqual(resolve({ chosenRoleId: "fool" }), {
    kind: "effects",
    effects: [{ kind: "kill", playerId: "1" }],
  });
});

test("the Gambler may target themself and a wrong self-guess still kills (BMR-GAMBLER-01)", () => {
  assert.deepEqual(resolve({ targetIds: ["1"], chosenRoleId: "gambler" }), {
    kind: "no-effect",
  });
  assert.deepEqual(resolve({ targetIds: ["1"], chosenRoleId: "fool" }), {
    kind: "effects",
    effects: [{ kind: "kill", playerId: "1" }],
  });
});

test("a correct Gambler guess returns no effect", () => {
  assert.deepEqual(resolve(), { kind: "no-effect" });
});

test("an impaired Gambler reports a suppressed ability", () => {
  assert.deepEqual(resolve({ impaired: true }), { kind: "suppressed" });
});

test("a missing guess, a missing target or an unknown seat returns no effect", () => {
  assert.deepEqual(resolve({ chosenRoleId: null }), { kind: "no-effect" });
  assert.deepEqual(resolve({ targetIds: [] }), { kind: "no-effect" });
  assert.deepEqual(resolve({ targetIds: ["99"] }), { kind: "no-effect" });
});
