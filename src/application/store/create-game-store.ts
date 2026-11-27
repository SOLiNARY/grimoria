// The engine validates and executes the command on an isolated draft. The
// store persists the result before handing that draft to its subscribers.
import type {
  CommandInput,
  PrepareResult,
  PreparedCommand,
} from "../../core/commands/contracts.ts";
import {
  RULESET_VERSION,
  SUPPORTED_RULESET_VERSIONS,
  applyCommand,
  previewCommand,
  replay,
} from "../../core/engine/index.ts";
import { createGame, exportGame, importGame, validateState } from "../../core/model/state.ts";
import type { GameState, JournalEntry } from "../../core/model/types.ts";
import { prepareCommand } from "../../core/commands/prepare.ts";
import type { DispatchResult, DomainOutcome } from "../../core/commands/result.ts";
import { cloneValidated, validatedFromUnknown } from "../../core/model/validated.ts";
import { asDomainOutcome } from "../dispatch/adopt.ts";
import type { ValidatedState } from "../../core/model/validated.ts";
import type { StorePorts } from "../ports/index.ts";

export type SaveStatus =
  | { status: "saved" }
  | { status: "failed"; errorCode: "persist-failed"; error: string; at: string };

export interface GameSnapshot {
  readonly state: ValidatedState;
  readonly gameRevision: number;
  readonly viewVersion: number;
  readonly save: SaveStatus;
}

export interface SaveOutcome {
  ok: boolean;
  error: string | null;
}

export type StoreMutationResult =
  | { ok: true; snapshot: GameSnapshot }
  | {
      ok: false;
      errorCode: "persist-failed" | "nothing-to-undo" | "nothing-to-redo" | "journal-dependency";
      error: string;
      snapshot: GameSnapshot;
    };

export interface LoadStatus {
  ok: boolean;
  error: string | null;
  backupKey: string | null;
  migrated: boolean;
}

export interface RunOutcome extends SaveOutcome {
  persisted?: boolean;
  result?: unknown;
}

