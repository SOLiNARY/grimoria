import assert from "node:assert/strict";
import test from "node:test";
import { start, restorePath } from "./history-router.ts";

test("release shortcuts use native fragment navigation and Pages restores the fragment on direct visits", (t) => {
  const location = new URL("https://example.test/grimoria/changelog");
  const document = new EventTarget();
  class Anchor {
    href = new URL("#release-0.1.0", location).href;
    closest() {
      return this;
    }
    hasAttribute() {
      return false;
    }
  }
  for (const [key, value] of Object.entries({
    window: Object.assign(new EventTarget(), { location }),
    document,
    Element: Anchor,
  })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() =>
      descriptor
        ? Object.defineProperty(globalThis, key, descriptor)
        : Reflect.deleteProperty(globalThis, key),
    );
  }
  let routes = 0;
  start({ root: "/grimoria/", handler: () => routes++ });
  const click = Object.assign(new Event("click", { cancelable: true }), { button: 0 });
  Object.defineProperty(click, "target", { value: new Anchor() });
  document.dispatchEvent(click);
  assert.equal(click.defaultPrevented, false);
  assert.equal(routes, 1);
  assert.equal(
    restorePath("/grimoria/changelog#release-0.1.0"),
    "/grimoria/changelog#release-0.1.0",
  );
});
