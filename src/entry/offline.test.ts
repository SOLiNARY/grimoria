import assert from "node:assert/strict";
import test from "node:test";
import { createNotesDraft } from "../ui/notes-draft.ts";

test("an update cannot write a pending note over a replacement game or an external edit", () => {
  for (const replacement of [
    { createdAt: "another game", notes: "saved" },
    { createdAt: "same game", notes: "imported" },
  ]) {
    let state = { createdAt: "same game", notes: "saved" };
    const notes = createNotesDraft(() => state);
    notes.edit("pending");
    state = replacement;
    assert.equal(
      notes.flush(() => assert.fail("stale draft was dispatched")),
      true,
    );
    assert.equal(notes.read(), replacement.notes);
  }
});

test("an active window confirms an opening update and can retry a failed save before or after activation", async (t) => {
  const values = new Map<string, string>();
  let writable = true;
  let activations = 0;
  let reloads = 0;
  const worker = Object.assign(new EventTarget(), {
    state: "installed",
    postMessage() {
      activations++;
    },
  });
  const registration = Object.assign(new EventTarget(), {
    installing: null,
    waiting: worker as typeof worker | null,
    update: async () => {},
  });
  const serviceWorker = Object.assign(new EventTarget(), {
    controller: {},
    register: async () => registration,
  });
  const element = () => Object.assign(new EventTarget(), { dataset: { state: "" }, hidden: false });
  const elements = new Map(
    ["update-banner", "update-message", "update-now", "update-later"].map((id) => [id, element()]),
  );
  const globals = {
    document: Object.assign(new EventTarget(), {
      documentElement: {},
      getElementById: (id: string) => elements.get(id),
    }),
    navigator: { serviceWorker },
    MutationObserver: class {
      observe() {}
    },
    location: {
      reload() {
        reloads++;
      },
    },
    window: new EventTarget(),
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem(key: string, value: string) {
        if (!writable) throw new Error("Quota exceeded");
        values.set(key, value);
      },
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    const before = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => {
      if (before) Object.defineProperty(globalThis, key, before);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const { state, dispatch, save } = await import("./store.ts");
  const { prepareOffline } = await import("./offline.ts");
  state.phase = "night";
  assert.ok(save());
  const notesDraft = createNotesDraft(() => state);
  const flushNotes = () =>
    notesDraft.flush(
      (notes) => dispatch({ type: "setNotes", payload: { notes } }).status === "allowed",
    );
  const banner = elements.get("update-banner")!;
  const pressUpdate = async () => {
    elements.get("update-now")!.dispatchEvent(new Event("click"));
    t.mock.timers.tick(0);
    await Promise.resolve();
  };

  await prepareOffline(flushNotes);
  t.mock.timers.tick(0);
  await Promise.resolve();
  assert.equal(activations, 0, "opening an active game asks first");
  assert.equal(banner.dataset.state, "available");

  writable = false;
  notesDraft.edit("Pending note");
  assert.equal(flushNotes(), false, "a rejected edit stays in the editor");
  assert.equal(notesDraft.read(), "Pending note");
  await pressUpdate();
  assert.equal(activations, 0, "a failed save keeps the worker waiting");
  assert.equal(banner.dataset.state, "saveFailed");

  writable = true;
  await pressUpdate();
  assert.equal(activations, 1);
  assert.equal(JSON.parse(values.get("pg.game.v4")!).notes, "Pending note");
  registration.waiting = null;
  serviceWorker.controller = worker;
  state.notes = "New note before reload";
  writable = false;
  serviceWorker.dispatchEvent(new Event("controllerchange"));
  assert.equal(reloads, 0, "a later failed save keeps the active tab open");
  assert.equal(banner.dataset.state, "saveFailed");

  writable = true;
  await pressUpdate();
  assert.equal(reloads, 1, "a retry also works after the worker took control");
  assert.equal(JSON.parse(values.get("pg.game.v4")!).notes, state.notes);
});
