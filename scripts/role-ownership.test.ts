import test from "node:test";
import assert from "node:assert/strict";
import {
  capabilityKinds,
  engineLocations,
  ownerOf,
  roleModules,
  ruleRows,
} from "./role-ownership.ts";

test("the ledger covers all 72 supported roles once", () => {
  const modules = roleModules();
  assert.equal(modules.length, 72);
  assert.equal(new Set(modules.map((module) => module.id)).size, 72);
});

test("every role dossier names at least one rule identifier", () => {
  for (const module of roleModules()) {
    const rows = ruleRows(module.id);
    assert.ok(rows.length > 0, module.id + " has no rule row");
    assert.ok(
      rows.every((row) => row.revision.startsWith("r")),
      module.id + " has a rule row without a pinned revision",
    );
  }
});

test("the owner classifier separates a capability from an engine branch", () => {
  const facts = roleModules();
  const imp = facts.find((module) => module.id === "imp");
  assert.ok(imp);
  assert.equal(ownerOf(imp, engineLocations("imp")), "capability + engine reference");
  const branch = facts.find((module) => module.id === "soldier");
  assert.ok(branch);
  assert.equal(ownerOf(branch, engineLocations("soldier")), "engine branch");
  assert.equal(ownerOf(undefined, []), "missing module");
});

test("a migrated night step is owned by its module with no engine reference", () => {
  const facts = roleModules();
  for (const id of ["poisoner", "monk"]) {
    const module = facts.find((candidate) => candidate.id === id);
    assert.ok(module, id);
    assert.deepEqual(module.declares, ["capability:night-step"], id);
    assert.deepEqual(engineLocations(id), [], id + " is still named by a coordinator");
    assert.equal(ownerOf(module, engineLocations(id)), "capability");
  }
});

test("a migrated night step keeps the references of the shared mechanic that reads its effect", () => {
  const butler = roleModules().find((candidate) => candidate.id === "butler");
  assert.ok(butler);
  assert.deepEqual(butler.declares, ["capability:night-step"]);
  // The vote check and the effect lookup still name the role; the night
  // completion does not.
  assert.deepEqual(engineLocations("butler"), ["effects.ts×2", "day.ts×1"]);
  assert.equal(ownerOf(butler, engineLocations("butler")), "capability + engine reference");
});

test("a migrated attack keeps the references of the shared succession, not of the step completion", () => {
  const imp = roleModules().find((candidate) => candidate.id === "imp");
  assert.ok(imp);
  assert.deepEqual(imp.declares, ["capability:night-step", "capability:death-trigger"]);
  // The succession fallback, the heir and the new Demon's wake still name the
  // role; the completion of the attack step does not.
  assert.deepEqual(engineLocations("imp"), ["death.ts×2", "night.ts×1", "becoming.ts×3"]);
  assert.equal(ownerOf(imp, engineLocations("imp")), "capability + engine reference");
});

test("a migrated information role is owned by its module once no coordinator names it", () => {
  const empath = roleModules().find((candidate) => candidate.id === "empath");
  assert.ok(empath);
  assert.deepEqual(empath.declares, ["capability:night-step", "capability:information"]);
  // The count, the number shape and the possible answers come from the module;
  // the night completion and the information path read them through the lookup.
  assert.deepEqual(engineLocations("empath"), [], "empath is still named by a coordinator");
  assert.equal(ownerOf(empath, engineLocations("empath")), "capability");
});

test("a migrated information role keeps the references of its setup and its query, not of the night step", () => {
  const fortuneteller = roleModules().find((candidate) => candidate.id === "fortuneteller");
  assert.ok(fortuneteller);
  assert.deepEqual(fortuneteller.declares, ["capability:night-step", "capability:information"]);
  // The red herring is checked and chosen in setup, and the exported query
  // resolves the module's capability; the night completion and the
  // information path of a step no longer name the role.
  assert.deepEqual(engineLocations("fortuneteller"), ["setup.ts×3", "information.ts×1"]);
  assert.equal(
    ownerOf(fortuneteller, engineLocations("fortuneteller")),
    "capability + engine reference",
  );
});

test("only the arms of the capabilities array are reported, not the kinds a resolver returns", () => {
  const source = `
    export const role = {
      id: "example",
      // kind: "comment" is not a declaration
      capabilities: [
        {
          kind: "night-step",
          timing: "any",
          step: { target: "one-any", infoKind: "none" },
          resolve({ impaired }) {
            if (impaired) return { kind: "suppressed" };
            return { kind: "effects", effects: [{ kind: "timed-effect" }], text: 'kind: "quoted"' };
          },
        },
        { kind: "win", resolve: () => ({ kind: "no-effect" }) },
      ],
      other: [{ kind: "ignored" }],
    };`;
  assert.deepEqual(capabilityKinds(source), ["night-step", "win"]);
  assert.deepEqual(capabilityKinds('export const role = { id: "plain" };'), []);
});
