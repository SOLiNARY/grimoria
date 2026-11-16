import test from "node:test";
import assert from "node:assert/strict";
import { SUPPORTED_ROLE_IDS } from "../model/role-ids.ts";
import { nightSequence } from "../model/rules.ts";
import type { AbilityContext, AbilityDecision } from "./ability.ts";
import {
  firstNightStepOf,
  nightResolverFor,
  nightStepFor,
  otherNightStepOf,
} from "./night-step.ts";
import { roleModule } from "./registry.ts";
import type { RoleModule } from "./types.ts";

const FACTS: AbilityContext = {
  actorId: "1",
  targetIds: ["2"],
  chosenRoleId: null,
  impaired: false,
  at: { phase: "night", number: 2 },
  pendings: [],
  actualRoleOf: () => null,
  hasPlayer: () => true,
  nameOf: (id) => "P" + id,
};

const kill = (): AbilityDecision => ({
  kind: "effects",
  effects: [{ kind: "kill", playerId: "2" }],
});
const quiet = (): AbilityDecision => ({ kind: "no-effect" });

test("a legacy module keeps its night step on every night", () => {
  const legacy: RoleModule = { id: "sailor", edition: "bmr", nightStep: { target: "one-any" } };
  assert.deepEqual(nightStepFor(legacy, 1), { target: "one-any" });
  assert.deepEqual(nightStepFor(legacy, 3), { target: "one-any" });
  assert.deepEqual(firstNightStepOf(legacy), { target: "one-any" });
  assert.deepEqual(otherNightStepOf(legacy), { target: "one-any" });
});

test("a legacy first-night step replaces the night step on the first night only", () => {
  const legacy: RoleModule = {
    id: "devilsadvocate",
    edition: "bmr",
    nightStep: { target: "one-any", noteKey: "other" },
    firstNightStep: { target: "one-any", noteKey: "first" },
  };
  assert.equal(nightStepFor(legacy, 1)?.noteKey, "first");
  assert.equal(nightStepFor(legacy, 2)?.noteKey, "other");
  const firstOnly: RoleModule = {
    id: "clockmaker",
    edition: "snv",
    firstNightStep: { target: "none", infoKind: "number" },
  };
  assert.deepEqual(nightStepFor(firstOnly, 1), { target: "none", infoKind: "number" });
  assert.equal(nightStepFor(firstOnly, 2), undefined);
});

test("a night-step arm for any night declares the step for every night", () => {
  const module: RoleModule = {
    id: "poisoner",
    edition: "tb",
    capabilities: [{ kind: "night-step", timing: "any", step: { target: "one-any" } }],
  };
  assert.deepEqual(nightStepFor(module, 1), { target: "one-any" });
  assert.deepEqual(nightStepFor(module, 4), { target: "one-any" });
});

test("first and other arms split a role whose first night differs", () => {
  const module: RoleModule = {
    id: "devilsadvocate",
    edition: "bmr",
    capabilities: [
      { kind: "night-step", timing: "first", step: { target: "none" }, resolve: quiet },
      { kind: "night-step", timing: "other", step: { target: "one-any" }, resolve: kill },
    ],
  };
  assert.deepEqual(nightStepFor(module, 1), { target: "none" });
  assert.deepEqual(nightStepFor(module, 2), { target: "one-any" });
  assert.deepEqual(nightResolverFor(module, 1)?.(FACTS), { kind: "no-effect" });
  assert.equal(nightResolverFor(module, 2)?.(FACTS).kind, "effects");
});

test("an arm for other nights declares nothing on the first night", () => {
  const module: RoleModule = {
    id: "monk",
    edition: "tb",
    capabilities: [
      { kind: "night-step", timing: "other", step: { target: "one-other" }, resolve: kill },
    ],
  };
  assert.equal(nightStepFor(module, 1), undefined);
  assert.equal(nightResolverFor(module, 1), undefined);
  assert.deepEqual(nightStepFor(module, 2), { target: "one-other" });
  assert.ok(nightResolverFor(module, 2));
});

test("a module without a night-step arm resolves through its legacy ability", () => {
  const legacy: RoleModule = {
    id: "gambler",
    edition: "bmr",
    nightStep: { target: "one-any" },
    ability: { resolve: kill },
  };
  assert.equal(nightResolverFor(legacy, 1)?.(FACTS).kind, "effects");
  assert.equal(nightResolverFor(legacy, 2)?.(FACTS).kind, "effects");
});

test("an arm without a resolver leaves the completed step to the engine", () => {
  const module: RoleModule = {
    id: "chef",
    edition: "tb",
    capabilities: [{ kind: "night-step", timing: "first", step: { target: "none" } }],
  };
  assert.equal(nightResolverFor(module, 1), undefined);
  assert.equal(nightResolverFor(null, 1), undefined);
  assert.equal(nightStepFor(null, 1), undefined);
  assert.equal(nightStepFor(undefined, 2), undefined);
});

function nightArms(module: RoleModule) {
  return (module.capabilities ?? []).filter((capability) => capability.kind === "night-step");
}

test("a module declares its night step once: a night-step arm or the legacy fields", () => {
  for (const id of SUPPORTED_ROLE_IDS) {
    const module = roleModule(id)!;
    if (!nightArms(module).length) continue;
    assert.equal(module.nightStep, undefined, id + " keeps a legacy nightStep beside its arm");
    assert.equal(module.firstNightStep, undefined, id + " keeps a legacy firstNightStep");
    assert.equal(module.ability, undefined, id + " keeps a legacy ability beside its arm");
  }
});

test("a night-step arm agrees with the printed night order of its edition", () => {
  for (const id of SUPPORTED_ROLE_IDS) {
    const module = roleModule(id)!;
    const arms = nightArms(module);
    const first = nightSequence(1, module.edition).includes(id);
    const other = nightSequence(2, module.edition).includes(id);
    const timings = arms.map((capability) => capability.timing).sort();
    assert.equal(new Set(timings).size, timings.length, id + " repeats a night-step timing");
    for (const timing of timings) {
      if (timing === "any") {
        assert.ok(first && other, id + " is declared for any night but does not wake on both");
        assert.equal(timings.length, 1, id + " mixes an any-night arm with another arm");
      }
      if (timing === "first")
        assert.ok(first, id + " has a first-night arm but no first-night slot");
      if (timing === "other") {
        assert.ok(other, id + " has an other-night arm but no other-night slot");
        if (!timings.includes("first")) {
          assert.equal(first, false, id + " wakes on the first night without a declared step");
        }
      }
    }
  }
});

test("the migrated Trouble Brewing roles resolve from their modules", () => {
  assert.ok(nightResolverFor(roleModule("poisoner"), 1));
  assert.ok(nightResolverFor(roleModule("poisoner"), 2));
  assert.ok(nightResolverFor(roleModule("monk"), 2));
  assert.equal(nightResolverFor(roleModule("monk"), 1), undefined, "the Monk sleeps on night 1");
  assert.ok(nightResolverFor(roleModule("butler"), 1));
  assert.ok(nightResolverFor(roleModule("butler"), 2));
  assert.equal(nightResolverFor(roleModule("imp"), 2), undefined, "not migrated yet");
});
