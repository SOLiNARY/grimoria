import test from "node:test";
import assert from "node:assert/strict";
import type { TransformationContext, TransformationDecision } from "../ability.ts";
import { nightArmFor, nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

const ROLES: Record<string, string> = { "3": "snakecharmer", "7": "pithag", "8": "nodashii" };

function swapOf(overrides: Partial<TransformationContext> = {}): TransformationDecision {
  const capability = role.capabilities.find((candidate) => candidate.kind === "transformation");
  assert.ok(capability && capability.kind === "transformation");
  return capability.resolve({
    actorId: "3",
    targetId: "8",
    newRoleId: "nodashii",
    cause: "snakecharmer",
    impaired: false,
    at: { phase: "night", number: 2 },
    roleInPlay: () => true,
    nameOf: (id) => "P" + id,
    actualRoleOf: (id) => ROLES[id] ?? null,
    hasPlayer: (id) => id in ROLES,
    ...overrides,
  });
}

test("the Snake Charmer module declares one step for every night and owns no night-step resolution (SNV-SNAKECHARMER-01)", () => {
  for (const night of [1, 2, 5]) {
    assert.deepEqual(nightStepFor(role, night), { target: "one-any", infoKind: "note" });
    assert.equal(nightArmFor(role, night)?.timing, "any");
    assert.equal(nightResolverFor(role, night), undefined);
  }
});

test("a healthy Snake Charmer who chooses the Demon swaps characters and alignments with it and poisons it (SNV-SNAKECHARMER-01)", () => {
  assert.deepEqual(swapOf(), { kind: "swap", playerId: "8", alignments: true, poisoned: true });
});

test("a Snake Charmer who chooses a player who is not the Demon, or who is drunk or poisoned, changes nothing (SNV-SNAKECHARMER-01)", () => {
  assert.deepEqual(swapOf({ targetId: "7", newRoleId: "pithag" }), {
    kind: "no-effect",
    reason: "not-demon",
  });
  assert.deepEqual(swapOf({ targetId: "3", newRoleId: "snakecharmer" }), {
    kind: "no-effect",
    reason: "not-demon",
  });
  assert.deepEqual(swapOf({ impaired: true }), { kind: "no-effect", reason: "impaired" });
});