export interface GameStore {
  readonly state: ValidatedState;
  readonly loadStatus: LoadStatus;
  prepare(input: CommandInput): PrepareResult;
  /** A fresh id from the injected source, for previews and host actions. */
  nextCommandId(): string;
  preview(command: PreparedCommand): DomainOutcome;
  dispatch(command: PreparedCommand): DispatchResult;
  persist(): SaveOutcome;
  undo(): StoreMutationResult;
  redo(): StoreMutationResult;
  reset(count: number): StoreMutationResult;
  replaceState(next: GameState): StoreMutationResult;
  run(mutator: (state: GameState) => unknown): RunOutcome;
  importGame(text: string): { ok: true } | { ok: false; error: string };
  exportGame(notes?: string): string;
  getSnapshot(): GameSnapshot;
  subscribe(listener: () => void): () => void;
  canUndo(): boolean;
  canRedo(): boolean;
  hasLocalChanges(): boolean;
  clearSaveError(): void;
  dispose(): void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function serialize(value: GameState): string {
  return JSON.stringify({ ...value, storageError: null });
}

function replaceContents(target: GameState, source: GameState): void {
  for (const key of Object.keys(target)) Reflect.deleteProperty(target, key);
  Object.assign(target, source);
}

function clone(value: ValidatedState): ValidatedState {
  return cloneValidated(value);
}

export function createGameStore(ports: StorePorts): GameStore {
  const { storage, clock, ids } = ports;
  const listeners = new Set<() => void>();
  // Undo and redo are journal replays; only the legacy run(mutator) path keeps
  // one pre-mutation snapshot because an arbitrary mutation cannot be replayed.
  const redoStack: { entry: JournalEntry; index: number }[] = [];
  let legacyUndo: { state: ValidatedState; floor: number } | null = null;

  const loadStatus: LoadStatus = { ok: true, error: null, backupKey: null, migrated: false };
  let save: SaveStatus = { status: "saved" };
  let viewVersion = 0;

  const loaded = load();
  const state = loaded.state;
  let diskSnapshot = loaded.disk;
  let pristineSnapshot = capturePristineSnapshot();
  let savedRevision = loaded.revision;
  // Commands that arrived with the load are history for replay, not for undo.
  let undoFloor = state.journal?.entries?.length || 0;

  let snapshot = build();
  const stopWatching = storage.watch(() => {
    // Another window wrote; adopt only when this window has nothing pending.
    if (hasLocalChanges()) return;
    let raw: string | null;
    try {
      raw = storage.readRaw();
    } catch {
      return;
    }
    reload(raw);
  });

  function build(): GameSnapshot {
    return { state, gameRevision: Number(state.revision) || 0, viewVersion, save };
  }

  function publish(): void {
    viewVersion += 1;
    snapshot = build();
    // Snapshot: a listener may unsubscribe while the others run.
    for (const listener of Array.from(listeners)) {
      try {
        listener();
      } catch {
        // One failing listener must not block the others or the transaction.
      }
    }
  }

  function clearLoadStatus(): void {
    Object.assign(loadStatus, { ok: true, error: null, backupKey: null, migrated: false });
    save = { status: "saved" };
  }

  function load(): { state: ValidatedState; disk: string | null; revision: number } {
    clearLoadStatus();
    let raw: string | null = null;
    let readError = false;
    try {
      raw = storage.readRaw();
    } catch {
      readError = true;
    }
    if (!raw && !readError) {
      const fallback = readFallback();
      if (fallback) {
        let fallbackValue: unknown;
        try {
          fallbackValue = JSON.parse(fallback.value);
        } catch (error) {
          return fresh("Could not parse the legacy save: " + messageOf(error), raw, fallback.value);
        }
        const outcome = parseSaved(fallbackValue);
        if (outcome.ok) {
          loadStatus.migrated = true;
          const text = serialize(outcome.state);
          try {
            storage.write(text);
            raw = text;
          } catch (error) {
            recordSaveFailure(
              outcome.state,
              "Could not save the migrated game: " + messageOf(error),
            );
          }
          return {
            state: outcome.state,
            disk: raw,
            revision: Number(outcome.state.revision) || 0,
          };
        }
        return fresh(outcomeMessage(outcome), raw, fallback.value);
      }
    }
    if (!raw) return fresh(readError ? "Could not read the saved game." : null, raw);
    const loaded = readPrimary(raw);
    return loaded.ok ? loaded : fresh(loaded.error, raw);
  }

  function readPrimary(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { ok: false, error: "Could not parse the saved game: " + messageOf(error) } as const;
    }
    const outcome = parseSaved(parsed);
    if (!outcome.ok) return { ok: false, error: outcomeMessage(outcome) } as const;
    return {
      ok: true,
      state: outcome.state,
      disk: raw,
      revision: Number(outcome.state.revision) || 0,
    } as const;
  }

  // A saved value may be a v2/v3 legacy record; importGame migrates it and
  // validateState proves the result before it reaches the store.
  function parseSaved(value: unknown): ReturnType<typeof validatedFromUnknown> {
    const imported = importGame(value);
    if (!imported.ok) {
      return {
        ok: false,
        errors: [{ code: imported.errorCode ?? "import-failed", message: imported.error }],
      };
    }
    return validatedFromUnknown(imported.state, validateState);
  }

  function readFallback(): { value: string } | null {
    if (typeof storage.readFallback !== "function") return null;
    try {
      return storage.readFallback();
    } catch {
      return null;
    }
  }

  function outcomeMessage(outcome: { errors: { message: string }[] }): string {
    return outcome.errors.map((error) => error.message).join(" ");
  }

