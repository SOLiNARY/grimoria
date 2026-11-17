import test from "node:test";
import assert from "node:assert/strict";
import { nightArmFor, nightResolverFor, nightStepFor } from "../night-step.ts";
import { role } from "./role.ts";

test("the Clockmaker module declares its step on the first night only and owns no resolution yet (SNV-CLOCKMAKER-01)", () => {
  for (const night of [1]) {
    assert.deepEqual(nightStepFor(role, night), { target: "none", infoKind: "number" });
    assert.equal(nightResolverFor(role, night), undefined);
    assert.equal(nightArmFor(role, night)?.timing, "first");
  }
  for (const night of [2, 5]) assert.equal(nightStepFor(role, night), undefined);
});
