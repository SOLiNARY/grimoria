import test from "node:test";
import assert from "node:assert/strict";
import { ALL_ROLES, roleTeam } from "../../model/rules.ts";
import type { InformationContext, InformationDecision } from "../ability.ts";
import { informationOf, nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

const MINIONS = ["poisoner", "spy", "scarletwoman", "baron"];

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

test("the Investigator module declares a step for the first night only, with the one-of-two shape (TB-INVESTIGATOR-01)", () => {
  assert.deepEqual(nightStepFor(role, 1), { infoKind: "one-of-two" });
  assert.equal(nightStepFor(role, 2), undefined, "the Investigator starts knowing");
  assert.equal(nightResolverFor(role, 1), undefined, "the step applies nothing");
  assert.equal("nightStep" in role, false, "the legacy night step is gone");
  assert.deepEqual(
    role.capabilities.map((capability) => capability.kind),
    ["night-step", "information"],
  );
});

test("the Investigator shows the answer prepared in setup and names every Minion as possible (TB-INVESTIGATOR-01, SYS-EFFECTS-01)", () => {
  assert.deepEqual(resolve(), { kind: "prepared", possible: MINIONS });
  assert.deepEqual(
    MINIONS,
    ALL_ROLES.filter((id) => roleTeam(id) === "minion"),
    "every Minion of the script in its order, no Demon among them",
  );
});

test("the Investigator reads no fact, so its decision is the same whether or not its owner is drunk or poisoned (TB-INVESTIGATOR-01, SYS-EFFECTS-01)", () => {
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
    ["kind", "possible"],
    "the character and the two players are the setup's",
  );
});

test("the Investigator declares no zero, so an Investigator always learns a character (TB-INVESTIGATOR-01)", () => {
  // Investigator r2983: "You start knowing that 1 of 2 players is a particular
  // Minion." The ability has no zero form.
  const decision = resolve();
  assert.equal(decision.kind, "prepared");
  assert.equal("orZero" in decision, false);
});
