import test from "node:test";
import assert from "node:assert/strict";
import { ALL_ROLES, roleTeam } from "../../model/rules.ts";
import type { InformationContext, InformationDecision } from "../ability.ts";
import { informationOf, nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

const OUTSIDERS = ["butler", "drunk", "recluse", "saint"];

// The module reads nothing, so the context of these tests answers nothing:
// any fact the role reads fails the test.
const untouchable = new Proxy({} as InformationContext, {
  get(_target, fact) {
    throw new Error("the role read " + String(fact));
  },
});

function resolve(facts: InformationContext = untouchable): InformationDecision {
  const information = informationOf(role);
  assert.ok(information, "the module owns the answer");
  return information.resolve(facts);
}

test("the Librarian module declares a step for the first night only, with the one-of-two shape (TB-LIBRARIAN-01)", () => {
  assert.deepEqual(nightStepFor(role, 1), { infoKind: "one-of-two" });
  assert.equal(nightStepFor(role, 2), undefined, "the Librarian starts knowing");
  assert.equal(nightResolverFor(role, 1), undefined, "the step applies nothing");
  assert.equal("nightStep" in role, false, "the legacy night step is gone");
  assert.deepEqual(
    role.capabilities.map((capability) => capability.kind),
    ["night-step", "information"],
  );
});

test("the Librarian shows the answer prepared in setup and names every Outsider as possible (TB-LIBRARIAN-01, SYS-EFFECTS-01)", () => {
  assert.deepEqual(resolve(), { kind: "prepared", possible: OUTSIDERS, orZero: true });
  assert.deepEqual(
    OUTSIDERS,
    ALL_ROLES.filter((id) => roleTeam(id) === "outsider"),
    "every Outsider of the script in its order, the Drunk included",
  );
});

test("the Librarian reads no fact, so its decision is the same whether or not its owner is drunk or poisoned (TB-LIBRARIAN-01, SYS-EFFECTS-01)", () => {
  const read: string[] = [];
  const recording = new Proxy({} as InformationContext, {
    get(_target, fact) {
      read.push(String(fact));
      return undefined;
    },
  });
  const decision = resolve(recording);
  assert.deepEqual(read, [], "no fact is read, `impaired` included");
  assert.deepEqual(
    Object.keys(decision),
    ["kind", "possible", "orZero"],
    "the character, the two players and whether zero are in play are the setup's",
  );
});

test("the Librarian declares that its answer may be a zero (TB-LIBRARIAN-01)", () => {
  // Librarian r1721: "(Or that zero are in play.)"
  const decision = resolve();
  assert.equal(decision.kind, "prepared");
  assert.equal(decision.kind === "prepared" ? decision.orZero : undefined, true);
});
