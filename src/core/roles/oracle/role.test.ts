import test from "node:test";
import assert from "node:assert/strict";
import { nightArmFor, nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

test("the Oracle module declares its step on every night except the first and owns no resolution yet (SNV-ORACLE-01)", () => {
  for (const night of [2, 5]) {
    assert.deepEqual(nightStepFor(role, night), { target: "none", infoKind: "number" });
    assert.equal(nightResolverFor(role, night), undefined);
    assert.equal(nightArmFor(role, night)?.timing, "other");
  }
  for (const night of [1]) assert.equal(nightStepFor(role, night), undefined);
});
