import test from "node:test";
import assert from "node:assert/strict";
import type { RoleId } from "../../model/types.ts";
import type { AbilityContext, AbilityDecision, PendingDeathFact } from "../ability.ts";
import { nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

const CHARS: Record<string, RoleId> = { "1": "pukka", "2": "chambermaid", "3": "sailor" };

function pending(overrides: Partial<PendingDeathFact> = {}): PendingDeathFact {
  return {
    id: "eff-pukka-death-1-2",
    playerId: "3",
    suspended: false,
    resumeOnHealthy: false,
    resolveAtNight: 2,
    ...overrides,
  };
}

function context(overrides: Partial<AbilityContext> = {}): AbilityContext {
  return {
    actorId: "1",
    targetIds: ["2"],
    chosenRoleId: null,
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

test("the Pukka module declares one step and one resolver for every night (BMR-PUKKA-01)", () => {
  const step = { target: "one-any", noteKey: "note.bmr.pukka" };
  assert.deepEqual(nightStepFor(role, 1), step, "the Pukka acts during the first night");
  assert.deepEqual(nightStepFor(role, 2), step);
  assert.ok(nightResolverFor(role, 1), "the module owns the resolution");
  assert.equal(nightResolverFor(role, 1), nightResolverFor(role, 4));
  assert.deepEqual(
    (role.capabilities ?? []).map((capability) => capability.kind),
    ["night-step"],
  );
});

test("the Pukka's first choice poisons and delays the death to the second night (BMR-PUKKA-01)", () => {
  assert.deepEqual(resolve({ at: { phase: "night", number: 1 } }), {
    kind: "effects",
    effects: [
      { kind: "poison", playerId: "2" },
      { kind: "delay-death", playerId: "2", resolveAtNight: 2 },
    ],
    result: { deaths: [], resolved: null, poisonedId: "2" },
  });
});

test("the Pukka poisons the new target before resolving the previous death (BMR-PUKKA-04)", () => {
  assert.deepEqual(resolve({ pendings: [pending()] }), {
    kind: "effects",
    effects: [
      { kind: "poison", playerId: "2" },
      { kind: "delay-death", playerId: "2", resolveAtNight: 3 },
      { kind: "resolve-death", pendingId: "eff-pukka-death-1-2" },
    ],
    result: { deaths: [], resolved: null, poisonedId: "2" },
  });
});

test("a Pukka self-target suspends the previous death and releases other poisons (BMR-PUKKA-06)", () => {
  assert.deepEqual(resolve({ targetIds: ["1"], pendings: [pending()] }), {
    kind: "effects",
    effects: [
      { kind: "poison", playerId: "1" },
      { kind: "delay-death", playerId: "1", resolveAtNight: 3 },
      {
        kind: "suspend-death",
        pendingId: "eff-pukka-death-1-2",
        reason: "self-target",
        resumeOnHealthy: true,
      },
      { kind: "release-poisons", keepPlayerId: "1" },
    ],
    result: { deaths: [], resolved: null, poisonedId: "1", suspended: true },
  });
});

test("an impaired Pukka suspends a due pending death and reports the rule note (BMR-PUKKA-03)", () => {
  assert.deepEqual(
    resolve({
      impaired: true,
      pendings: [pending(), pending({ id: "later", resolveAtNight: 4 })],
    }),
    {
      kind: "suppressed",
      effects: [{ kind: "suspend-death", pendingId: "eff-pukka-death-1-2", reason: "impaired" }],
      noteKey: "note.pukkaSuspended",
      text: "Способность не сработала: Пукка отравлен или пьян. Яд на прежней цели приостановлен.",
      result: { deaths: [], poisonedId: null, suspended: true },
    },
  );
});

test("a Pukka step without a target has no effect", () => {
  assert.deepEqual(resolve({ targetIds: [] }), { kind: "no-effect" });
});