  function fresh(error: string | null, disk: string | null, corruptRaw = disk) {
    const created = validatedFromUnknown(createGame(8), validateState);
    if (!created.ok) throw new Error("A fresh game failed validation: " + outcomeMessage(created));
    let message = error;
    let backupKey: string | null = null;
    if (corruptRaw) {
      backupKey = storage.backup(corruptRaw);
      message =
        (error || "Saved game is corrupt.") +
        (backupKey
          ? " The original value is kept as " + backupKey + "."
          : " The browser did not allow a backup.");
    }
    if (message) {
      Object.assign(loadStatus, { ok: false, error: message, backupKey });
      created.state.storageError = message;
    }
    return {
      state: created.state,
      disk,
      revision: Number(created.state.revision) || 0,
    };
  }

  function persist(markFailing = true, next = state): SaveOutcome {
    let failure: string;
    try {
      const raw = storage.readRaw();
      if (raw !== diskSnapshot) {
        // A command drafted before the first disk write belongs to this
        // window's initial game. Adopt the winner without replaying the command.
        if (next !== state && diskSnapshot === null && !hasLocalChanges() && reload(raw, true)) {
          return {
            ok: false,
            error: "Another tab saved the game first. Review the loaded game and try again.",
          };
        }
        failure = "Another tab changed this game. Reload before continuing.";
      } else {
        const savedGame = {
          ...next,
          updatedAt: clock.now().toISOString(),
          revision: savedRevision + 1,
          storageError: null,
        };
        const text = JSON.stringify(savedGame);
        storage.write(text);
        replaceContents(state, savedGame);
        diskSnapshot = text;
        pristineSnapshot = null;
        savedRevision = savedGame.revision;
        save = { status: "saved" };
        Object.assign(loadStatus, { ok: true, error: null });
        publish();
        return { ok: true, error: null };
      }
    } catch (error) {
      failure = "Could not save the game: " + messageOf(error) + ". Export your game.";
    }
    if (markFailing) markFailed(failure);
    return { ok: false, error: failure };
  }

  function recordSaveFailure(target: GameState, message: string): void {
    target.storageError = message;
    Object.assign(loadStatus, { ok: false, error: message });
    save = {
      status: "failed",
      errorCode: "persist-failed",
      error: message,
      at: clock.now().toISOString(),
    };
  }

  function markFailed(message: string): void {
    const same = save.status === "failed" && save.error === message;
    recordSaveFailure(state, message);
    if (!same) publish();
  }

  function resetJournal(): void {
    const base = clone(state);
    delete (base as Partial<GameState>).journal;
    state.journal = { base, entries: [] };
  }

  function undoIndex(): number {
    const entries = state.journal?.entries || [];
    for (let index = entries.length - 1; index >= undoFloor; index -= 1) {
      const entry = entries[index];
      if (entry && entry.undoable !== false) return index;
    }
    return -1;
  }

  function failMutation(message: string): StoreMutationResult {
    return { ok: false, errorCode: "persist-failed", error: message, snapshot };
  }

  function runReplacement(
    next: GameState,
    clearHistory: boolean,
    error: string | null,
  ): StoreMutationResult {
    const before = clone(state);
    const floorBefore = undoFloor;
    replaceContents(state, next);
    if (error) state.storageError = error;
    if (clearHistory) {
      resetJournal();
      undoFloor = 0;
    }
    const saved = persist(false);
    if (!saved.ok) {
      replaceContents(state, before);
      undoFloor = floorBefore;
      markFailed(saved.error || "Could not save.");
      return failMutation(saved.error || "Could not save.");
    }
    legacyUndo = null;
    redoStack.length = 0;
    return { ok: true, snapshot };
  }

