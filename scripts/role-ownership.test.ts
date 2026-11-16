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
  const branch = facts.find((module) => module.id === "butler");
  assert.ok(branch);
  assert.equal(ownerOf(branch, engineLocations("butler")), "engine branch");
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
