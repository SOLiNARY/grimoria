import test from "node:test";
import assert from "node:assert/strict";
import type { RoleId } from "../../model/types.ts";
import type { AbilityContext, PendingDeathFact } from "../ability.ts";
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
    impaired: false,
    at: { phase: "night", number: 2 },
    pendings: [],
    actualRoleOf: (id) => CHARS[id] ?? null,
    hasPlayer: (id) => id in CHARS,
    ...overrides,
  };
}

test("the Pukka module declares its ability resolver", () => {
  assert.ok(role.ability, "the module owns the resolution");
});

test("the Pukka poisons the new target before resolving the previous death (BMR-PUKKA-04)", () => {
  assert.deepEqual(role.ability?.resolve(context({ pendings: [pending()] })), {
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
  assert.deepEqual(role.ability?.resolve(context({ targetIds: ["1"], pendings: [pending()] })), {
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
    role.ability?.resolve(
      context({
        impaired: true,
        pendings: [pending(), pending({ id: "later", resolveAtNight: 4 })],
      }),
    ),
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
  assert.deepEqual(role.ability?.resolve(context({ targetIds: [] })), { kind: "no-effect" });
});