  function reload(raw: string | null, validPrimaryOnly = false): boolean {
    if (raw === diskSnapshot) return false;
    const primary = raw ? readPrimary(raw) : null;
    let next;
    if (primary?.ok) {
      if (ports.canAdoptExternal?.(primary.state) === false) return false;
      next = primary;
      clearLoadStatus();
    } else {
      if (validPrimaryOnly || ports.canAdoptExternal?.(null) === false) return false;
      next = load();
    }
    replaceContents(state, next.state);
    diskSnapshot = next.disk;
    pristineSnapshot = capturePristineSnapshot();
    savedRevision = next.revision;
    undoFloor = state.journal?.entries?.length || 0;
    legacyUndo = null;
    redoStack.length = 0;
    publish();
    return true;
  }

  // A newly opened window has a clean in-memory game before its first write.
  // An unpersisted legacy migration still needs saving or exporting.
  function capturePristineSnapshot(): string | null {
    return diskSnapshot === null && loadStatus.ok ? serialize(state) : null;
  }

  function hasLocalChanges(): boolean {
    if (diskSnapshot === null)
      return (
        save.status === "failed" ||
        pristineSnapshot === null ||
        serialize(state) !== pristineSnapshot
      );
    try {
      return serialize(JSON.parse(diskSnapshot) as GameState) !== serialize(state);
    } catch {
      return true;
    }
  }

