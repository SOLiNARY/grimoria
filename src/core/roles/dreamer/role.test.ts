import test from "node:test";
import assert from "node:assert/strict";
import { nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

test("the Dreamer module declares its step on every night and owns no resolution yet (SNV-DREAMER-01)", () => {
  for (const night of [1, 2, 5]) {
    assert.deepEqual(nightStepFor(role, night), { target: "one-any", infoKind: "note" });
    assert.equal(nightResolverFor(role, night), undefined);
  }
});
