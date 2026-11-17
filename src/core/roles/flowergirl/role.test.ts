import test from "node:test";
import assert from "node:assert/strict";
import { nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

test("the Flowergirl module declares its step on every night except the first and owns no resolution yet (SNV-FLOWERGIRL-01)", () => {
  for (const night of [2, 5]) {
    assert.deepEqual(nightStepFor(role, night), { target: "none", infoKind: "yes-no" });
    assert.equal(nightResolverFor(role, night), undefined);
  }
  for (const night of [1]) assert.equal(nightStepFor(role, night), undefined);
});