  return {
    state,
    get loadStatus() {
      return loadStatus;
    },

    prepare(input) {
      return prepareCommand(input, {
        ids,
        clock,
        rulesetVersion: RULESET_VERSION,
        supportedRulesetVersions: SUPPORTED_RULESET_VERSIONS,
      });
    },

    nextCommandId() {
      return ids.next();
    },

    preview(command) {
      return asDomainOutcome(previewCommand(state, command));
    },

    dispatch(command): DispatchResult {
      // applyCommand checks identity, validates and edits its own deep draft.
      // Its destination receives new top-level fields only after those checks.
      const next = { ...state };
      const outcome = asDomainOutcome(applyCommand(next, command));
      if (outcome.status !== "allowed") return outcome as DispatchResult;
      if (outcome.idempotent) return { ...outcome, persisted: true };

      const saved = persist(true, next);
      if (!saved.ok) {
        return {
          status: "rejected",
          id: command.id,
          type: command.type,
          reason: saved.error || "Could not save.",
          errorCode: "persist-failed",
          errors: null,
          persisted: false,
        };
      }

      if (outcome.resetHistory) {
        undoFloor = 0;
        legacyUndo = null;
        redoStack.length = 0;
      } else if (outcome.undoable !== false) {
        // A record-only command (notes, review, secret normalisation) changes
        // the state without adding a history step, so it must not destroy the
        // forward step.
        redoStack.length = 0;
      }
      return { ...outcome, persisted: true };
    },

    persist,

    undo(): StoreMutationResult {
      const index = undoIndex();
      if (index === -1) {
        if (!legacyUndo) {
          return { ok: false, errorCode: "nothing-to-undo", error: "Nothing to undo.", snapshot };
        }
        const before = clone(state);
        replaceContents(state, legacyUndo.state);
        state.storageError = null;
        const saved = persist(false);
        if (!saved.ok) {
          replaceContents(state, before);
          markFailed(saved.error || "Could not save.");
          return failMutation(saved.error || "Could not save.");
        }
        undoFloor = legacyUndo.floor;
        legacyUndo = null;
        redoStack.length = 0;
        return { ok: true, snapshot };
      }

      const journal = state.journal;
      const entries = journal.entries.slice();
      const entry = entries.splice(index, 1)[0];
      if (!entry) {
        return { ok: false, errorCode: "nothing-to-undo", error: "Nothing to undo.", snapshot };
      }
      const applied = { ...state.applied };
      delete applied[entry.id];
      const replayed = replay({ base: journal.base, entries });
      if (!replayed.ok) {
        return { ok: false, errorCode: "journal-dependency", error: replayed.error, snapshot };
      }
      replayed.state.applied = { ...applied, ...replayed.state.applied };
      const before = clone(state);
      replaceContents(state, replayed.state);
      state.storageError = null;
      const saved = persist(false);
      if (!saved.ok) {
        replaceContents(state, before);
        markFailed(saved.error || "Could not save.");
        return failMutation(saved.error || "Could not save.");
      }
      redoStack.push({ entry, index });
      return { ok: true, snapshot };
    },

    redo(): StoreMutationResult {
      const item = redoStack.at(-1);
      if (!item) {
        return { ok: false, errorCode: "nothing-to-redo", error: "Nothing to redo.", snapshot };
      }
      const journal = state.journal;
      const entries = journal.entries.slice();
      entries.splice(item.index, 0, item.entry);
      const replayed = replay({ base: journal.base, entries });
      if (!replayed.ok) {
        return { ok: false, errorCode: "journal-dependency", error: replayed.error, snapshot };
      }
      replayed.state.applied = { ...state.applied, ...replayed.state.applied };
      const before = clone(state);
      replaceContents(state, replayed.state);
      state.storageError = null;
      const saved = persist(false);
      if (!saved.ok) {
        replaceContents(state, before);
        markFailed(saved.error || "Could not save.");
        return failMutation(saved.error || "Could not save.");
      }
      redoStack.pop();
      return { ok: true, snapshot };
    },

    reset(count: number) {
      return runReplacement(createGame(count), true, null);
    },

    replaceState(next: GameState) {
      return runReplacement(next, true, null);
    },

    run(mutator): RunOutcome {
      const before = clone(state);
      const floorBefore = undoFloor;
      const undoBefore = legacyUndo;
      const redoBefore = [...redoStack];
      try {
        const result = mutator(state);
        const rejected =
          typeof result === "object" && result !== null && "ok" in result && result.ok === false;
        if (rejected) {
          replaceContents(state, before);
          return { ok: false, error: "Rejected.", persisted: false, result };
        }
        // Legacy escape hatch: an arbitrary mutation cannot be replayed, so it
        // keeps one snapshot and starts a fresh journal at the mutated state.
        resetJournal();
        legacyUndo = { state: before, floor: floorBefore };
        redoStack.length = 0;
        undoFloor = 0;
        const saved = persist(false);
        if (!saved.ok) {
          replaceContents(state, before);
          undoFloor = floorBefore;
          legacyUndo = undoBefore;
          redoStack.splice(0, redoStack.length, ...redoBefore);
          markFailed(saved.error || "Could not save.");
          return { ok: false, error: saved.error, persisted: false, result };
        }
        return { ok: true, error: saved.error, persisted: true, result };
      } catch (error) {
        replaceContents(state, before);
        undoFloor = floorBefore;
        legacyUndo = undoBefore;
        redoStack.splice(0, redoStack.length, ...redoBefore);
        return { ok: false, error: messageOf(error), persisted: false };
      }
    },

    importGame(text: string) {
      const imported = importGame(text);
      if (!imported.ok) return imported;
      const result = runReplacement(imported.state, true, null);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    },

    exportGame(notes = state.notes) {
      if (notes === state.notes) return exportGame(state);
      // The pending editor text belongs in the backup's journal as well as
      // its state, so importing or replaying the exported game recovers it.
      const backup = { ...state, storageError: null };
      const result = applyCommand(backup, {
        id: ids.next(),
        at: clock.now().toISOString(),
        type: "setNotes",
        payload: { notes },
        rulesetVersion: RULESET_VERSION,
      });
      if (result.status !== "allowed") throw new Error(result.reason);
      return exportGame(backup);
    },

    getSnapshot() {
      return snapshot;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    canUndo() {
      return undoIndex() !== -1 || legacyUndo !== null;
    },

    canRedo() {
      return redoStack.length > 0;
    },

    hasLocalChanges,

    clearSaveError() {
      state.storageError = null;
      Object.assign(loadStatus, { ok: true, error: null });
      const wasFailed = save.status === "failed";
      save = { status: "saved" };
      if (wasFailed) publish();
    },

    dispose() {
      listeners.clear();
      stopWatching();
    },
  };
}
