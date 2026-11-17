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

test("the Gambler and the Pukka declare their resolver on the night-step capability", () => {
  const facts = roleModules();
  const gambler = facts.find((candidate) => candidate.id === "gambler");
  assert.ok(gambler);
  assert.deepEqual(gambler.declares, ["capability:night-step"]);
  // The step builder still names the role for the list of characters to guess.
  assert.deepEqual(engineLocations("gambler"), ["bmr.ts×1"]);
  assert.equal(ownerOf(gambler, engineLocations("gambler")), "capability + engine reference");
  const pukka = facts.find((candidate) => candidate.id === "pukka");
  assert.ok(pukka);
  assert.deepEqual(pukka.declares, ["capability:night-step"]);
  // The Demon set, the Exorcist's block, the outcome panel and the delayed
  // death still name the role; the step completion does not.
  assert.deepEqual(engineLocations("pukka"), ["bmr.ts×3", "pukka.ts×1"]);
  assert.equal(ownerOf(pukka, engineLocations("pukka")), "capability + engine reference");
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

test("a migrated information role whose query stays keeps that one reference", () => {
  const chef = roleModules().find((candidate) => candidate.id === "chef");
  assert.ok(chef);
  assert.deepEqual(chef.declares, ["capability:night-step", "capability:information"]);
  // The count, the legal range and the step shape come from the module. The
  // exported count query resolves the module; nothing else names the role.
  assert.deepEqual(engineLocations("chef"), ["information.ts×1"]);
  assert.equal(ownerOf(chef, engineLocations("chef")), "capability + engine reference");
});

test("a role that moved only its answer still reports the legacy step that wakes it", () => {
  const undertaker = roleModules().find((candidate) => candidate.id === "undertaker");
  assert.ok(undertaker);
  // The character on record and the legal registrations come from the module.
  // Who wakes is still the legacy step, whose hooks read the game.
  assert.deepEqual(undertaker.declares, ["nightStep", "capability:information"]);
  assert.deepEqual(engineLocations("undertaker"), [], "undertaker is still named by a coordinator");
  assert.equal(ownerOf(undertaker, engineLocations("undertaker")), "capability");
});

test("a role woken by its own death keeps the references of that wake, not of the answer", () => {
  const ravenkeeper = roleModules().find((candidate) => candidate.id === "ravenkeeper");
  assert.ok(ravenkeeper);
  assert.deepEqual(ravenkeeper.declares, ["nightStep", "capability:information"]);
  // The step inserted on the night of the death still names the role; the
  // information path and the completion of the step do not.
  assert.deepEqual(engineLocations("ravenkeeper"), ["night.ts×4"]);
  assert.equal(
    ownerOf(ravenkeeper, engineLocations("ravenkeeper")),
    "capability + engine reference",
  );
});

test("a role whose answer is prepared in setup keeps the references of setup, not of the night step", () => {
  const facts = roleModules();
  for (const [id, locations] of [
    ["washerwoman", ["setup.ts×3"]],
    ["librarian", ["setup.ts×4"]],
    ["investigator", ["setup.ts×2"]],
  ] as const) {
    const module = facts.find((candidate) => candidate.id === id);
    assert.ok(module, id);
    assert.deepEqual(module.declares, ["capability:night-step", "capability:information"], id);
    // The check and the choice of the prepared answer are setup and still name
    // the role; the night completion and the information path do not.
    assert.deepEqual(engineLocations(id), locations, id);
    assert.equal(ownerOf(module, engineLocations(id)), "capability + engine reference", id);
  }
});

test("the Spy declares its step and its answer and keeps the references of its registration", () => {
  const spy = roleModules().find((candidate) => candidate.id === "spy");
  assert.ok(spy);
  assert.deepEqual(spy.declares, [
    "capability:night-step",
    "capability:information",
    "capability:adjudication",
  ]);
  // Who the Spy may register as is read where a registration is applied, in
  // the Virgin's nomination and in the check of a prepared answer. The night
  // completion names no role for its answer, and neither does `infoForStep`.
  assert.deepEqual(engineLocations("spy"), ["day.ts×1", "setup.ts×2", "information.ts×4"]);
  assert.equal(ownerOf(spy, engineLocations("spy")), "capability + engine reference");
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
