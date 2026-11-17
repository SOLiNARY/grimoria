import test from "node:test";
import assert from "node:assert/strict";
import type { RoleId } from "../../model/types.ts";
import type { AbilityContext, AbilityDecision } from "../ability.ts";
import { nightArmFor, nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

const SEATS: Record<string, RoleId> = {
  "2": "exorcist",
  "4": "chambermaid",
  "6": "assassin",
  "7": "po",
};

function context(overrides: Partial<AbilityContext> = {}): AbilityContext {
  return {
    actorId: "2",
    targetIds: ["7"],
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

const BLOCK = {
  kind: "block-demon",
  playerId: "7",
  note: {
    key: "note.exorcistBlocked",
    vars: { name: "P2" },
    text: "Экзорцист (P2) выбрал Демона. Демон узнаёт Экзорциста и не просыпается.",
  },
  log: {
    title: "Экзорцист выбрал Демона",
    detail: "P7 узнаёт Экзорциста и не действует этой ночью.",
  },
};

test("the Exorcist module declares a step from the second night and ends nothing on use (BMR-EXORCIST-01)", () => {
  assert.equal(nightStepFor(role, 1), undefined);
  assert.equal(nightResolverFor(role, 1), undefined);
  for (const night of [2, 5]) {
    assert.deepEqual(nightStepFor(role, night), {
      target: "one-any",
      noteKey: "note.bmr.exorcist",
    });
    assert.equal(nightArmFor(role, night)?.endsOnUse, undefined);
  }
});

test("a healthy Exorcist who chooses the Demon records the choice and keeps the Demon asleep (BMR-EXORCIST-01, BMR-EXORCIST-02)", () => {
  assert.deepEqual(resolve(), {
    kind: "effects",
    effects: [{ kind: "record-choice", playerId: "7" }, BLOCK],
  });
});

test("an Exorcist who chooses a player who is not the Demon only records the choice (BMR-EXORCIST-01, BMR-EXORCIST-02)", () => {
  for (const playerId of ["4", "6", "2", "9"]) {
    assert.deepEqual(resolve({ targetIds: [playerId] }), {
      kind: "effects",
      effects: [{ kind: "record-choice", playerId }],
    });
  }
});

test("an impaired Exorcist stops nobody but the choice is recorded (BMR-EXORCIST-01, BMR-EXORCIST-02)", () => {
  assert.deepEqual(resolve({ impaired: true }), {
    kind: "suppressed",
    effects: [{ kind: "record-choice", playerId: "7" }],
  });
});

test("an Exorcist step without a player records that nobody was chosen", () => {
  assert.deepEqual(resolve({ targetIds: [] }), {
    kind: "effects",
    effects: [{ kind: "record-choice", playerId: null }],
  });
  assert.deepEqual(resolve({ targetIds: [], impaired: true }), {
    kind: "suppressed",
    effects: [{ kind: "record-choice", playerId: null }],
  });
});
