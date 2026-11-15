import test from "node:test";
import assert from "node:assert/strict";
import type { RoleId } from "../../model/types.ts";
import type { AbilityContext } from "../ability.ts";
import { role } from "./role.ts";

const CHARS: Record<string, RoleId> = { "1": "gambler", "2": "chambermaid", "3": "sailor" };

function context(overrides: Partial<AbilityContext> = {}): AbilityContext {
  return {
    actorId: "1",
    targetIds: ["2"],
    chosenRoleId: "chambermaid",
    impaired: false,
    actualRoleOf: (id) => CHARS[id] ?? null,
    hasPlayer: (id) => id in CHARS,
    ...overrides,
  };
}

test("the Gambler module declares its ability resolver", () => {
  assert.ok(role.ability, "the module owns the resolution");
});

test("a wrong Gambler guess returns one fatal intent for the actor (BMR-GAMBLER-01)", () => {
  assert.deepEqual(role.ability?.resolve(context({ chosenRoleId: "fool" })), {
    kind: "effects",
    effects: [{ kind: "kill", playerId: "1", ability: "gambler" }],
  });
});

test("a correct Gambler guess returns no effect", () => {
  assert.deepEqual(role.ability?.resolve(context()), { kind: "no-effect" });
});

test("an impaired Gambler reports a suppressed ability", () => {
  assert.deepEqual(role.ability?.resolve(context({ impaired: true })), { kind: "suppressed" });
});

test("a missing guess, a missing target or an unknown seat returns no effect", () => {
  assert.deepEqual(role.ability?.resolve(context({ chosenRoleId: null })), { kind: "no-effect" });
  assert.deepEqual(role.ability?.resolve(context({ targetIds: [] })), { kind: "no-effect" });
  assert.deepEqual(role.ability?.resolve(context({ targetIds: ["99"] })), { kind: "no-effect" });
});
