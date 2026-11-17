import test from "node:test";
import assert from "node:assert/strict";
import type { InformationContext, InformationDecision } from "../ability.ts";
import { informationOf, nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

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

test("the Spy module declares a step for every night with the grimoire shape (TB-SPY-01)", () => {
  assert.deepEqual(nightStepFor(role, 1), { infoKind: "grimoire" });
  assert.deepEqual(nightStepFor(role, 2), { infoKind: "grimoire" }, "each night");
  assert.equal(nightResolverFor(role, 1), undefined, "the step applies nothing");
  assert.equal(nightResolverFor(role, 2), undefined);
  assert.equal("nightStep" in role, false, "the legacy night step is gone");
  assert.deepEqual(
    role.capabilities.map((capability) => capability.kind),
    ["night-step", "information", "adjudication"],
    "the registration stays declared beside the step",
  );
});

test("the Spy sees the Grimoire (TB-SPY-01)", () => {
  assert.deepEqual(resolve(), { kind: "grimoire" });
});

test("the Spy reads no fact, so its decision is the same whether or not its owner is drunk or poisoned (TB-SPY-01, SYS-EFFECTS-01)", () => {
  const read: string[] = [];
  const recording = new Proxy({} as InformationContext, {
    get(_target, fact) {
      read.push(String(fact));
      return undefined;
    },
  });
  const decision = resolve(recording);
  assert.deepEqual(read, [], "no fact is read, `impaired` included");
  assert.deepEqual(Object.keys(decision), ["kind"], "the Grimoire has no value a role could name");
});
