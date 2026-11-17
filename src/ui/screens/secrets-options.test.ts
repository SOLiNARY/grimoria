// Which answers the Secrets screen may offer: the Librarian's zero, a shown
// character held by a registering Spy or Recluse, and the reminder checklist.
import test from "node:test";
import assert from "node:assert/strict";

import { infoRoleChoices, librarianZeroLegal, reminderRows, zeroShown } from "./secrets-options.ts";

const scriptRoles = [
  "washerwoman",
  "librarian",
  "investigator",
  "chef",
  "recluse",
  "spy",
  "poisoner",
  "imp",
];

test("the Librarian's zero is legal while the only Outsider in play is the Recluse", () => {
  assert.equal(librarianZeroLegal([{ roleId: "recluse" }]), true);
  assert.equal(librarianZeroLegal([{ roleId: "imp" }, { roleId: "chef" }]), true);
  assert.equal(librarianZeroLegal([{ roleId: "recluse" }, { roleId: "saint" }]), false);
});

test("a stored zero is shown as the zero for the Librarian alone (TB-LIBRARIAN-01)", () => {
  // Librarian r1721: "(Or that zero are in play.)" The Washerwoman (r2630) and
  // the Investigator (r2983) always learn a character.
  const zero = { zero: true, pair: [] };
  assert.equal(zeroShown("librarian", zero), true);
  assert.equal(zeroShown("washerwoman", zero), false, "the editor keeps its fields");
  assert.equal(zeroShown("investigator", zero), false, "the editor keeps its fields");
  assert.equal(zeroShown("librarian", { roleId: "saint", pair: ["1", "2"] }), false);
  assert.equal(zeroShown("librarian", null), false);
  assert.equal(zeroShown("librarian", undefined), false);
});

test("a registering Spy adds the not-in-play Townsfolk and Outsider characters", () => {
  const choices = infoRoleChoices({
    team: "townsfolk",
    forDrunk: false,
    held: ["washerwoman", "spy"],
    scriptRoles,
    registering: true,
  });
  assert.ok(choices.includes("chef"), "the not-in-play Chef is offered through the Spy");
  assert.ok(choices.includes("washerwoman"));
  assert.equal(choices.includes("poisoner"), false);
});

test("without a registering character only held characters are offered", () => {
  const choices = infoRoleChoices({
    team: "townsfolk",
    forDrunk: false,
    held: ["washerwoman", "chef"],
    scriptRoles,
    registering: false,
  });
  assert.deepEqual(choices, ["washerwoman", "chef"]);
});

test("a registering Recluse adds the not-in-play Minion characters", () => {
  const choices = infoRoleChoices({
    team: "minion",
    forDrunk: false,
    held: ["investigator", "recluse"],
    scriptRoles,
    registering: true,
  });
  assert.deepEqual(choices, ["spy", "poisoner"]);
});

test("a Drunk shown an information role may be told any role of that team", () => {
  const choices = infoRoleChoices({
    team: "minion",
    forDrunk: true,
    held: [],
    scriptRoles,
    registering: false,
  });
  assert.ok(choices.includes("poisoner"));
  assert.equal(choices.includes("chef"), false);
});

test("the reminder checklist lists every role in play once and skips empty tokens", () => {
  const rows = reminderRows(
    ["washerwoman", "imp", "saint", "imp"],
    {
      washerwoman: ["Горожанин", "Не тот"],
      imp: ["Мёртв"],
      saint: [],
    },
    (id) => id.toUpperCase(),
  );
  assert.deepEqual(rows, [
    { roleId: "washerwoman", name: "WASHERWOMAN", tokens: ["Горожанин", "Не тот"] },
    { roleId: "imp", name: "IMP", tokens: ["Мёртв"] },
  ]);
});
