import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_ROLES,
  BMR,
  BMR_ALL,
  COMPOSITION,
  SNV,
  SNV_ALL,
  compositionFor,
  isGoodRole,
  bagErrors,
  randomBag,
  requiredBluffs,
  NIGHT_FIRST,
  NIGHT_OTHER,
  roleTeam,
} from "../model/rules.ts";
import { presetBag } from "../model/presets.ts";
import { badMoonRisingScript, sectsAndVioletsScript } from "../model/scripts.ts";
import {
  createGame,
  importGame,
  exportGame,
  migrateV2,
  publicGameView,
  publicRoleView,
  orderedPlayers,
  livingPlayers,
} from "../model/state.ts";
import {
  autoSecrets,
  butlerMaster,
  cancelNomination,
  checkWin,
  completeStep,
  currentStep,
  dayAt,
  dealGame,
  endDay,
  endNight,
  execute,
  infoForStep,
  isImpaired,
  kill,
  leader,
  chefCount,
  chooseDemonHeir,
  executeByDecision,
  executionThreshold,
  fortuneTellerYes,
  nominate,
  openNominations,
  recordVotes,
  resetVotes,
  secretsErrors,
  skipStep,
  startNight,
  useSlayer,
  recordVirginNomination,
  recoverClaim,
  attackNeedsRedirect,
  alignmentOf,
  registersAsDemon,
  registersAsMinion,
  registersAsOutsider,
  registersAsTownsfolk,
  registrationError,
  applyCommand,
  canonicalState,
  createRuntime,
  previewCommand,
  replay,
} from "./index.ts";
import type { InfoResult } from "./index.ts";
import { applyRoleAbility } from "./ability.ts";
import { moduleInfoForStep } from "./information.ts";
import type { InformationContext, InformationDecision } from "../roles/ability.ts";
import type { RoleModule } from "../roles/types.ts";
import type { CommandExecutionContext } from "../model/ports.ts";
import type { GameState, NightStep, Nomination, Role, RoleId } from "../model/types.ts";

type StepOptions = {
  targetIds?: string[];
  given?: Record<string, unknown>;
  redirectId?: string | null;
};

type StepResult = {
  ok: boolean;
  errorCode?: string | null;
  error?: string;
  needsRedirect?: boolean;
  options?: Array<{ id: string; alive?: boolean }>;
  result?: { noDeath?: boolean; deathId?: string | null; [key: string]: unknown };
  step?: NightStep;
};

type TestNomination = Nomination & { butlerWarning: string[]; result?: string };

function make(
  assignment: Record<string, string>,
  options: { count?: number; drunkShownId?: string | null } = {},
): GameState {
  const count = options.count || Object.keys(assignment).length;
  const state = createGame(count);
  Object.entries(assignment).forEach(([id]) => {
    state.players[id].name = "P" + id;
  });
  const roles = [...new Set(Object.values(assignment))];
  state.setup.count = count;
  state.setup.roles = roles;
  const bluffPool = ALL_ROLES.filter(
    (id) => isGoodRole(id) && !roles.includes(id) && id !== options.drunkShownId,
  );
  state.setup.bluffs = count >= 7 ? bluffPool.slice(0, 3) : [];
  state.setup.drunkShownId = options.drunkShownId || null;
  const result = dealGame(state, { assignment });
  assert.equal(result.ok, true, JSON.stringify(result));
  autoSecrets(state);
  const drunk = orderedPlayers(state).find((player) => player.roleId === "drunk");
  const mask = drunk && drunk.shownRoleId;
  if (mask && ["washerwoman", "librarian", "investigator"].includes(mask)) {
    const team =
      mask === "washerwoman" ? "townsfolk" : mask === "librarian" ? "outsider" : "minion";
    const pool = orderedPlayers(state).filter((player) => player.id !== drunk!.id);
    state.setup.info[mask] = {
      forDrunk: true,
      roleId: team === "townsfolk" ? "chef" : team === "outsider" ? "saint" : "spy",
      pair: [pool[0].id, pool[1].id],
    };
  }
  return state;
}

// Builds a legal Bad Moon Rising bag that contains the requested roles, fills
// the remaining seats from the same teams and deals the requested assignment.
function makeBmr(assignment: Record<string, RoleId>, options: { count?: number } = {}): GameState {
  const count = options.count || Object.keys(assignment).length;
  const state = createGame(count);
  state.script = badMoonRisingScript();
  state.scriptId = "bmr";
  state.setup.count = count;
  const required = [...new Set(Object.values(assignment))];
  const target = compositionFor(count, required)!;
  const counts: Record<string, number> = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
  for (const id of required) counts[roleTeam(id)!] += 1;
  const roles = [...required];
  for (const team of ["outsider", "townsfolk", "minion", "demon"] as const) {
    const need = target[team] - counts[team];
    assert.ok(need >= 0, "too many " + team + " in fixture");
    roles.push(...BMR[team].filter((id) => !roles.includes(id)).slice(0, need));
  }
  assert.equal(roles.length, count, "fixture bag size");
  state.setup.roles = roles;
  state.setup.bluffs = count >= 7 ? BMR_ALL.filter((id) => !roles.includes(id)).slice(0, 3) : [];
  const full: Record<string, string> = { ...assignment };
  const spare = roles.filter((id) => !required.includes(id));
  for (const id of state.order) {
    if (full[id]) continue;
    full[id] = spare.shift()!;
  }
  const result = dealGame(state, { assignment: full });
  assert.equal(result.ok, true, JSON.stringify(result));
  for (const id of state.order) state.players[id].name = "P" + id;
  return state;
}

// Builds a legal Sects & Violets bag with the requested roles, exactly like the
// Bad Moon Rising fixture.
function makeSnv(assignment: Record<string, RoleId>, options: { count?: number } = {}): GameState {
  const count = options.count || Object.keys(assignment).length;
  const state = createGame(count);
  state.script = sectsAndVioletsScript();
  state.scriptId = "snv";
  state.setup.count = count;
  const required = [...new Set(Object.values(assignment))];
  const target = compositionFor(count, required)!;
  const counts: Record<string, number> = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
  for (const id of required) counts[roleTeam(id)!] += 1;
  const roles = [...required];
  for (const team of ["outsider", "townsfolk", "minion", "demon"] as const) {
    const need = target[team] - counts[team];
    assert.ok(need >= 0, "too many " + team + " in fixture");
    roles.push(...SNV[team].filter((id) => !roles.includes(id)).slice(0, need));
  }
  assert.equal(roles.length, count, "fixture bag size");
  state.setup.roles = roles;
  state.setup.bluffs = count >= 7 ? SNV_ALL.filter((id) => !roles.includes(id)).slice(0, 3) : [];
  const full: Record<string, string> = { ...assignment };
  const spare = roles.filter((id) => !required.includes(id));
  for (const id of state.order) {
    if (full[id]) continue;
    full[id] = spare.shift()!;
  }
  const result = dealGame(state, { assignment: full });
  assert.equal(result.ok, true, JSON.stringify(result));
  for (const id of state.order) state.players[id].name = "P" + id;
  return state;
}

function roleStep(state: GameState, roleId: string): NightStep {
  return state.night.queue.find((step) => step.roleId === roleId && !step.done)!;
}

function systemStep(state: GameState, system: string): NightStep {
  return state.night.queue.find((step) => step.system === system && !step.done)!;
}

function completeSystem(state: GameState, system: string): StepResult {
  const step = systemStep(state, system);
  assert.ok(step, "no system step " + system);
  const result = completeStep(state, step.key, {});
  assert.equal(result.ok, true, JSON.stringify(result));
  return result as StepResult;
}

function completeRole(state: GameState, roleId: string, options: StepOptions = {}): StepResult {
  const step = roleStep(state, roleId);
  assert.ok(step, "no step for " + roleId);
  const result = completeStep(state, step.key, options);
  assert.equal(result.ok, true, JSON.stringify(result));
  return result as StepResult;
}

function skipNight(state: GameState): void {
  while (currentStep(state)) {
    skipStep(state, currentStep(state)!.key, "test");
  }
  const result = endNight(state);
  assert.equal(result.ok, true, JSON.stringify(result));
}

function toDay(state: GameState): GameState {
  const result = startNight(state);
  assert.equal(result.ok, true, JSON.stringify(result));
  skipNight(state);
  return state;
}

function appoint(
  state: GameState,
  nominatorId: string,
  nomineeId: string,
  voters: string[],
): TestNomination {
  const result = nominate(state, nominatorId, nomineeId);
  assert.equal(result.ok, true, JSON.stringify(result));
  const nomination = state.day.nominations[state.day.nominations.length - 1]!;
  const votes = recordVotes(state, nomination.id, voters);
  assert.equal(votes.ok, true, JSON.stringify(votes));
  return nomination as TestNomination;
}

test("composition table is exact and Baron shifts two Townsfolk to Outsiders (TB-BARON-01)", () => {
  const expected = {
    5: [3, 0, 1, 1],
    6: [3, 1, 1, 1],
    7: [5, 0, 1, 1],
    8: [5, 1, 1, 1],
    9: [5, 2, 1, 1],
    10: [7, 0, 2, 1],
    11: [7, 1, 2, 1],
    12: [7, 2, 2, 1],
    13: [9, 0, 3, 1],
    14: [9, 1, 3, 1],
    15: [9, 2, 3, 1],
  };
  for (const [count, rows] of Object.entries(expected)) {
    const got = COMPOSITION[Number(count)];
    assert.deepEqual(got, rows, "table " + count);
    const sum = got.reduce((a, b) => a + b, 0);
    assert.equal(sum, Number(count));
    assert.equal(got[3], 1);
  }
  assert.deepEqual(compositionFor(5), { townsfolk: 3, outsider: 0, minion: 1, demon: 1 });
  assert.deepEqual(compositionFor(5, ["baron"]), {
    townsfolk: 1,
    outsider: 2,
    minion: 1,
    demon: 1,
  });
  assert.deepEqual(compositionFor(12, ["baron"]), {
    townsfolk: 5,
    outsider: 4,
    minion: 2,
    demon: 1,
  });
});

test("bag validation rejects duplicates, wrong counts, and Drunk mask leaks", () => {
  assert.ok(bagErrors({ count: 5, roles: ["chef", "chef", "empath", "poisoner", "imp"] }).length);
  assert.ok(
    bagErrors({ count: 5, roles: ["chef", "empath", "monk", "poisoner", "imp"], bluffs: ["mayor"] })
      .length,
  );
  assert.equal(
    bagErrors({
      count: 5,
      roles: ["chef", "empath", "monk", "poisoner", "imp"],
      bluffs: [],
    }).length,
    0,
  );
  const drunkErrors = bagErrors({
    count: 6,
    roles: ["drunk", "chef", "empath", "monk", "poisoner", "imp"],
    bluffs: [],
    drunkShownId: "empath",
  });
  assert.ok(drunkErrors.some((error) => error.code === "drunk-inplay"));
  const bluffErrors = bagErrors({
    count: 7,
    roles: ["drunk", "chef", "empath", "monk", "undertaker", "poisoner", "imp"],
    bluffs: ["washerwoman", "librarian", "mayor"],
    drunkShownId: "washerwoman",
  });
  assert.ok(bluffErrors.some((error) => error.code === "bluffs-drunk"));
});

test("random bags are legal for every supported size (SYS-SETUP-02)", () => {
  for (let count = 5; count <= 15; count += 1) {
    const bag = randomBag(count);
    const errors = bagErrors({ count, ...bag });
    assert.equal(errors.length, 0, count + ": " + errors.map((e) => e.message).join(", "));
    assert.equal(bag.bluffs.length, requiredBluffs(count));
  }
});

test("Drunk keeps the real role and the shown role apart", () => {
  const state = make(
    {
      1: "drunk",
      2: "empath",
      3: "chef",
      4: "monk",
      5: "poisoner",
      6: "imp",
    },
    { drunkShownId: "washerwoman" },
  );
  assert.equal(state.players["1"].roleId, "drunk");
  assert.equal(state.players["1"].shownRoleId, "washerwoman");
  assert.equal(state.players["2"].roleId, "empath");
  const view = publicRoleView(state.players["1"], {
    name: "Washerwoman",
    team: "townsfolk",
    ability: "One of two.",
  } as Role)!;
  assert.equal(view.role, "Washerwoman");
  assert.equal(Object.hasOwn(view, "roleId"), false);
  const result = startNight(state);
  assert.equal(result.ok, true);
  assert.ok(
    state.night.queue.some((step) => step.roleId === "washerwoman" && step.actorId === "1"),
  );
  assert.equal(
    state.night.queue.some((step) => step.roleId === "imp"),
    false,
  );
  const step = roleStep(state, "washerwoman");
  const info = infoForStep(state, step, {});
  assert.equal(info.needsChoice, true);
  assert.equal(Boolean(info.missing), false);
});

test("5–6 player first night has no evil introduction and no bluffs (SYS-SETUP-04)", () => {
  const five = make({
    1: "chef",
    2: "empath",
    3: "monk",
    4: "poisoner",
    5: "imp",
  });
  assert.equal(five.bluffs.length, 0);
  startNight(five);
  assert.equal(
    five.night.queue.some((step) => step.system === "minioninfo"),
    false,
  );
  assert.equal(
    five.night.queue.some((step) => step.system === "demoninfo"),
    false,
  );

  const seven = make({
    1: "washerwoman",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "undertaker",
    6: "poisoner",
    7: "imp",
  });
  assert.equal(seven.bluffs.length, 3);
  startNight(seven);
  assert.ok(systemStep(seven, "minioninfo"));
  assert.ok(systemStep(seven, "demoninfo"));
  assert.deepEqual(
    seven.night.queue
      .map((step) => step.system || step.roleId)
      .filter(Boolean)
      .slice(0, 4),
    ["minioninfo", "demoninfo", "poisoner", "washerwoman"],
  );
});

test("first-night information is computed from real players and seats (TB-CHEF-01, TB-WASHERWOMAN-01)", () => {
  const state = make({
    1: "washerwoman",
    2: "chef",
    3: "empath",
    4: "fortuneteller",
    5: "undertaker",
    6: "poisoner",
    7: "imp",
  });
  startNight(state);
  completeSystem(state, "minioninfo");
  completeSystem(state, "demoninfo");
  completeRole(state, "poisoner", { targetIds: ["3"] });
  const washer = roleStep(state, "washerwoman");
  const washerInfo = infoForStep(state, washer, {});
  assert.equal(washerInfo.kind, "one-of-two");
  assert.equal(washerInfo.roleId, "chef");
  assert.equal(washerInfo.pair!.length, 2);
  completeRole(state, "washerwoman");
  const chefInfo = infoForStep(state, roleStep(state, "chef"), {});
  assert.equal(chefInfo.kind, "number");
  assert.equal(typeof chefInfo.value, "number");
  const empath = roleStep(state, "empath");
  assert.equal(isImpaired(state, "3", { phase: "night", number: 1 }), true);
  const empathInfo = infoForStep(state, empath, {});
  assert.equal(empathInfo.needsChoice, true);
  completeRole(state, "empath", { given: { kind: "number", value: 1 } });
  assert.equal(state.night.queue.find((step) => step.roleId === "empath")!.given!.value, 1);
});

test("poison lasts the night and the next day, then expires (TB-POISONER-01)", () => {
  const state = make({
    1: "empath",
    2: "chef",
    3: "monk",
    4: "undertaker",
    5: "mayor",
    6: "poisoner",
    7: "imp",
  });
  startNight(state);
  completeSystem(state, "minioninfo");
  completeSystem(state, "demoninfo");
  completeRole(state, "poisoner", { targetIds: ["1"] });
  assert.equal(isImpaired(state, "1", { phase: "night", number: 1 }), true);
  assert.equal(isImpaired(state, "1", { phase: "day", number: 1 }), true);
  assert.equal(isImpaired(state, "1", { phase: "night", number: 2 }), false);
  // Killing the source ends the persistent effect immediately.
  kill(state, "6", "test", { phase: "night", number: 1 });
  assert.equal(isImpaired(state, "1", { phase: "night", number: 1 }), false);
});

test("Monk protection and Soldier safety stop the Imp (TB-MONK-01, TB-SOLDIER-01)", () => {
  const state = make({
    1: "monk",
    2: "soldier",
    3: "empath",
    4: "chef",
    5: "mayor",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  assert.equal(state.phase, "night");
  assert.equal(state.night.number, 2);
  completeRole(state, "poisoner", { targetIds: ["3"] });
  completeRole(state, "monk", { targetIds: ["4"] });
  completeRole(state, "imp", { targetIds: ["4"] });
  assert.equal(state.players["4"].alive, true);

  const soldier = make({
    1: "monk",
    2: "soldier",
    3: "empath",
    4: "chef",
    5: "mayor",
    6: "poisoner",
    7: "imp",
  });
  toDay(soldier);
  assert.equal(endDay(soldier).ok, true);
  completeRole(soldier, "poisoner", { targetIds: ["3"] });
  completeRole(soldier, "monk", { targetIds: ["4"] });
  completeRole(soldier, "imp", { targetIds: ["2"] });
  assert.equal(soldier.players["2"].alive, true);
});

test("the Monk cannot choose themself (TB-MONK-01)", () => {
  const state = make({
    1: "monk",
    2: "chef",
    3: "empath",
    4: "soldier",
    5: "mayor",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  const monk = roleStep(state, "monk");
  const self = completeStep(state, monk.key, { targetIds: ["1"] });
  assert.equal(self.ok, false);
  assert.equal("errorCode" in self ? self.errorCode : null, "error.40");
});

// Ports that hand out predictable ids and times and record every draw. A step
// completed with them pins its records and the order in which it consumes the
// command stream, which is what replay depends on.
function recordingPorts(): { ports: CommandExecutionContext; draws: string[] } {
  const draws: string[] = [];
  let ids = 0;
  let ticks = 0;
  return {
    draws,
    ports: {
      clock: {
        now: () => {
          draws.push("clock");
          ticks += 1;
          return "2030-01-01T00:00:0" + ticks + ".000Z";
        },
      },
      rng: {
        next: () => {
          draws.push("rng");
          return 0.5;
        },
      },
      idFactory: {
        suffix: (length) => {
          draws.push("id:" + length);
          ids += 1;
          return ("k" + ids).padEnd(length, "0");
        },
      },
    },
  };
}

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

const NIGHT_ROLES = {
  1: "monk",
  2: "soldier",
  3: "empath",
  4: "chef",
  5: "mayor",
  6: "poisoner",
  7: "imp",
};

function nextNight(state: GameState): void {
  skipNight(state);
  assert.equal(endDay(state).ok, true);
}

function testPoison(sourceId: string, targetId: string, night: number) {
  return {
    id: "test-poison-" + sourceId + "-" + targetId,
    kind: "poison",
    sourceId,
    targetId,
    start: { phase: "night" as const, number: night },
    expires: null,
    active: true,
  };
}

test("a healthy Poisoner's choice records one dated poison, its note and one secret log line (TB-POISONER-01)", () => {
  const state = make(NIGHT_ROLES);
  startNight(state);
  const step = roleStep(state, "poisoner");
  const queued = state.night.queue.map((candidate) => candidate.key);
  const logged = state.log.length;
  const { ports, draws } = recordingPorts();

  const result = completeStep(state, step.key, { targetIds: ["3"] }, ports);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(plain(state.effects), [
    {
      id: "eff-1-k100",
      kind: "poison",
      sourceId: "6",
      targetId: "3",
      start: { phase: "night", number: 1 },
      expires: { phase: "night", number: 2 },
      active: true,
    },
  ]);
  assert.deepEqual(plain(step), {
    key: "n1-2-poisoner-6",
    kind: "role",
    roleId: "poisoner",
    actorId: "6",
    actorName: "P6",
    actorAlive: true,
    order: 2,
    targetMode: "one-any",
    infoKind: "none",
    targetIds: ["3"],
    redirectId: null,
    registrations: {},
    given: null,
    result: null,
    note: "Отравлен: P3.",
    pending: null,
    done: true,
    skipped: false,
    completedAt: "2030-01-01T00:00:01.000Z",
    noteKey: "note.poisoned",
    noteVars: { name: "P3" },
    impaired: false,
  });
  assert.deepEqual(plain(state.log.slice(logged)), [
    {
      id: "log-" + (logged + 1) + "-k2000",
      at: "2030-01-01T00:00:02.000Z",
      phase: "Ночь 1",
      kind: "night",
      title: "Отравитель",
      detail: "Отравлен: P3.",
      playerId: null,
      secret: true,
      roleId: "poisoner",
      phaseCode: "night",
      phaseNumber: 1,
      noteKey: "note.poisoned",
      noteVars: { name: "P3" },
    },
  ]);
  assert.deepEqual(
    draws,
    ["id:4", "clock", "id:5", "clock"],
    "the effect id is drawn before the step time and the log line",
  );
  assert.deepEqual(
    state.night.queue.map((candidate) => candidate.key),
    queued,
    "the choice adds no step",
  );
  assert.equal(state.winner, null);
});

test("a new Poisoner choice ends the poison it sourced before and leaves another source's poison (TB-POISONER-01)", () => {
  const state = make(NIGHT_ROLES);
  startNight(state);
  completeRole(state, "poisoner", { targetIds: ["3"] });
  nextNight(state);
  const other = testPoison("7", "4", 2);
  state.effects.push(other);
  const { ports } = recordingPorts();

  const result = completeStep(state, roleStep(state, "poisoner").key, { targetIds: ["5"] }, ports);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(state.effects.length, 3);
  assert.equal(state.effects[0]!.active, false, "the first-night poison is over");
  assert.deepEqual(plain(state.effects[1]), other, "another source keeps its poison");
  assert.deepEqual(plain(state.effects[2]), {
    id: "eff-3-k100",
    kind: "poison",
    sourceId: "6",
    targetId: "5",
    start: { phase: "night", number: 2 },
    expires: { phase: "night", number: 3 },
    active: true,
  });
  assert.equal(isImpaired(state, "3"), false);
  assert.equal(isImpaired(state, "5"), true);
});

test("an impaired Poisoner's choice poisons no one and records the shared failure note (TB-POISONER-01)", () => {
  const state = make(NIGHT_ROLES);
  startNight(state);
  const ownPoison = testPoison("7", "6", 1);
  state.effects.push(ownPoison);
  const step = roleStep(state, "poisoner");
  const logged = state.log.length;
  const { ports, draws } = recordingPorts();

  const result = completeStep(state, step.key, { targetIds: ["3"] }, ports);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(plain(state.effects), [ownPoison], "no effect is added");
  assert.equal(step.noteKey, "note.abilityFailed");
  assert.equal(step.noteVars, null);
  assert.equal(step.note, "Способность не сработала: игрок отравлен или пьян.");
  assert.equal(step.impaired, true);
  assert.equal(step.result, null);
  assert.deepEqual(step.targetIds, ["3"], "the choice itself is still recorded");
  assert.equal(state.log.length, logged + 1);
  assert.equal(state.log.at(-1)!.noteKey, "note.abilityFailed");
  assert.deepEqual(draws, ["clock", "id:5", "clock"], "no effect id is drawn");
  assert.equal(isImpaired(state, "3"), false);
});

test("a healthy Monk's choice records one protection until dawn, its note and one secret log line (TB-MONK-01)", () => {
  const state = make(NIGHT_ROLES);
  toDay(state);
  assert.equal(endDay(state).ok, true);
  const step = roleStep(state, "monk");
  const queued = state.night.queue.map((candidate) => candidate.key);
  const logged = state.log.length;
  const { ports, draws } = recordingPorts();

  const result = completeStep(state, step.key, { targetIds: ["4"] }, ports);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(plain(state.effects), [
    {
      id: "eff-1-k100",
      kind: "protected",
      sourceId: "1",
      targetId: "4",
      start: { phase: "night", number: 2 },
      expires: { phase: "day", number: 2 },
      active: true,
    },
  ]);
  assert.deepEqual(plain(step), {
    key: step.key,
    kind: "role",
    roleId: "monk",
    actorId: "1",
    actorName: "P1",
    actorAlive: true,
    order: step.order,
    targetMode: "one-other",
    infoKind: "none",
    targetIds: ["4"],
    redirectId: null,
    registrations: {},
    given: null,
    result: null,
    note: "Защищён этой ночью: P4.",
    pending: null,
    done: true,
    skipped: false,
    completedAt: "2030-01-01T00:00:01.000Z",
    noteKey: "note.protected",
    noteVars: { name: "P4" },
    impaired: false,
  });
  assert.deepEqual(plain(state.log.slice(logged)), [
    {
      id: "log-" + (logged + 1) + "-k2000",
      at: "2030-01-01T00:00:02.000Z",
      phase: "Ночь 2",
      kind: "night",
      title: "Монах",
      detail: "Защищён этой ночью: P4.",
      playerId: null,
      secret: true,
      roleId: "monk",
      phaseCode: "night",
      phaseNumber: 2,
      noteKey: "note.protected",
      noteVars: { name: "P4" },
    },
  ]);
  assert.deepEqual(draws, ["id:4", "clock", "id:5", "clock"]);
  assert.deepEqual(
    state.night.queue.map((candidate) => candidate.key),
    queued,
    "the choice adds no step",
  );
  assert.equal(state.winner, null);
});

test("a new Monk choice ends the protection it gave before (TB-MONK-01)", () => {
  const state = make(NIGHT_ROLES);
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "monk", { targetIds: ["4"] });
  nextNight(state);
  const { ports } = recordingPorts();

  const result = completeStep(state, roleStep(state, "monk").key, { targetIds: ["5"] }, ports);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(state.effects.length, 2);
  assert.equal(state.effects[0]!.active, false, "the earlier protection is over");
  assert.deepEqual(plain(state.effects[1]), {
    id: "eff-2-k100",
    kind: "protected",
    sourceId: "1",
    targetId: "5",
    start: { phase: "night", number: 3 },
    expires: { phase: "day", number: 3 },
    active: true,
  });
});

test("a poisoned Monk protects no one and the Imp's attack kills (TB-MONK-01)", () => {
  const state = make(NIGHT_ROLES);
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "poisoner", { targetIds: ["1"] });
  const step = roleStep(state, "monk");
  const { ports, draws } = recordingPorts();

  const result = completeStep(state, step.key, { targetIds: ["4"] }, ports);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(
    state.effects.some((effect) => effect.kind === "protected"),
    false,
    "an impaired Monk adds no protection",
  );
  assert.equal(step.noteKey, "note.abilityFailed");
  assert.equal(step.note, "Способность не сработала: игрок отравлен или пьян.");
  assert.equal(step.impaired, true);
  assert.deepEqual(draws, ["clock", "id:5", "clock"], "no effect id is drawn");
  completeRole(state, "imp", { targetIds: ["4"] });
  assert.equal(state.players["4"].alive, false);
});

test("a Drunk shown the Monk takes the Monk step and protects no one (TB-DRUNK-01)", () => {
  const state = make(
    { 1: "drunk", 2: "empath", 3: "chef", 4: "mayor", 5: "poisoner", 6: "imp" },
    { drunkShownId: "monk" },
  );
  toDay(state);
  assert.equal(endDay(state).ok, true);
  const step = roleStep(state, "monk");
  assert.equal(step.actorId, "1", "the Drunk wakes as the Monk they believe they are");

  const result = completeStep(state, step.key, { targetIds: ["3"] });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(
    state.effects.some((effect) => effect.kind === "protected"),
    false,
  );
  assert.equal(step.noteKey, "note.abilityFailed");
  assert.equal(step.impaired, true);
  completeRole(state, "imp", { targetIds: ["3"] });
  assert.equal(state.players["3"].alive, false);
});

const BUTLER_ROLES = {
  1: "butler",
  2: "chef",
  3: "empath",
  4: "monk",
  5: "soldier",
  6: "virgin",
  7: "poisoner",
  8: "imp",
};

test("a healthy Butler's choice records the master, one dated effect, its note and one secret log line (TB-BUTLER-01)", () => {
  const state = make(BUTLER_ROLES);
  startNight(state);
  const step = roleStep(state, "butler");
  const queued = state.night.queue.map((candidate) => candidate.key);
  const logged = state.log.length;
  const { ports, draws } = recordingPorts();

  const result = completeStep(state, step.key, { targetIds: ["2"] }, ports);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(state.players["1"].butlerMasterId, "2", "the master is recorded on the Butler");
  assert.deepEqual(plain(state.effects), [
    {
      id: "eff-1-k100",
      kind: "butler",
      sourceId: "1",
      targetId: "2",
      start: { phase: "night", number: 1 },
      expires: { phase: "night", number: 2 },
      active: true,
    },
  ]);
  assert.deepEqual(plain(step), {
    key: step.key,
    kind: "role",
    roleId: "butler",
    actorId: "1",
    actorName: "P1",
    actorAlive: true,
    order: step.order,
    targetMode: "one-other",
    infoKind: "none",
    targetIds: ["2"],
    redirectId: null,
    registrations: {},
    given: null,
    result: null,
    note: "Завтра голосует только вместе с: P2.",
    pending: null,
    done: true,
    skipped: false,
    completedAt: "2030-01-01T00:00:01.000Z",
    noteKey: "note.butlerMaster",
    noteVars: { name: "P2" },
    impaired: false,
  });
  assert.deepEqual(plain(state.log.slice(logged)), [
    {
      id: "log-" + (logged + 1) + "-k2000",
      at: "2030-01-01T00:00:02.000Z",
      phase: "Ночь 1",
      kind: "night",
      title: "Дворецкий",
      detail: "Завтра голосует только вместе с: P2.",
      playerId: null,
      secret: true,
      roleId: "butler",
      phaseCode: "night",
      phaseNumber: 1,
      noteKey: "note.butlerMaster",
      noteVars: { name: "P2" },
    },
  ]);
  assert.deepEqual(
    draws,
    ["id:4", "clock", "id:5", "clock"],
    "the effect id is drawn before the step time and the log line",
  );
  assert.deepEqual(
    state.night.queue.map((candidate) => candidate.key),
    queued,
    "the choice adds no step",
  );
  assert.equal(state.winner, null);
  assert.equal(butlerMaster(state, "1", { phase: "day", number: 1 }), "2");
});

test("a new Butler choice names the new master and leaves the earlier record to expire (TB-BUTLER-01)", () => {
  const state = make(BUTLER_ROLES);
  startNight(state);
  completeRole(state, "butler", { targetIds: ["2"] });
  nextNight(state);
  const earlier = plain(state.effects[0]);
  const { ports } = recordingPorts();

  const result = completeStep(state, roleStep(state, "butler").key, { targetIds: ["3"] }, ports);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(state.players["1"].butlerMasterId, "3");
  assert.equal(state.effects.length, 2);
  assert.deepEqual(plain(state.effects[0]), earlier, "the earlier record is not rewritten");
  assert.equal(earlier.active, true);
  assert.deepEqual(plain(state.effects[1]), {
    id: "eff-2-k100",
    kind: "butler",
    sourceId: "1",
    targetId: "3",
    start: { phase: "night", number: 2 },
    expires: { phase: "night", number: 3 },
    active: true,
  });
  assert.equal(
    butlerMaster(state, "1", { phase: "day", number: 2 }),
    "3",
    "only the choice of the last night binds the next day",
  );
});

test("an impaired Butler's choice is recorded with an effect that never applies (TB-BUTLER-01)", () => {
  const state = make(BUTLER_ROLES);
  startNight(state);
  completeRole(state, "poisoner", { targetIds: ["1"] });
  const step = roleStep(state, "butler");
  const logged = state.log.length;
  const { ports, draws } = recordingPorts();

  const result = completeStep(state, step.key, { targetIds: ["2"] }, ports);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(state.players["1"].butlerMasterId, "2", "the choice itself is still recorded");
  assert.equal(state.effects.length, 2);
  assert.deepEqual(plain(state.effects[1]), {
    id: "eff-2-k100",
    kind: "butler",
    sourceId: "1",
    targetId: "2",
    start: { phase: "night", number: 1 },
    expires: { phase: "night", number: 2 },
    active: false,
  });
  assert.equal(step.noteKey, "note.abilityFailed");
  assert.equal(step.noteVars, null);
  assert.equal(step.note, "Способность не сработала: игрок отравлен или пьян.");
  assert.equal(step.impaired, true);
  assert.equal(step.result, null);
  assert.deepEqual(step.targetIds, ["2"]);
  assert.equal(state.log.length, logged + 1);
  assert.equal(state.log.at(-1)!.noteKey, "note.abilityFailed");
  assert.deepEqual(
    draws,
    ["id:4", "clock", "id:5", "clock"],
    "the record draws its id like a working choice",
  );
  assert.equal(butlerMaster(state, "1", { phase: "day", number: 1 }), null);
});

test("a choice the Butler made while impaired does not bind them once they are healthy (TB-BUTLER-01)", () => {
  const state = make(BUTLER_ROLES);
  startNight(state);
  // A poison that ends at dawn: the Butler is impaired for the choice only.
  state.effects.push({ ...testPoison("8", "1", 1), expires: { phase: "day", number: 1 } });
  assert.equal(isImpaired(state, "1"), true);
  completeRole(state, "butler", { targetIds: ["2"] });
  skipNight(state);

  assert.equal(isImpaired(state, "1"), false, "the Butler is healthy during the day");
  assert.equal(butlerMaster(state, "1"), null, "a wasted choice has no effect later");
  openNominations(state);
  const nomination = appoint(state, "1", "2", ["1"]);
  assert.deepEqual(nomination.votes, ["1"]);
  assert.equal(nomination.butlerWarning.length, 0);
});

test("the Butler cannot choose themself (TB-BUTLER-01)", () => {
  const state = make(BUTLER_ROLES);
  startNight(state);
  const step = roleStep(state, "butler");

  const self = completeStep(state, step.key, { targetIds: ["1"] });

  assert.equal(self.ok, false);
  assert.equal("errorCode" in self ? self.errorCode : null, "error.40");
  assert.equal(state.players["1"].butlerMasterId, null);
  assert.deepEqual(state.effects, []);
  assert.equal(step.done, false);
});

test("an impaired Butler's recorded choice replays to the same inactive record (TB-BUTLER-01)", () => {
  const state = make(BUTLER_ROLES);
  startNight(state);
  const runtime = createRuntime({ now: () => new Date("2030-01-01T00:00:00.000Z") });
  const complete = (id: string, roleId: string, targetId: string) =>
    applyCommand(
      state,
      {
        id,
        type: "completeNightStep",
        payload: { key: roleStep(state, roleId).key, targetIds: [targetId] },
        at: "2030-01-01T00:00:00.000Z",
      },
      runtime,
    );

  assert.equal(complete("poison-the-butler", "poisoner", "1").status, "allowed");
  const applied = complete("wasted-master", "butler", "2");

  assert.equal(applied.status, "allowed", JSON.stringify(applied));
  const record = state.effects.find((effect) => effect.kind === "butler");
  assert.ok(record, "the choice is recorded");
  assert.equal(record.active, false);
  assert.equal(state.players["1"].butlerMasterId, "2");
  const replayed = replay(state.journal, runtime);
  assert.equal(replayed.ok, true, JSON.stringify(replayed));
  assert.deepEqual(canonicalState(replayed.state), canonicalState(state));
  assert.deepEqual(
    replayed.state.effects.find((effect) => effect.kind === "butler"),
    record,
    "the record keeps its id from the command stream",
  );
});

test("a suppressed ability keeps its dated effect as a record that never applies and ends nothing", () => {
  const state = make(NIGHT_ROLES);
  startNight(state);
  completeRole(state, "poisoner", { targetIds: ["3"] });
  nextNight(state);
  const working = plain(state.effects[0]);
  // A module whose ability failed but still names a dated, replacing effect.
  const wasted: RoleModule = {
    id: "poisoner",
    edition: "tb",
    capabilities: [
      {
        kind: "night-step",
        timing: "any",
        step: { target: "one-any" },
        resolve: () => ({
          kind: "suppressed",
          effects: [
            {
              kind: "timed-effect",
              effect: "poison",
              playerId: "4",
              expires: { phase: "night", number: 3 },
              replacesPrevious: true,
            },
          ],
        }),
      },
    ],
  };
  const step = roleStep(state, "poisoner");
  const { ports, draws } = recordingPorts();

  applyRoleAbility(state, wasted, step, ["4"], { phase: "night", number: 2 }, {}, ports);

  assert.equal(state.effects.length, 2);
  assert.deepEqual(plain(state.effects[0]), working, "the earlier effect is not ended");
  assert.deepEqual(plain(state.effects[1]), {
    id: "eff-2-k100",
    kind: "poison",
    sourceId: "6",
    targetId: "4",
    start: { phase: "night", number: 2 },
    expires: { phase: "night", number: 3 },
    active: false,
  });
  assert.equal(isImpaired(state, "4"), false, "the record poisons no one");
  assert.equal(step.noteKey, "note.abilityFailed");
  assert.deepEqual(draws, ["id:4"]);
});

// A module whose night step is an attack under its own title. The coordinator
// tests below use it, so they do not depend on the Imp's wording.
const attacker: RoleModule = {
  id: "imp",
  edition: "tb",
  capabilities: [
    {
      kind: "night-step",
      timing: "other",
      step: { target: "one-any" },
      resolve: ({ targetIds }) => ({
        kind: "attack",
        playerId: targetIds[0]!,
        title: "Проверочная атака",
      }),
    },
  ],
};

test("an attack decision is resolved for the acting seat and handed back under the role's title", () => {
  const state = make(NIGHT_ROLES);
  toDay(state);
  assert.equal(endDay(state).ok, true);
  const step = roleStep(state, "imp");
  const { ports } = recordingPorts();

  const outcome = applyRoleAbility(
    state,
    attacker,
    step,
    ["4"],
    { phase: "night", number: 2 },
    {},
    ports,
  );

  assert.equal(outcome.kind, "attack");
  if (outcome.kind !== "attack") return;
  assert.equal(outcome.title, "Проверочная атака");
  assert.equal(outcome.attack.deathId, "4");
  assert.equal(state.players["4"].alive, false);
  assert.equal(state.deaths.at(-1)!.cause, "demon");
  assert.equal(step.done, false, "the caller completes the step");
});

test("an attack decision on a working Mayor returns the host's question and applies nothing", () => {
  const state = make(NIGHT_ROLES);
  toDay(state);
  assert.equal(endDay(state).ok, true);
  const step = roleStep(state, "imp");
  const at = { phase: "night" as const, number: 2 };
  const before = JSON.stringify(state);
  const { ports, draws } = recordingPorts();

  const asked = applyRoleAbility(state, attacker, step, ["5"], at, {}, ports);

  assert.equal(asked.kind, "needs-redirect");
  if (asked.kind !== "needs-redirect") return;
  assert.deepEqual(
    asked.options.map((option) => option.id),
    ["1", "2", "3", "4", "6", "7"],
  );
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(draws, []);

  const answered = applyRoleAbility(state, attacker, step, ["5"], at, { redirectId: "4" }, ports);

  assert.equal(answered.kind, "attack");
  if (answered.kind !== "attack") return;
  assert.equal(answered.attack.redirected, true);
  assert.equal(state.players["5"].alive, true);
  assert.equal(state.players["4"].alive, false);
});

test("the Butler choice reports the new master and the effect as command events (TB-BUTLER-01)", () => {
  const state = make(BUTLER_ROLES);
  startNight(state);
  const runtime = createRuntime({ now: () => new Date("2030-01-01T00:00:00.000Z") });
  const step = roleStep(state, "butler");

  const applied = applyCommand(
    state,
    {
      id: "butler-master",
      type: "completeNightStep",
      payload: { key: step.key, targetIds: ["2"] },
      at: "2030-01-01T00:00:00.000Z",
    },
    runtime,
  );

  assert.equal(applied.status, "allowed", JSON.stringify(applied));
  const events = "events" in applied ? (applied.events ?? []) : [];
  assert.deepEqual(
    events.map((event) => event.type),
    ["player.butler_master_changed", "effect.added", "step.completed", "step.updated"],
  );
  assert.deepEqual(events[0]!.payload, { playerId: "1", masterId: "2" });
  assert.deepEqual(events[1]!.payload, { effect: plain(state.effects[0]) });
  assert.equal(state.effects[0]!.kind, "butler");
});

for (const scenario of [
  {
    name: "Poisoner",
    roleId: "poisoner",
    effect: "poison",
    rule: "TB-POISONER-01",
    targetId: "3",
    roles: NIGHT_ROLES,
  },
  {
    name: "Monk",
    roleId: "monk",
    effect: "protected",
    rule: "TB-MONK-01",
    targetId: "4",
    roles: NIGHT_ROLES,
  },
  {
    name: "Butler",
    roleId: "butler",
    effect: "butler",
    rule: "TB-BUTLER-01",
    targetId: "2",
    roles: BUTLER_ROLES,
  },
] as const) {
  test(`the ${scenario.name} choice previews, applies and replays with the command clock and ids (${scenario.rule})`, () => {
    const build = (): GameState => {
      const state = make(scenario.roles);
      toDay(state);
      assert.equal(endDay(state).ok, true);
      return state;
    };
    const state = build();
    const runtime = createRuntime({ now: () => new Date("2030-01-01T00:00:00.000Z") });
    const command = {
      id: scenario.roleId + "-choice",
      type: "completeNightStep",
      payload: { key: roleStep(state, scenario.roleId).key, targetIds: [scenario.targetId] },
      at: "2030-01-01T00:00:00.000Z",
    };
    const before = canonicalState(state);

    const preview = previewCommand(state, command, runtime);
    assert.equal(preview.status, "allowed", JSON.stringify(preview));
    assert.deepEqual(canonicalState(state), before, "preview must not mutate");
    const applied = applyCommand(state, command, runtime);
    assert.equal(applied.status, "allowed", JSON.stringify(applied));
    assert.deepEqual(
      "events" in preview ? preview.events : null,
      "events" in applied ? applied.events : undefined,
      "preview and apply derive the same events",
    );

    const effect = state.effects.find((candidate) => candidate.kind === scenario.effect);
    assert.ok(effect, "the effect is recorded");
    assert.equal(effect.targetId, scenario.targetId);
    const step = state.night.queue.find((candidate) => candidate.roleId === scenario.roleId)!;
    assert.equal(step.completedAt, "2030-01-01T00:00:00.000Z", "the step uses the command clock");

    // The same command on the same state draws the same ids from the seeded
    // stream, so a second game and a replay both land on the same records.
    const twin = build();
    assert.equal(applyCommand(twin, command, runtime).status, "allowed");
    assert.deepEqual(twin.effects, state.effects, "the effect id comes from the command stream");

    const replayed = replay(state.journal, runtime);
    assert.equal(replayed.ok, true, JSON.stringify(replayed));
    assert.deepEqual(canonicalState(replayed.state), canonicalState(state));

    const saved = importGame(exportGame(state));
    assert.equal(saved.ok, true, JSON.stringify(saved));
    if (!saved.ok) return;
    const reloaded = replay(saved.state.journal, runtime);
    assert.equal(reloaded.ok, true, JSON.stringify(reloaded));
    assert.deepEqual(canonicalState(reloaded.state), canonicalState(state));
  });
}

// The Imp attack. NIGHT_ROLES seats the Monk at 1, the Soldier at 2, the Mayor
// at 5, the Poisoner at 6 and the Imp at 7. The Imp first acts on night 2.
function attackNight(roles: Record<string, string> = NIGHT_ROLES): GameState {
  const state = make(roles);
  toDay(state);
  assert.equal(endDay(state).ok, true);
  return state;
}

function queueMarks(state: GameState): string[] {
  return state.night.queue.map(
    (step) => step.key + (step.done ? ":done" : "") + (step.skipped ? ":skipped" : ""),
  );
}

test("the Imp's attack kills the chosen player and writes the attack's own step record and log line (TB-IMP-01)", () => {
  const state = attackNight();
  const step = roleStep(state, "imp");
  const queued = queueMarks(state);
  const logged = state.log.length;
  const { ports, draws } = recordingPorts();

  const result = completeStep(state, step.key, { targetIds: ["4"] }, ports) as StepResult;

  const outcome = {
    noDeath: false,
    deathId: "4",
    redirected: false,
    wasDemon: false,
    inheritance: null,
    pendingInheritance: null,
  };
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(plain(result.result), outcome, "the caller reads the outcome from the result");
  assert.deepEqual(plain(state.deaths), [
    {
      id: "death-1-k100",
      playerId: "4",
      roleId: "chef",
      cause: "demon",
      phase: "night",
      number: 2,
      at: "2030-01-01T00:00:01.000Z",
      impaired: false,
      livingBefore: 7,
    },
  ]);
  // The attack step keeps its own record: the outcome is the step result and
  // the step does not list its target.
  assert.deepEqual(plain(step), {
    key: "n2-3-imp-7",
    kind: "role",
    roleId: "imp",
    actorId: "7",
    actorName: "P7",
    actorAlive: true,
    order: 3,
    targetMode: "one-any",
    infoKind: "none",
    targetIds: [],
    redirectId: null,
    registrations: {},
    given: null,
    result: outcome,
    note: "Погиб: P4.",
    pending: null,
    done: true,
    skipped: false,
    completedAt: "2030-01-01T00:00:03.000Z",
    noteKey: "note.impKilled",
    noteVars: { name: "P4" },
  });
  assert.deepEqual(plain(state.log.slice(logged)), [
    {
      id: "log-" + (logged + 1) + "-k2000",
      at: "2030-01-01T00:00:02.000Z",
      phase: "Ночь 2",
      kind: "death",
      title: "P4 погибает",
      detail: "Причина: demon. Роль: Повар.",
      playerId: "4",
      secret: true,
      consequence: "death",
    },
    {
      id: "log-" + (logged + 2) + "-k3000",
      at: "2030-01-01T00:00:04.000Z",
      phase: "Ночь 2",
      kind: "night",
      title: "Имп атакует",
      detail: "Погиб: P4.",
      playerId: null,
      secret: true,
    },
  ]);
  assert.deepEqual(
    draws,
    ["id:4", "clock", "id:5", "clock", "clock", "id:5", "clock"],
    "the death is written before the step time and the attack line",
  );
  assert.deepEqual(
    queueMarks(state),
    queued.map((key) => (key === step.key ? key + ":done" : key)),
    "the kill adds no step",
  );
  assert.equal(state.winner, null);
});

for (const scenario of [
  {
    name: "a player the Monk protects",
    targetId: "4",
    reason: "Цель защищена Монахом.",
    prepare: (state: GameState) => {
      completeRole(state, "monk", { targetIds: ["4"] });
    },
  },
  {
    name: "a healthy Soldier",
    targetId: "2",
    reason: "Солдат не может умереть от Демона.",
    prepare: () => {},
  },
  {
    name: "a dead player",
    targetId: "4",
    reason: "Игрок уже мёртв: повторной смерти нет.",
    prepare: (state: GameState) => {
      kill(state, "4", "test");
    },
  },
  {
    name: "any player while the Imp is poisoned",
    targetId: "4",
    reason: "Демон отравлен или пьян: смерти нет.",
    prepare: (state: GameState) => {
      completeRole(state, "poisoner", { targetIds: ["7"] });
    },
  },
]) {
  test(`an Imp attack on ${scenario.name} kills no one and records the reason on a prevented log line (TB-IMP-01)`, () => {
    const state = attackNight();
    scenario.prepare(state);
    const step = roleStep(state, "imp");
    const logged = state.log.length;
    const deaths = state.deaths.length;
    const alive = state.players[scenario.targetId].alive;
    const { ports, draws } = recordingPorts();

    const result = completeStep(
      state,
      step.key,
      { targetIds: [scenario.targetId] },
      ports,
    ) as StepResult;

    const outcome = { noDeath: true, reason: scenario.reason };
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(plain(result.result), outcome);
    assert.deepEqual(plain(step.result), outcome);
    assert.equal(step.note, scenario.reason);
    assert.equal(step.noteKey, undefined, "the reason is the note itself");
    assert.equal(step.done, true);
    assert.equal(step.completedAt, "2030-01-01T00:00:01.000Z");
    assert.equal(step.pending, null);
    assert.equal(state.deaths.length, deaths, "no death is recorded");
    assert.equal(state.players[scenario.targetId].alive, alive);
    assert.deepEqual(plain(state.log.slice(logged)), [
      {
        id: "log-" + (logged + 1) + "-k1000",
        at: "2030-01-01T00:00:02.000Z",
        phase: "Ночь 2",
        kind: "night",
        title: "Имп атакует",
        detail: scenario.reason,
        playerId: null,
        secret: true,
        consequence: "prevented",
      },
    ]);
    assert.deepEqual(draws, ["clock", "id:5", "clock"]);
    assert.equal(state.winner, null);
  });
}

test("an Imp attack on a working Mayor waits for the host's redirect and changes nothing (TB-IMP-01, TB-MAYOR-01)", () => {
  const state = attackNight();
  const step = roleStep(state, "imp");
  const before = JSON.stringify(state);
  const { ports, draws } = recordingPorts();

  const result = completeStep(state, step.key, { targetIds: ["5"] }, ports);

  assert.deepEqual(plain(result), {
    ok: false,
    needsRedirect: true,
    options: ["1", "2", "3", "4", "6", "7"].map((id) => ({ id, name: "P" + id, alive: true })),
    errorCode: "error.43",
    error: "Выберите, умирает Мэр, кто-то вместо него или никто.",
  });
  assert.equal(JSON.stringify(state), before, "a step that waits for the host is not applied");
  assert.deepEqual(draws, [], "and it draws nothing from the command stream");
});

test("a redirected Imp attack kills the host's choice and journals the redirect before the attack line (TB-IMP-01, TB-MAYOR-01)", () => {
  const state = attackNight();
  const step = roleStep(state, "imp");
  const logged = state.log.length;
  const { ports, draws } = recordingPorts();

  const result = completeStep(
    state,
    step.key,
    { targetIds: ["5"], redirectId: "4" },
    ports,
  ) as StepResult;

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(plain(step.result), {
    noDeath: false,
    deathId: "4",
    redirected: true,
    wasDemon: false,
    inheritance: null,
    pendingInheritance: null,
  });
  assert.equal(state.players["5"].alive, true, "the Mayor lives");
  assert.equal(state.players["4"].alive, false);
  assert.equal(state.deaths.at(-1)!.cause, "demon");
  assert.equal(step.note, "Погиб: P4.");
  assert.deepEqual(
    state.log.slice(logged).map((line) => ({
      id: line.id,
      at: line.at,
      kind: line.kind,
      detail: line.detail,
      playerId: line.playerId,
      case: line.case ?? null,
    })),
    [
      {
        id: "log-" + (logged + 1) + "-k2000",
        at: "2030-01-01T00:00:02.000Z",
        kind: "death",
        detail: "Причина: demon. Роль: Повар.",
        playerId: "4",
        case: null,
      },
      {
        id: "log-" + (logged + 2) + "-k3000",
        at: "2030-01-01T00:00:03.000Z",
        kind: "choice",
        detail: "P4",
        playerId: "7",
        case: "mayor-redirect",
      },
      {
        id: "log-" + (logged + 3) + "-k4000",
        at: "2030-01-01T00:00:05.000Z",
        kind: "night",
        detail: "Погиб: P4.",
        playerId: null,
        case: null,
      },
    ],
  );
  assert.equal(state.log.at(-1)!.title, "Имп атакует");
  assert.deepEqual(draws, [
    "id:4",
    "clock",
    "id:5",
    "clock",
    "id:5",
    "clock",
    "clock",
    "id:5",
    "clock",
  ]);
});

test("the host may let the Mayor die: the answer is journaled and the death is not a redirect (TB-MAYOR-01)", () => {
  const state = attackNight();
  const step = roleStep(state, "imp");
  const logged = state.log.length;

  const result = completeStep(state, step.key, {
    targetIds: ["5"],
    redirectId: "none",
  }) as StepResult;

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.result!.deathId, "5");
  assert.equal(result.result!.redirected, false);
  assert.equal(state.players["5"].alive, false);
  assert.deepEqual(
    state.log.slice(logged).map((line) => line.case ?? line.kind),
    ["death", "mayor-redirect", "night"],
  );
});

test("an Imp self-kill passes the role to the only living Minion inside the attack step and queues the new Demon's wake (TB-IMP-01)", () => {
  const state = attackNight();
  const step = roleStep(state, "imp");
  const logged = state.log.length;
  const { ports, draws } = recordingPorts();

  const result = completeStep(state, step.key, { targetIds: ["7"] }, ports) as StepResult;

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(plain(step.result), {
    noDeath: false,
    deathId: "7",
    redirected: false,
    wasDemon: true,
    inheritance: { inherited: true, playerId: "6", via: "imp" },
    pendingInheritance: null,
  });
  assert.equal(step.pending, null);
  assert.equal(step.note, "Погиб: P7.");
  assert.equal(state.deaths.at(-1)!.cause, "imp-self-kill");
  assert.equal(state.players["6"].roleId, "imp");
  assert.deepEqual(
    state.log.slice(logged).map((line) => line.kind),
    ["death", "role-change", "night"],
  );
  assert.equal(state.log.at(-1)!.title, "Имп атакует");
  assert.deepEqual(draws, [
    "id:4",
    "clock",
    "id:5",
    "clock",
    "id:5",
    "clock",
    "clock",
    "id:5",
    "clock",
  ]);
  assert.deepEqual(queueMarks(state), [
    "n2-0-poisoner-6:done:skipped",
    "n2-1-monk-1",
    "n2-3-imp-7:done",
    "n2-3.5-demonchange-all",
    "n2-5-empath-3",
  ]);
  assert.equal(state.night.demonChanged, true);
  assert.equal(state.winner, null);
});

test("an Imp self-kill with several living Minions holds the win check until the host names the heir (TB-IMP-01)", () => {
  const state = attackNight({
    1: "monk",
    2: "soldier",
    3: "empath",
    4: "chef",
    5: "mayor",
    6: "undertaker",
    7: "slayer",
    8: "poisoner",
    9: "spy",
    10: "imp",
  });
  const step = roleStep(state, "imp");
  const logged = state.log.length;
  const { ports, draws } = recordingPorts();

  const result = completeStep(state, step.key, { targetIds: ["10"] }, ports) as StepResult;

  const choice = {
    kind: "demon-inheritance",
    options: [
      { id: "8", name: "P8", roleId: "poisoner" },
      { id: "9", name: "P9", roleId: "spy" },
    ],
  };
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(plain(step.pending), choice);
  assert.deepEqual(plain(step.result), {
    noDeath: false,
    deathId: "10",
    redirected: false,
    wasDemon: true,
    inheritance: { inherited: false, pendingInheritance: choice },
    pendingInheritance: choice,
  });
  assert.deepEqual(
    state.log.slice(logged).map((line) => line.kind),
    ["death", "night"],
  );
  assert.deepEqual(draws, ["id:4", "clock", "id:5", "clock", "clock", "id:5", "clock"]);
  assert.equal(state.winner, null, "no Demon lives, but the heir is not chosen yet");
  assert.equal(endNight(state).ok, false, "the night cannot end before the choice");

  const heir = chooseDemonHeir(state, step.key, "9");

  assert.equal(heir.ok, true, JSON.stringify(heir));
  assert.equal(step.pending, null);
  assert.equal(state.players["9"].roleId, "imp");
  assert.equal(state.winner, null);
});

test("an Imp kill that leaves two players alive ends the game from the attack step (TB-IMP-01)", () => {
  const state = attackNight({ 1: "chef", 2: "soldier", 3: "virgin", 4: "poisoner", 5: "imp" });
  kill(state, "2", "test");
  kill(state, "3", "test");
  const step = roleStep(state, "imp");
  const logged = state.log.length;
  const { ports, draws } = recordingPorts();

  const result = completeStep(state, step.key, { targetIds: ["1"] }, ports) as StepResult;

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(state.winner?.team, "evil");
  assert.equal(state.winner?.reason, "two-alive");
  assert.equal(state.phase, "over");
  assert.deepEqual(
    state.log.slice(logged).map((line) => line.kind),
    ["death", "night", "winner"],
    "the attack line is written before the game ends",
  );
  assert.deepEqual(draws, [
    "id:4",
    "clock",
    "id:5",
    "clock",
    "clock",
    "id:5",
    "clock",
    "clock",
    "id:5",
    "clock",
  ]);
});

test("the Imp attack previews, applies and replays with the command clock and ids (TB-IMP-01)", () => {
  const state = attackNight();
  const runtime = createRuntime({ now: () => new Date("2030-01-01T00:00:00.000Z") });
  const command = {
    id: "imp-attack",
    type: "completeNightStep",
    payload: { key: roleStep(state, "imp").key, targetIds: ["4"] },
    at: "2030-01-01T00:00:00.000Z",
  };
  const before = canonicalState(state);

  const preview = previewCommand(state, command, runtime);
  assert.equal(preview.status, "allowed", JSON.stringify(preview));
  assert.deepEqual(canonicalState(state), before, "preview must not mutate");
  const applied = applyCommand(state, command, runtime);
  assert.equal(applied.status, "allowed", JSON.stringify(applied));
  assert.deepEqual(
    "events" in preview ? preview.events : null,
    "events" in applied ? applied.events : undefined,
    "preview and apply derive the same events",
  );
  assert.deepEqual(
    ("events" in applied ? (applied.events ?? []) : []).map((event) => event.type),
    [
      "player.alive_changed",
      "player.dead_at_changed",
      "death.recorded",
      "step.completed",
      "step.updated",
    ],
  );

  const death = state.deaths.at(-1)!;
  assert.equal(death.playerId, "4");
  assert.equal(death.at, "2030-01-01T00:00:00.000Z", "the death uses the command clock");
  const step = state.night.queue.find((candidate) => candidate.roleId === "imp")!;
  assert.equal(step.completedAt, "2030-01-01T00:00:00.000Z", "the step uses the command clock");

  // The same command on the same state draws the same ids from the seeded
  // stream, so a second game and a replay both land on the same records.
  const twin = attackNight();
  assert.equal(applyCommand(twin, command, runtime).status, "allowed");
  assert.deepEqual(twin.deaths, state.deaths, "the death id comes from the command stream");
  assert.deepEqual(twin.log.at(-1), state.log.at(-1), "and so does the attack line");

  const replayed = replay(state.journal, runtime);
  assert.equal(replayed.ok, true, JSON.stringify(replayed));
  assert.deepEqual(canonicalState(replayed.state), canonicalState(state));

  const saved = importGame(exportGame(state));
  assert.equal(saved.ok, true, JSON.stringify(saved));
  if (!saved.ok) return;
  const reloaded = replay(saved.state.journal, runtime);
  assert.equal(reloaded.ok, true, JSON.stringify(reloaded));
  assert.deepEqual(canonicalState(reloaded.state), canonicalState(state));
});

test("an Imp attack on a working Mayor is a host choice on the command path and the answer completes it (TB-IMP-01, TB-MAYOR-01)", () => {
  const state = attackNight();
  const runtime = createRuntime({ now: () => new Date("2030-01-01T00:00:00.000Z") });
  const key = roleStep(state, "imp").key;
  const before = canonicalState(state);
  const journaled = state.journal.entries.length;

  const asked = applyCommand(
    state,
    {
      id: "imp-attack-mayor",
      type: "completeNightStep",
      payload: { key, targetIds: ["5"] },
      at: "2030-01-01T00:00:00.000Z",
    },
    runtime,
  );

  assert.equal(asked.status, "requires-storyteller-choice", JSON.stringify(asked));
  const choice = "choice" in asked ? asked.choice : null;
  assert.equal(choice?.kind, "redirect");
  assert.deepEqual(
    (choice?.options ?? []).map((option) => (option as { id: string }).id),
    ["1", "2", "3", "4", "6", "7"],
    "every other player may be named",
  );
  assert.deepEqual(canonicalState(state), before, "the question leaves the game as it was");
  assert.equal(state.journal.entries.length, journaled, "and writes no journal entry");

  const answered = applyCommand(
    state,
    {
      id: "imp-attack-mayor-redirected",
      type: "completeNightStep",
      payload: { key, targetIds: ["5"], redirectId: "3" },
      at: "2030-01-01T00:00:00.000Z",
    },
    runtime,
  );

  assert.equal(answered.status, "allowed", JSON.stringify(answered));
  assert.equal(state.players["5"].alive, true);
  assert.equal(state.players["3"].alive, false);
  assert.equal(state.journal.entries.length, journaled + 1);
  const replayed = replay(state.journal, runtime);
  assert.equal(replayed.ok, true, JSON.stringify(replayed));
  assert.deepEqual(canonicalState(replayed.state), canonicalState(state));
});

// The Empath step before the capability move. These tests pin the records the
// step leaves, so the move can be shown to change none of them.

function empathNight(poisoned = false): GameState {
  const state = make(NIGHT_ROLES);
  assert.equal(startNight(state).ok, true);
  if (poisoned) completeRole(state, "poisoner", { targetIds: ["3"] });
  return state;
}

const EMPATH_STEP = {
  key: "n1-7-empath-3",
  kind: "role",
  roleId: "empath",
  actorId: "3",
  actorName: "P3",
  actorAlive: true,
  order: 7,
  targetMode: "none",
  infoKind: "number",
  targetIds: [],
  redirectId: null,
  registrations: {},
  given: null,
  result: null,
  note: null,
  pending: null,
  done: false,
  skipped: false,
  completedAt: null,
};

const EMPATH_LINE = {
  id: "log-3-k1000",
  at: "2030-01-01T00:00:02.000Z",
  phase: "Ночь 1",
  kind: "night",
  title: "Эмпат",
  detail: "Шаг выполнен.",
  playerId: null,
  secret: true,
  roleId: "empath",
  phaseCode: "night",
  phaseNumber: 1,
  noteKey: "note.finished",
  noteVars: null,
};

test("the Empath step is built with the number shape on every night (TB-EMPATH-01)", () => {
  const state = empathNight();
  assert.deepEqual(plain(roleStep(state, "empath")), EMPATH_STEP);

  skipNight(state);
  assert.equal(endDay(state).ok, true);
  const later = roleStep(state, "empath");
  assert.equal(later.key, "n2-5-empath-3", "the Empath wakes after the Demon on later nights");
  assert.equal(later.targetMode, "none");
  assert.equal(later.infoKind, "number");
});

test("the Empath step keeps the computed count as its record and writes one step line (TB-EMPATH-01)", () => {
  const state = empathNight();
  const step = roleStep(state, "empath");
  const logged = state.log.length;
  const { ports, draws } = recordingPorts();

  assert.deepEqual(infoForStep(state, step, {}), {
    kind: "number",
    value: 0,
    impaired: false,
    needsChoice: false,
    options: [],
  });
  const result = completeStep(state, step.key, {}, ports);

  assert.deepEqual(Object.keys(result), ["ok", "step"]);
  assert.equal(result.ok, true);
  assert.deepEqual(plain(step), {
    ...EMPATH_STEP,
    given: { kind: "number", value: 0, impaired: false, needsChoice: false, options: [] },
    note: "Шаг выполнен.",
    done: true,
    completedAt: "2030-01-01T00:00:01.000Z",
    impaired: false,
    noteKey: "note.finished",
    noteVars: null,
  });
  assert.deepEqual(
    Object.keys(step.given!),
    ["kind", "value", "impaired", "needsChoice", "options"],
    "saved games hold the answer in this key order",
  );
  assert.deepEqual(plain(state.log.slice(logged)), [EMPATH_LINE]);
  assert.deepEqual(draws, ["clock", "id:5", "clock"]);
});

test("a healthy Empath step stores what the host sends and journals no choice (TB-EMPATH-01)", () => {
  const state = empathNight();
  const step = roleStep(state, "empath");
  const logged = state.log.length;
  const { ports, draws } = recordingPorts();

  const result = completeStep(
    state,
    step.key,
    { targetIds: ["1"], given: { kind: "number", value: 2 } },
    ports,
  );

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(plain(step.given), { kind: "number", value: 2 });
  assert.deepEqual(step.targetIds, ["1"]);
  assert.equal(step.impaired, false);
  assert.deepEqual(plain(state.log.slice(logged)), [EMPATH_LINE]);
  assert.deepEqual(draws, ["clock", "id:5", "clock"]);
});

test("an impaired Empath waits for the host's number and changes nothing (TB-EMPATH-03)", () => {
  const state = empathNight(true);
  const step = roleStep(state, "empath");
  const info = { kind: "number", value: 0, impaired: true, needsChoice: true, options: [0, 1, 2] };
  const before = JSON.stringify(canonicalState(state));
  const { ports, draws } = recordingPorts();

  assert.deepEqual(infoForStep(state, step, {}), info);
  assert.deepEqual(completeStep(state, step.key, {}, ports), {
    ok: false,
    needsChoice: true,
    info,
  });
  const rejected = {
    ok: false,
    needsChoice: true,
    info,
    errorCode: "error.66",
    error: "Выберите один из предложенных вариантов.",
  };
  assert.deepEqual(
    completeStep(state, step.key, { given: { kind: "number", value: 3 } }, ports),
    rejected,
    "a number outside 0 to 2 is not offered",
  );
  assert.deepEqual(
    completeStep(state, step.key, { given: { kind: "yes-no", value: true } }, ports),
    rejected,
    "an answer of another shape is not offered",
  );
  assert.equal(JSON.stringify(canonicalState(state)), before);
  assert.deepEqual(plain(step), EMPATH_STEP);
  assert.deepEqual(draws, []);
});

for (const answer of [2, 0]) {
  test(`an impaired Empath records the host's ${answer} and journals it as false information (TB-EMPATH-03)`, () => {
    const state = empathNight(true);
    const step = roleStep(state, "empath");
    const logged = state.log.length;
    const { ports, draws } = recordingPorts();

    const result = completeStep(
      state,
      step.key,
      { given: { kind: "number", value: answer } },
      ports,
    );

    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(plain(step), {
      ...EMPATH_STEP,
      given: { kind: "number", value: answer },
      note: "Шаг выполнен.",
      done: true,
      completedAt: "2030-01-01T00:00:01.000Z",
      impaired: true,
      noteKey: "note.finished",
      noteVars: null,
    });
    assert.deepEqual(plain(state.log.slice(logged)), [
      { ...EMPATH_LINE, id: "log-4-k1000" },
      {
        id: "log-5-k2000",
        at: "2030-01-01T00:00:03.000Z",
        phase: "Ночь 1",
        kind: "choice",
        title:
          "Способность даёт ложную информацию (Вортокс, отравление или опьянение): ведущий выбирает, что именно услышит игрок.",
        detail: String(answer),
        playerId: "3",
        secret: true,
        case: "false-information",
      },
    ]);
    assert.deepEqual(draws, ["clock", "id:5", "clock", "id:5", "clock"]);
  });
}

test("the Empath step journals the host's registration before the step line (TB-EMPATH-02)", () => {
  const state = make(
    {
      1: "spy",
      2: "empath",
      3: "recluse",
      4: "chef",
      5: "monk",
      6: "soldier",
      7: "undertaker",
      8: "saint",
      9: "imp",
    },
    { count: 9 },
  );
  assert.equal(startNight(state).ok, true);
  const step = roleStep(state, "empath");
  const logged = state.log.length;
  const registrations = { "1": "good", "3": "evil" };
  const { ports, draws } = recordingPorts();

  const result = completeStep(state, step.key, { registrations }, ports);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(plain(step.given), {
    kind: "number",
    value: 1,
    impaired: false,
    needsChoice: false,
    options: [],
  });
  assert.deepEqual(step.registrations, registrations);
  assert.deepEqual(
    state.log.slice(logged).map((line) => [line.kind, line.case ?? null, line.detail]),
    [
      ["choice", "registration", "P1 → good, P3 → evil"],
      ["night", null, "Шаг выполнен."],
    ],
  );
  assert.deepEqual(draws, ["id:5", "clock", "clock", "id:5", "clock"]);
});

test("a Drunk shown the Empath gets the same host question and record (TB-EMPATH-03, TB-DRUNK-01)", () => {
  const state = make(
    {
      1: "monk",
      2: "soldier",
      3: "drunk",
      4: "chef",
      5: "mayor",
      6: "virgin",
      7: "poisoner",
      8: "imp",
    },
    { count: 8, drunkShownId: "empath" },
  );
  assert.equal(startNight(state).ok, true);
  const step = roleStep(state, "empath");
  assert.equal(step.actorId, "3", "the Drunk takes the Empath's step");
  const info = { kind: "number", value: 0, impaired: true, needsChoice: true, options: [0, 1, 2] };

  assert.deepEqual(completeStep(state, step.key, {}), { ok: false, needsChoice: true, info });
  const { ports, draws } = recordingPorts();
  const result = completeStep(state, step.key, { given: { kind: "number", value: 1 } }, ports);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(plain(step.given), { kind: "number", value: 1 });
  assert.equal(step.impaired, true);
  assert.equal(state.log.at(-1)!.case, "false-information");
  assert.deepEqual(draws, ["clock", "id:5", "clock", "id:5", "clock"]);
});

test("the Empath step previews, applies and replays with the command clock and ids (TB-EMPATH-01)", () => {
  const state = empathNight();
  const runtime = createRuntime({ now: () => new Date("2030-01-01T00:00:00.000Z") });
  const command = {
    id: "empath-step",
    type: "completeNightStep",
    payload: { key: roleStep(state, "empath").key },
    at: "2030-01-01T00:00:00.000Z",
  };
  const before = canonicalState(state);

  const preview = previewCommand(state, command, runtime);
  assert.equal(preview.status, "allowed", JSON.stringify(preview));
  assert.deepEqual(canonicalState(state), before, "preview must not mutate");
  const applied = applyCommand(state, command, runtime);
  assert.equal(applied.status, "allowed", JSON.stringify(applied));
  assert.deepEqual(
    "events" in preview ? preview.events : null,
    "events" in applied ? applied.events : undefined,
    "preview and apply derive the same events",
  );
  assert.deepEqual(
    ("events" in applied ? (applied.events ?? []) : []).map((event) => event.type),
    ["step.completed", "step.updated"],
  );
  const step = state.night.queue.find((candidate) => candidate.roleId === "empath")!;
  assert.deepEqual(plain(step.given), {
    kind: "number",
    value: 0,
    impaired: false,
    needsChoice: false,
    options: [],
  });
  assert.equal(step.completedAt, "2030-01-01T00:00:00.000Z", "the step uses the command clock");

  const twin = empathNight();
  assert.equal(applyCommand(twin, command, runtime).status, "allowed");
  assert.deepEqual(twin.log.at(-1), state.log.at(-1), "the line id comes from the command stream");

  const replayed = replay(state.journal, runtime);
  assert.equal(replayed.ok, true, JSON.stringify(replayed));
  assert.deepEqual(canonicalState(replayed.state), canonicalState(state));

  const saved = importGame(exportGame(state));
  assert.equal(saved.ok, true, JSON.stringify(saved));
  if (!saved.ok) return;
  const reloaded = replay(saved.state.journal, runtime);
  assert.equal(reloaded.ok, true, JSON.stringify(reloaded));
  assert.deepEqual(canonicalState(reloaded.state), canonicalState(state));
});

test("an impaired Empath is a host choice on the command path and the answer completes it (TB-EMPATH-03)", () => {
  const state = empathNight(true);
  const runtime = createRuntime({ now: () => new Date("2030-01-01T00:00:00.000Z") });
  const key = roleStep(state, "empath").key;
  const before = canonicalState(state);
  const journaled = state.journal.entries.length;
  const send = (id: string, given?: Record<string, unknown>) =>
    applyCommand(
      state,
      {
        id,
        type: "completeNightStep",
        payload: given ? { key, given } : { key },
        at: "2030-01-01T00:00:00.000Z",
      },
      runtime,
    );
  const question = {
    kind: "info",
    options: [0, 1, 2],
    context: { kind: "number", value: 0, impaired: true, needsChoice: true, options: [0, 1, 2] },
  };

  const asked = send("empath-asked");
  assert.equal(asked.status, "requires-storyteller-choice", JSON.stringify(asked));
  assert.deepEqual("choice" in asked ? asked.choice : null, question);
  assert.equal("errorCode" in asked ? asked.errorCode : undefined, null);

  const refused = send("empath-refused", { kind: "number", value: 5 });
  assert.equal(refused.status, "requires-storyteller-choice", JSON.stringify(refused));
  assert.deepEqual("choice" in refused ? refused.choice : null, question);
  assert.equal("errorCode" in refused ? refused.errorCode : undefined, "error.66");
  assert.deepEqual(canonicalState(state), before, "the question leaves the game as it was");
  assert.equal(state.journal.entries.length, journaled, "and writes no journal entry");

  const answered = send("empath-answered", { kind: "number", value: 2 });
  assert.equal(answered.status, "allowed", JSON.stringify(answered));
  const step = state.night.queue.find((candidate) => candidate.roleId === "empath")!;
  assert.deepEqual(plain(step.given), { kind: "number", value: 2 });
  assert.equal(step.impaired, true);
  assert.equal(state.log.at(-1)!.case, "false-information");
  assert.equal(state.journal.entries.length, journaled + 1);
  const replayed = replay(state.journal, runtime);
  assert.equal(replayed.ok, true, JSON.stringify(replayed));
  assert.deepEqual(canonicalState(replayed.state), canonicalState(state));
});

// A module that owns a yes or no answer and records what it was shown. The
// tests below use it, so they do not depend on the Empath's count.
function answering(decision: InformationDecision, seen: InformationContext[] = []): RoleModule {
  return {
    id: "empath",
    edition: "tb",
    capabilities: [
      { kind: "night-step", timing: "any", step: { target: "two", infoKind: "yes-no" } },
      {
        kind: "information",
        infoKind: "probe",
        resolve(context) {
          seen.push(context);
          return decision;
        },
      },
    ],
  };
}

test("a role module's answer reaches the host as is while its owner's ability works", () => {
  const state = empathNight();
  const before = canonicalState(state);
  const module = answering({ kind: "answer", value: true, possible: [true, false] });

  const info = moduleInfoForStep(state, module, roleStep(state, "empath"));

  assert.deepEqual(info, {
    kind: "yes-no",
    value: true,
    impaired: false,
    needsChoice: false,
    options: [],
  });
  assert.deepEqual(canonicalState(state), before, "asking changes nothing");
});

test("an impaired owner of an information role is asked with the answers its module names", () => {
  const state = empathNight(true);
  const possible = ["never", "once", "twice"];
  const module = answering({ kind: "answer", value: "once", possible });

  const info = moduleInfoForStep(state, module, roleStep(state, "empath"));

  assert.deepEqual(info, {
    kind: "yes-no",
    value: "once",
    impaired: true,
    needsChoice: true,
    options: ["never", "once", "twice"],
  });
  assert.notEqual(info?.options, possible, "the host's list is a copy of the module's");
});

test("an impaired owner of a module that names no possible answers gets an empty list, not an invented one", () => {
  const state = empathNight(true);

  const info = moduleInfoForStep(
    state,
    answering({ kind: "answer", value: 4 }),
    roleStep(state, "empath"),
  );

  assert.deepEqual(info, {
    kind: "yes-no",
    value: 4,
    impaired: true,
    needsChoice: true,
    options: [],
  });
});

test("an information role that learns nothing yields no information", () => {
  const state = empathNight();

  const info = moduleInfoForStep(
    state,
    answering({ kind: "no-effect" }),
    roleStep(state, "empath"),
  );

  assert.deepEqual(info, { kind: "none" });
});

test("a module without an information capability leaves the answer to the engine", () => {
  const state = empathNight();
  const step = roleStep(state, "empath");
  const stepOnly: RoleModule = {
    id: "empath",
    edition: "tb",
    capabilities: [{ kind: "night-step", timing: "any", step: { infoKind: "number" } }],
  };

  assert.equal(moduleInfoForStep(state, stepOnly, step), null);
  assert.equal(moduleInfoForStep(state, { id: "empath", edition: "tb" }, step), null);
  assert.equal(moduleInfoForStep(state, null, step), null);
});

test("an information role reads its seat, the night, the targets and the registrations through its context", () => {
  const state = make(
    {
      1: "spy",
      2: "empath",
      3: "recluse",
      4: "chef",
      5: "monk",
      6: "soldier",
      7: "undertaker",
      8: "saint",
      9: "imp",
    },
    { count: 9 },
  );
  assert.equal(startNight(state).ok, true);
  const step = roleStep(state, "empath");
  const seen: InformationContext[] = [];
  const module = answering({ kind: "answer", value: false, possible: [true, false] }, seen);

  moduleInfoForStep(state, module, step, {
    targetIds: ["4", "9"],
    registrations: { "1": "good", "3": "evil" },
  });

  const context = seen[0]!;
  assert.equal(context.actorId, "2");
  assert.equal(context.infoKind, "probe");
  assert.deepEqual(context.targetIds, ["4", "9"]);
  assert.equal(context.impaired, false);
  assert.deepEqual(context.at, { phase: "night", number: 1 });
  assert.deepEqual(context.aliveNeighborIds("2"), ["1", "3"]);
  assert.equal(context.registeredTeamOf("1"), "good", "a Spy registered as good");
  assert.equal(context.registeredTeamOf("3"), "evil", "a Recluse registered as evil");
  assert.equal(context.registeredTeamOf("9"), "evil");
  assert.equal(context.registeredTeamOf("4"), "good");
  assert.equal(context.actualRoleOf("3"), "recluse");
  assert.equal(context.hasPlayer("9"), true);
  assert.equal(context.hasPlayer("10"), false);

  // Without an answer from the host the registrants count as their real teams,
  // and the targets are the ones recorded on the step.
  step.targetIds = ["5"];
  moduleInfoForStep(state, module, step);
  assert.deepEqual(seen[1]!.targetIds, ["5"]);
  assert.equal(seen[1]!.registeredTeamOf("1"), "evil");
  assert.equal(seen[1]!.registeredTeamOf("3"), "good");
});

test("an information role is told who registers as a Demon and who the red herring is", () => {
  const state = make(
    {
      1: "spy",
      2: "fortuneteller",
      3: "recluse",
      4: "chef",
      5: "monk",
      6: "soldier",
      7: "undertaker",
      8: "saint",
      9: "imp",
    },
    { count: 9 },
  );
  state.setup.herringId = "5";
  assert.equal(startNight(state).ok, true);
  const step = roleStep(state, "fortuneteller");
  const seen: InformationContext[] = [];
  const module = answering({ kind: "answer", value: false, possible: [true, false] }, seen);

  moduleInfoForStep(state, module, step, { registrations: { "3": "demon" } });
  moduleInfoForStep(state, module, step, { registrations: { "3": "evil" } });
  moduleInfoForStep(state, module, step);

  const [asDemon, asEvil, unregistered] = seen as [
    InformationContext,
    InformationContext,
    InformationContext,
  ];
  assert.equal(asDemon.redHerringId, "5");
  assert.equal(asDemon.registersAsDemon("9"), true, "the Demon");
  assert.equal(asDemon.registersAsDemon("3"), true, "a Recluse the host registered as the Demon");
  assert.equal(asDemon.registersAsDemon("1"), false, "a Minion");
  assert.equal(asDemon.registersAsDemon("5"), false, "the herring is a separate fact");
  assert.equal(asDemon.registersAsDemon("99"), false, "a seat that does not exist");
  assert.equal(asEvil.registersAsDemon("3"), false, "registered as evil only");
  assert.equal(unregistered.registersAsDemon("3"), false);

  state.setup.herringId = null;
  moduleInfoForStep(state, module, step);
  assert.equal(seen[3]!.redHerringId, null, "a game without a herring names none");
});

// The records of the Fortune Teller's step. Saved games and replays hold them,
// so a move of the role must leave every one of them as it is.
const FORTUNE_ROLES = {
  1: "monk",
  2: "soldier",
  3: "fortuneteller",
  4: "chef",
  5: "mayor",
  6: "poisoner",
  7: "imp",
};

// The Mayor is the red herring; the Fortune Teller sits at 3.
function fortuneNight(poisoned = false): GameState {
  const state = make(FORTUNE_ROLES);
  state.setup.herringId = "5";
  assert.equal(startNight(state).ok, true);
  if (poisoned) completeRole(state, "poisoner", { targetIds: ["3"] });
  return state;
}

const FORTUNE_STEP = {
  key: "n1-8-fortuneteller-3",
  kind: "role",
  roleId: "fortuneteller",
  actorId: "3",
  actorName: "P3",
  actorAlive: true,
  order: 8,
  targetMode: "two",
  infoKind: "yes-no",
  targetIds: [],
  redirectId: null,
  registrations: {},
  given: null,
  result: null,
  note: null,
  pending: null,
  done: false,
  skipped: false,
  completedAt: null,
};

const FORTUNE_LINE = {
  id: "log-3-k1000",
  at: "2030-01-01T00:00:02.000Z",
  phase: "Ночь 1",
  kind: "night",
  title: "Гадалка",
  detail: "Шаг выполнен.",
  playerId: null,
  secret: true,
  roleId: "fortuneteller",
  phaseCode: "night",
  phaseNumber: 1,
  noteKey: "note.finished",
  noteVars: null,
};

test("the Fortune Teller step is built for two players with the yes-or-no shape on every night (TB-FORTUNETELLER-01)", () => {
  const state = fortuneNight();
  assert.deepEqual(plain(roleStep(state, "fortuneteller")), FORTUNE_STEP);

  skipNight(state);
  assert.equal(endDay(state).ok, true);
  const later = roleStep(state, "fortuneteller");
  assert.equal(later.key, "n2-6-fortuneteller-3", "the Fortune Teller wakes after the Demon");
  assert.equal(later.targetMode, "two");
  assert.equal(later.infoKind, "yes-no");
});

test("the Fortune Teller hears yes for the Demon or the red herring and no otherwise (TB-FORTUNETELLER-01)", () => {
  const state = fortuneNight();
  const step = roleStep(state, "fortuneteller");
  const answer = (targetIds?: string[]) => infoForStep(state, step, { targetIds }).value;

  assert.equal(answer(["7", "1"]), true, "the Imp");
  assert.equal(answer(["1", "7"]), true, "the Imp as the second player");
  assert.equal(answer(["5", "1"]), true, "the red herring");
  assert.equal(answer(["1", "4"]), false);
  assert.equal(answer(["3", "4"]), false, "the Fortune Teller's own seat is not the herring here");
  assert.equal(answer(["6", "4"]), false, "a Minion is not a Demon");
  assert.equal(answer(["99", "1"]), false, "a seat that does not exist answers nothing");
  assert.equal(answer(), false, "no players chosen yet");

  state.setup.herringId = "3";
  assert.equal(answer(["3", "4"]), true, "the Fortune Teller may be the red herring");
  assert.equal(answer(["5", "1"]), false, "the herring is one player");
});

test("the Fortune Teller step keeps the computed answer as its record and writes one step line (TB-FORTUNETELLER-01)", () => {
  const state = fortuneNight();
  const step = roleStep(state, "fortuneteller");
  const logged = state.log.length;
  const { ports, draws } = recordingPorts();

  assert.deepEqual(infoForStep(state, step, { targetIds: ["7", "1"] }), {
    kind: "yes-no",
    value: true,
    impaired: false,
    needsChoice: false,
    options: [],
  });
  const result = completeStep(state, step.key, { targetIds: ["7", "1"] }, ports);

  assert.deepEqual(Object.keys(result), ["ok", "step"]);
  assert.equal(result.ok, true);
  assert.deepEqual(plain(step), {
    ...FORTUNE_STEP,
    targetIds: ["7", "1"],
    given: { kind: "yes-no", value: true, impaired: false, needsChoice: false, options: [] },
    note: "Шаг выполнен.",
    done: true,
    completedAt: "2030-01-01T00:00:01.000Z",
    impaired: false,
    noteKey: "note.finished",
    noteVars: null,
  });
  assert.deepEqual(
    Object.keys(step.given!),
    ["kind", "value", "impaired", "needsChoice", "options"],
    "saved games hold the answer in this key order",
  );
  assert.deepEqual(plain(state.log.slice(logged)), [FORTUNE_LINE]);
  assert.deepEqual(draws, ["clock", "id:5", "clock"]);
});

test("the Fortune Teller step needs two different players and changes nothing without them (TB-FORTUNETELLER-01)", () => {
  const state = fortuneNight();
  const step = roleStep(state, "fortuneteller");
  const before = JSON.stringify(canonicalState(state));
  const { ports, draws } = recordingPorts();
  const twoPlayers = { ok: false, errorCode: "error.41", error: "Выберите двух разных игроков." };

  assert.deepEqual(completeStep(state, step.key, {}, ports), twoPlayers);
  assert.deepEqual(completeStep(state, step.key, { targetIds: ["7"] }, ports), twoPlayers);
  assert.deepEqual(
    completeStep(state, step.key, { targetIds: ["7", "1", "2"] }, ports),
    twoPlayers,
  );
  assert.deepEqual(completeStep(state, step.key, { targetIds: ["7", "7"] }, ports), {
    ok: false,
    errorCode: "error.42",
    error: "Нужны два разных игрока.",
  });
  assert.deepEqual(completeStep(state, step.key, { targetIds: ["99", "1"] }, ports), {
    ok: false,
    errorCode: "error.31",
    error: "Цель не найдена.",
  });
  assert.equal(JSON.stringify(canonicalState(state)), before);
  assert.deepEqual(plain(step), FORTUNE_STEP);
  assert.deepEqual(draws, []);
});

test("a healthy Fortune Teller step stores what the host sends and journals no choice (TB-FORTUNETELLER-01)", () => {
  const state = fortuneNight();
  const step = roleStep(state, "fortuneteller");
  const logged = state.log.length;
  const { ports, draws } = recordingPorts();

  const result = completeStep(
    state,
    step.key,
    { targetIds: ["1", "4"], given: { kind: "yes-no", value: true } },
    ports,
  );

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(plain(step.given), { kind: "yes-no", value: true });
  assert.deepEqual(step.targetIds, ["1", "4"]);
  assert.equal(step.impaired, false);
  assert.deepEqual(plain(state.log.slice(logged)), [FORTUNE_LINE]);
  assert.deepEqual(draws, ["clock", "id:5", "clock"]);
});

test("an impaired Fortune Teller waits for the host's answer and changes nothing (SYS-EFFECTS-01)", () => {
  const state = fortuneNight(true);
  const step = roleStep(state, "fortuneteller");
  const info = {
    kind: "yes-no",
    value: true,
    impaired: true,
    needsChoice: true,
    options: [true, false],
  };
  const before = JSON.stringify(canonicalState(state));
  const { ports, draws } = recordingPorts();

  assert.deepEqual(infoForStep(state, step, { targetIds: ["7", "1"] }), info);
  assert.deepEqual(completeStep(state, step.key, { targetIds: ["7", "1"] }, ports), {
    ok: false,
    needsChoice: true,
    info,
  });
  const rejected = {
    ok: false,
    needsChoice: true,
    info,
    errorCode: "error.66",
    error: "Выберите один из предложенных вариантов.",
  };
  assert.deepEqual(
    completeStep(
      state,
      step.key,
      { targetIds: ["7", "1"], given: { kind: "yes-no", value: "maybe" } },
      ports,
    ),
    rejected,
    "an answer other than yes or no is not offered",
  );
  assert.deepEqual(
    completeStep(
      state,
      step.key,
      { targetIds: ["7", "1"], given: { kind: "number", value: 1 } },
      ports,
    ),
    rejected,
    "an answer of another shape is not offered",
  );
  assert.equal(JSON.stringify(canonicalState(state)), before);
  assert.deepEqual(plain(step), FORTUNE_STEP);
  assert.deepEqual(draws, []);
});

for (const [answer, word] of [
  [false, "нет"],
  [true, "да"],
] as const) {
  test(`an impaired Fortune Teller records the host's "${answer ? "yes" : "no"}" and journals it as false information (SYS-EFFECTS-01)`, () => {
    const state = fortuneNight(true);
    const step = roleStep(state, "fortuneteller");
    const logged = state.log.length;
    const { ports, draws } = recordingPorts();

    const result = completeStep(
      state,
      step.key,
      { targetIds: ["7", "1"], given: { kind: "yes-no", value: answer } },
      ports,
    );

    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(plain(step), {
      ...FORTUNE_STEP,
      targetIds: ["7", "1"],
      given: { kind: "yes-no", value: answer },
      note: "Шаг выполнен.",
      done: true,
      completedAt: "2030-01-01T00:00:01.000Z",
      impaired: true,
      noteKey: "note.finished",
      noteVars: null,
    });
    assert.deepEqual(plain(state.log.slice(logged)), [
      { ...FORTUNE_LINE, id: "log-4-k1000" },
      {
        id: "log-5-k2000",
        at: "2030-01-01T00:00:03.000Z",
        phase: "Ночь 1",
        kind: "choice",
        title:
          "Способность даёт ложную информацию (Вортокс, отравление или опьянение): ведущий выбирает, что именно услышит игрок.",
        detail: word,
        playerId: "3",
        secret: true,
        case: "false-information",
      },
    ]);
    assert.deepEqual(draws, ["clock", "id:5", "clock", "id:5", "clock"]);
  });
}

test("the Fortune Teller step journals a Recluse registered as the Demon before the step line (TB-FORTUNETELLER-01, TB-RECLUSE-02)", () => {
  const seats = {
    1: "spy",
    2: "fortuneteller",
    3: "recluse",
    4: "chef",
    5: "monk",
    6: "soldier",
    7: "undertaker",
    8: "saint",
    9: "imp",
  };
  const night = () => {
    const state = make(seats, { count: 9 });
    state.setup.herringId = "5";
    assert.equal(startNight(state).ok, true);
    return state;
  };
  const state = night();
  const step = roleStep(state, "fortuneteller");
  const logged = state.log.length;
  const registrations = { "3": "demon" };
  const { ports, draws } = recordingPorts();

  const result = completeStep(state, step.key, { targetIds: ["3", "4"], registrations }, ports);

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(plain(step.given), {
    kind: "yes-no",
    value: true,
    impaired: false,
    needsChoice: false,
    options: [],
  });
  assert.deepEqual(step.registrations, registrations);
  assert.deepEqual(
    state.log.slice(logged).map((line) => [line.kind, line.case ?? null, line.detail]),
    [
      ["choice", "registration", "P3 → demon"],
      ["night", null, "Шаг выполнен."],
    ],
  );
  assert.deepEqual(draws, ["id:5", "clock", "clock", "id:5", "clock"]);

  // Registered as evil only, the Recluse is not a Demon to the Fortune Teller.
  const evil = night();
  const evilStep = roleStep(evil, "fortuneteller");
  assert.equal(
    completeStep(evil, evilStep.key, { targetIds: ["3", "4"], registrations: { "3": "evil" } }).ok,
    true,
  );
  assert.equal(evilStep.given!.value, false);

  // A Spy cannot register as the Demon: the step is refused and nothing changes.
  const spy = night();
  const spyStep = roleStep(spy, "fortuneteller");
  const before = JSON.stringify(canonicalState(spy));
  assert.deepEqual(
    completeStep(spy, spyStep.key, { targetIds: ["1", "4"], registrations: { "1": "demon" } }),
    { ok: false, errorCode: "error.67", error: "Недопустимое значение регистрации." },
  );
  assert.equal(JSON.stringify(canonicalState(spy)), before);
});

test("a Drunk shown the Fortune Teller gets the same host question and record (SYS-EFFECTS-01, TB-DRUNK-01)", () => {
  const state = make(
    {
      1: "monk",
      2: "soldier",
      3: "drunk",
      4: "chef",
      5: "mayor",
      6: "virgin",
      7: "poisoner",
      8: "imp",
    },
    { count: 8, drunkShownId: "fortuneteller" },
  );
  assert.equal(startNight(state).ok, true);
  const step = roleStep(state, "fortuneteller");
  assert.equal(step.actorId, "3", "the Drunk takes the Fortune Teller's step");
  const info = {
    kind: "yes-no",
    value: true,
    impaired: true,
    needsChoice: true,
    options: [true, false],
  };

  assert.deepEqual(completeStep(state, step.key, { targetIds: ["8", "1"] }), {
    ok: false,
    needsChoice: true,
    info,
  });
  const { ports, draws } = recordingPorts();
  const result = completeStep(
    state,
    step.key,
    { targetIds: ["8", "1"], given: { kind: "yes-no", value: false } },
    ports,
  );

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(plain(step.given), { kind: "yes-no", value: false });
  assert.equal(step.impaired, true);
  assert.equal(state.log.at(-1)!.case, "false-information");
  assert.deepEqual(draws, ["clock", "id:5", "clock", "id:5", "clock"]);
});

test("the Fortune Teller step previews, applies and replays with the command clock and ids (TB-FORTUNETELLER-01)", () => {
  const state = fortuneNight();
  const runtime = createRuntime({ now: () => new Date("2030-01-01T00:00:00.000Z") });
  const command = {
    id: "fortune-step",
    type: "completeNightStep",
    payload: { key: roleStep(state, "fortuneteller").key, targetIds: ["5", "1"] },
    at: "2030-01-01T00:00:00.000Z",
  };
  const before = canonicalState(state);

  const preview = previewCommand(state, command, runtime);
  assert.equal(preview.status, "allowed", JSON.stringify(preview));
  assert.deepEqual(canonicalState(state), before, "preview must not mutate");
  const applied = applyCommand(state, command, runtime);
  assert.equal(applied.status, "allowed", JSON.stringify(applied));
  assert.deepEqual(
    "events" in preview ? preview.events : null,
    "events" in applied ? applied.events : undefined,
    "preview and apply derive the same events",
  );
  assert.deepEqual(
    ("events" in applied ? (applied.events ?? []) : []).map((event) => event.type),
    ["step.completed", "step.updated"],
  );
  const step = state.night.queue.find((candidate) => candidate.roleId === "fortuneteller")!;
  assert.deepEqual(plain(step.given), {
    kind: "yes-no",
    value: true,
    impaired: false,
    needsChoice: false,
    options: [],
  });
  assert.deepEqual(step.targetIds, ["5", "1"]);
  assert.equal(step.completedAt, "2030-01-01T00:00:00.000Z", "the step uses the command clock");

  const twin = fortuneNight();
  assert.equal(applyCommand(twin, command, runtime).status, "allowed");
  assert.deepEqual(twin.log.at(-1), state.log.at(-1), "the line id comes from the command stream");

  const replayed = replay(state.journal, runtime);
  assert.equal(replayed.ok, true, JSON.stringify(replayed));
  assert.deepEqual(canonicalState(replayed.state), canonicalState(state));

  const saved = importGame(exportGame(state));
  assert.equal(saved.ok, true, JSON.stringify(saved));
  if (!saved.ok) return;
  const reloaded = replay(saved.state.journal, runtime);
  assert.equal(reloaded.ok, true, JSON.stringify(reloaded));
  assert.deepEqual(canonicalState(reloaded.state), canonicalState(state));
});

test("an impaired Fortune Teller is a host choice on the command path and the answer completes it (SYS-EFFECTS-01)", () => {
  const state = fortuneNight(true);
  const runtime = createRuntime({ now: () => new Date("2030-01-01T00:00:00.000Z") });
  const key = roleStep(state, "fortuneteller").key;
  const before = canonicalState(state);
  const journaled = state.journal.entries.length;
  const send = (id: string, given?: Record<string, unknown>) =>
    applyCommand(
      state,
      {
        id,
        type: "completeNightStep",
        payload: given ? { key, targetIds: ["1", "4"], given } : { key, targetIds: ["1", "4"] },
        at: "2030-01-01T00:00:00.000Z",
      },
      runtime,
    );
  const question = {
    kind: "info",
    options: [true, false],
    context: {
      kind: "yes-no",
      value: false,
      impaired: true,
      needsChoice: true,
      options: [true, false],
    },
  };

  const asked = send("fortune-asked");
  assert.equal(asked.status, "requires-storyteller-choice", JSON.stringify(asked));
  assert.deepEqual("choice" in asked ? asked.choice : null, question);
  assert.equal("errorCode" in asked ? asked.errorCode : undefined, null);

  const refused = send("fortune-refused", { kind: "yes-no", value: "maybe" });
  assert.equal(refused.status, "requires-storyteller-choice", JSON.stringify(refused));
  assert.deepEqual("choice" in refused ? refused.choice : null, question);
  assert.equal("errorCode" in refused ? refused.errorCode : undefined, "error.66");
  assert.deepEqual(canonicalState(state), before, "the question leaves the game as it was");
  assert.equal(state.journal.entries.length, journaled, "and writes no journal entry");

  const answered = send("fortune-answered", { kind: "yes-no", value: true });
  assert.equal(answered.status, "allowed", JSON.stringify(answered));
  const step = state.night.queue.find((candidate) => candidate.roleId === "fortuneteller")!;
  assert.deepEqual(plain(step.given), { kind: "yes-no", value: true });
  assert.equal(step.impaired, true);
  assert.equal(state.log.at(-1)!.case, "false-information");
  assert.equal(state.journal.entries.length, journaled + 1);
  const replayed = replay(state.journal, runtime);
  assert.equal(replayed.ok, true, JSON.stringify(replayed));
  assert.deepEqual(canonicalState(replayed.state), canonicalState(state));
});

test("a drunk or poisoned Soldier dies to the Demon (TB-SOLDIER-01)", () => {
  const state = make({
    1: "monk",
    2: "soldier",
    3: "empath",
    4: "chef",
    5: "mayor",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "poisoner", { targetIds: ["2"] });
  completeRole(state, "imp", { targetIds: ["2"] });
  assert.equal(state.players["2"].alive, false, "an impaired Soldier has no protection");
});

test("the Drunk has no ability at any phase (TB-DRUNK-01)", () => {
  const state = make(
    { 1: "drunk", 2: "chef", 3: "empath", 4: "monk", 5: "poisoner", 6: "imp" },
    { count: 6, drunkShownId: "mayor" },
  );
  assert.equal(state.players["1"].roleId, "drunk");
  assert.equal(isImpaired(state, "1", { phase: "night", number: 1 }), true);
  assert.equal(isImpaired(state, "1", { phase: "day", number: 1 }), true);
});

test("poisoned protection fails and the target dies", () => {
  const state = make({
    1: "monk",
    2: "soldier",
    3: "empath",
    4: "chef",
    5: "mayor",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "poisoner", { targetIds: ["1"] });
  completeRole(state, "monk", { targetIds: ["4"] });
  completeRole(state, "imp", { targetIds: ["4"] });
  assert.equal(state.players["4"].alive, false);
});

test("Ravenkeeper wakes after a night death and learns a character (TB-RAVENKEEPER-01, SYS-NIGHT-02)", () => {
  const state = make({
    1: "ravenkeeper",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "undertaker",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "poisoner", { targetIds: ["2"] });
  completeRole(state, "imp", { targetIds: ["1"] });
  const rk = roleStep(state, "ravenkeeper");
  assert.ok(rk, "ravenkeeper step inserted");
  assert.equal(rk.actorId, "1");
  assert.equal(rk.actorAlive, false);
  completeRole(state, "ravenkeeper", { targetIds: ["2"] });
  const step = state.night.queue.find((candidate) => candidate.roleId === "ravenkeeper")!;
  assert.equal(step.done, true);
  assert.ok(step.given);
  assert.equal(
    step.given!.roleId,
    state.players["2"].roleId,
    "the Ravenkeeper reads the chosen player's character",
  );
});

test("Undertaker learns an execution death, not a night death (TB-UNDERTAKER-01)", () => {
  const state = make({
    1: "undertaker",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "soldier",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  openNominations(state);
  appoint(state, "1", "2", ["1", "2", "3", "4", "5"]);
  const execution = execute(state, state.day.nominations[0].id);
  assert.equal(execution.ok, true);
  endDay(state);
  startNight(state);
  const step = roleStep(state, "undertaker");
  assert.ok(step, "undertaker step on the next night");
  completeRole(state, "undertaker");
  const done = state.night.queue.find((candidate) => candidate.roleId === "undertaker")!;
  assert.equal(done.given!.roleId, "chef");
});

test("Scarlet Woman inherits only with five living before the Demon dies (TB-SCARLETWOMAN-01)", () => {
  const five = make({
    1: "chef",
    2: "monk",
    3: "mayor",
    4: "scarletwoman",
    5: "imp",
  });
  five.phase = "day";
  five.day = {
    number: 1,
    morning: [],
    nominations: [],
    activeNominationId: null,
    execution: null,
    ended: false,
    open: true,
  };
  appoint(five, "2", "5", ["2", "3", "4"]);
  const result = execute(five, five.day.nominations[0].id);
  assert.equal(result.ok, true);
  assert.equal(five.players["5"].alive, false);
  assert.equal(five.players["4"].roleId, "imp");
  assert.equal(five.winner, null, "the new Demon keeps the game alive");
});

test("the new Demon is woken the night after a daytime Scarlet Woman succession (TB-SCARLETWOMAN-02)", () => {
  const state = make({ 1: "chef", 2: "monk", 3: "mayor", 4: "scarletwoman", 5: "imp" });
  state.phase = "day";
  state.day = {
    number: 1,
    morning: [],
    nominations: [],
    activeNominationId: null,
    execution: null,
    ended: false,
    open: true,
  };
  appoint(state, "2", "5", ["2", "3", "4"]);
  assert.equal(execute(state, state.day.nominations[0].id).ok, true);
  assert.equal(state.players["4"].roleId, "imp");

  // Scarlet Woman r3117, How to Run: "That night, wake the new Imp, show them
  // the YOU ARE info token, then show them the Imp token."
  assert.equal(endDay(state).ok, true);
  const change = state.night.queue.find((step) => step.system === "demonchange");
  assert.ok(change, "the new Imp is woken after a daytime succession");
  assert.equal(completeStep(state, change.key, {}).ok, true);
  assert.equal(state.night.queue.find((step) => step.key === change.key)!.done, true);
});

test("Scarlet Woman does not inherit below the threshold", () => {
  const state = make({
    1: "chef",
    2: "monk",
    3: "mayor",
    4: "scarletwoman",
    5: "imp",
  });
  kill(state, "1", "test", dayAt(state));
  state.phase = "day";
  state.day = {
    number: 1,
    morning: [],
    nominations: [],
    activeNominationId: null,
    execution: null,
    ended: false,
    open: true,
  };
  const result = execute(
    state,
    (() => {
      appoint(state, "2", "5", ["2", "3", "4"]);
      return state.day.nominations[0].id;
    })(),
  );
  assert.equal(result.ok, true);
  assert.equal(state.players["4"].roleId, "scarletwoman");
  assert.equal(state.winner && state.winner.team, "good");
});

test("Imp self-kill passes the role and the new Demon does not act again (TB-IMP-01)", () => {
  const state = make({
    1: "chef",
    2: "monk",
    3: "mayor",
    4: "soldier",
    5: "empath",
    6: "scarletwoman",
    7: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "monk", { targetIds: ["3"] });
  completeRole(state, "imp", { targetIds: ["7"] });
  assert.equal(state.players["7"].alive, false);
  assert.equal(state.players["6"].roleId, "imp");
  assert.equal(state.night.queue.filter((step) => step.roleId === "imp" && !step.done).length, 0);
});

test("Virgin executes only the first eligible Townsfolk nominator (TB-VIRGIN-01)", () => {
  const state = make({
    1: "virgin",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "soldier",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  openNominations(state);
  const result = nominate(state, "2", "1");
  assert.equal(result.ok, true);
  assert.equal(result.virgin, true);
  assert.equal(state.players["2"].alive, false);
  assert.equal(state.players["1"].alive, true);
  assert.equal(state.day.nominations.length, 0);
  assert.equal(state.day.execution!.cause, "virgin");
});

test("Drunk nominator does not trigger the Virgin", () => {
  const state = make(
    {
      1: "virgin",
      2: "drunk",
      3: "chef",
      4: "empath",
      5: "monk",
      6: "poisoner",
      7: "imp",
      8: "soldier",
    },
    { drunkShownId: "washerwoman" },
  );
  toDay(state);
  openNominations(state);
  const result = nominate(state, "2", "1");
  assert.equal(result.ok, true);
  assert.equal(Boolean(result.virgin), false);
  assert.equal(state.day.nominations.length, 1);
  assert.equal(state.players["2"].alive, true);
});

test("a poisoned Slayer spends the ability without killing (TB-SLAYER-01)", () => {
  const state = make({
    1: "slayer",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "soldier",
    6: "poisoner",
    7: "imp",
  });
  startNight(state);
  completeSystem(state, "minioninfo");
  completeSystem(state, "demoninfo");
  completeRole(state, "poisoner", { targetIds: ["1"] });
  skipNight(state);
  const result = useSlayer(state, "1", "7");
  assert.equal(result.ok, true);
  assert.equal(result.hit, false);
  assert.equal(state.players["7"].alive, true);
  assert.equal(state.players["1"].used.slayer, true);
});

test("a healthy Slayer kills the Demon and good wins", () => {
  const state = make({
    1: "slayer",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "soldier",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  const result = useSlayer(state, "1", "7");
  assert.equal(result.ok, true);
  assert.equal(result.hit, true);
  assert.equal(state.players["7"].alive, false);
  assert.equal(state.winner && state.winner.team, "good");
});

test("a healthy Slayer shot at a non-Demon misses and spends the ability (TB-SLAYER-01)", () => {
  const state = make({
    1: "slayer",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "soldier",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  const result = useSlayer(state, "1", "2");
  assert.equal(result.ok, true);
  assert.equal(result.hit, false);
  assert.equal(state.players["2"].alive, true);
  assert.equal(state.players["1"].used.slayer, true);
  assert.ok(
    state.log.some((entry) => entry.title.includes("промахивается")),
    "the miss is explained",
  );
});

test("dead votes count once, are spent on a failed nomination, and cannot repeat (SYS-VOTES-03)", () => {
  const state = make({
    1: "chef",
    2: "empath",
    3: "monk",
    4: "soldier",
    5: "mayor",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  openNominations(state);
  appoint(state, "1", "2", ["1", "2", "3", "4", "5"]);
  execute(state, state.day.nominations[0].id);
  endDay(state);
  skipNight(state);
  openNominations(state);
  const nomination = appoint(state, "3", "4", ["2"]);
  assert.equal(nomination.count, 1);
  assert.equal(state.players["2"].voteToken, false);
  assert.equal(nomination.result, "failed");
  const second = nominate(state, "5", "1");
  assert.equal(second.ok, true);
  const votes = recordVotes(state, second.nomination!.id, ["2"]);
  assert.equal(votes.ok, true);
  const counted = votes.nomination as TestNomination;
  assert.equal(counted.count, 0);
  assert.ok(counted.butlerWarning.length >= 0);
});

test("ties on the maximum block execution, and a lower tie does not dethrone the leader", () => {
  const state = make({
    1: "chef",
    2: "empath",
    3: "monk",
    4: "soldier",
    5: "mayor",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  openNominations(state);
  appoint(state, "1", "2", ["1", "2", "3", "4"]);
  appoint(state, "2", "3", ["1", "2", "3", "4"]);
  let result = leader(state);
  assert.equal(result.tie, true);
  const third = appoint(state, "3", "4", ["1", "2", "3", "4", "5"]);
  result = leader(state);
  assert.equal(result.nomination!.id, third.id);
  assert.equal(result.count, 5);
  appoint(state, "4", "5", ["1", "2"]);
  result = leader(state);
  assert.equal(result.nomination!.id, third.id);
});

test("execution is an execution event, not automatically a death (SYS-WINS-01)", () => {
  const state = make({
    1: "chef",
    2: "empath",
    3: "monk",
    4: "soldier",
    5: "mayor",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  kill(state, "4", "test", dayAt(state));
  openNominations(state);
  const beforeDeaths = state.deaths.length;
  appoint(state, "1", "4", ["1", "2", "3", "5"]);
  const result = execute(state, state.day.nominations[0].id);
  assert.equal(result.ok, true);
  assert.equal(state.deaths.length, beforeDeaths);
  assert.equal(state.executions.length, 1);
  assert.equal(state.day.execution!.playerId, "4");
  const executionLog = state.log.filter((entry) => entry.kind === "execution").at(-1);
  assert.equal(executionLog?.consequence, "prevented");
});

test("Saint loses on execution and Mayor wins at three alive without execution (TB-MAYOR-01, TB-SAINT-01)", () => {
  const saint = make({
    1: "saint",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "soldier",
    6: "virgin",
    7: "poisoner",
    8: "imp",
  });
  toDay(saint);
  openNominations(saint);
  appoint(saint, "1", "1", ["1", "2", "3", "4", "5"]);
  execute(saint, saint.day.nominations[0].id);
  assert.equal(saint.winner && saint.winner.team, "evil");
  assert.equal(saint.winner!.reason, "saint");

  const mayor = make({
    1: "mayor",
    2: "chef",
    3: "monk",
    4: "poisoner",
    5: "imp",
  });
  toDay(mayor);
  kill(mayor, "2", "test", dayAt(mayor));
  kill(mayor, "3", "test", dayAt(mayor));
  const result = endDay(mayor);
  assert.equal(result.ok, true);
  assert.equal(mayor.winner && mayor.winner.team, "good");
  assert.equal(mayor.winner!.reason, "mayor");
});

test("the Saint's night death does not lose the game (TB-SAINT-02)", () => {
  const state = make({
    1: "saint",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "soldier",
    6: "undertaker",
    7: "poisoner",
    8: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "imp", { targetIds: ["1"] });
  assert.equal(state.players["1"].alive, false);
  assert.equal(checkWin(state), null, "only an execution loses for the Saint");
});

test("a corpse execution counts as an execution event and prevents the Mayor win (TB-MAYOR-01)", () => {
  const state = make({
    1: "mayor",
    2: "chef",
    3: "monk",
    4: "poisoner",
    5: "imp",
  });
  toDay(state);
  kill(state, "2", "test", dayAt(state));
  kill(state, "3", "test", dayAt(state));
  openNominations(state);
  appoint(state, "1", "2", ["1", "4"]);
  execute(state, state.day.nominations[0].id);
  endDay(state);
  assert.equal(state.winner, null);
  assert.equal(state.phase, "night");
});

test("win priorities: no living Demon is checked before the two-alive evil win (SYS-WINS-02)", () => {
  const state = make({
    1: "chef",
    2: "monk",
    3: "mayor",
    4: "scarletwoman",
    5: "imp",
  });
  kill(state, "4", "test", dayAt(state));
  kill(state, "1", "test", dayAt(state));
  kill(state, "5", "test", dayAt(state));
  const winner = checkWin(state);
  assert.equal(winner && winner.team, "good");
  assert.equal(winner!.reason, "demon-dead");
});

test("execution requires at least half the living players (SYS-VOTES-02)", () => {
  assert.equal(executionThreshold(5), 3);
  assert.equal(executionThreshold(6), 3);
  assert.equal(executionThreshold(7), 4);
  assert.equal(executionThreshold(8), 4);
  const state = make({
    1: "chef",
    2: "empath",
    3: "monk",
    4: "saint",
    5: "poisoner",
    6: "imp",
  });
  toDay(state);
  openNominations(state);
  const nomination = nominate(state, "1", "2").nomination!;
  const three = recordVotes(state, nomination.id, ["1", "3", "4"]);
  assert.equal(three.ok, true);
  assert.equal(three.nomination!.threshold, 3);
  assert.equal(three.nomination!.result, "qualified");
  const reset = resetVotes(state, nomination.id, "test");
  assert.equal(reset.ok, true);
  const four = recordVotes(state, nomination.id, ["1", "3", "4", "5"]);
  assert.equal(four.ok, true);
  assert.equal(four.nomination!.result, "qualified");
});

test("completed night steps and recorded votes cannot be applied twice (SYS-STATE-01)", () => {
  const state = make({
    1: "chef",
    2: "empath",
    3: "monk",
    4: "soldier",
    5: "mayor",
    6: "poisoner",
    7: "imp",
  });
  startNight(state);
  completeSystem(state, "minioninfo");
  completeSystem(state, "demoninfo");
  completeRole(state, "poisoner", { targetIds: ["1"] });
  const step = state.night.queue.find((candidate) => candidate.roleId === "poisoner")!;
  const again = completeStep(state, step.key, { targetIds: ["2"] });
  assert.equal(again.ok, false);
  skipNight(state);
  openNominations(state);
  const nomination = appoint(state, "1", "2", ["1", "2"]);
  const repeat = recordVotes(state, nomination.id, ["3"]);
  assert.equal(repeat.ok, false);
  const cancel = cancelNomination(state, nomination.id);
  assert.equal(cancel.ok, false);
});

test("migration, export/import and public projection keep secrets out of public data (SYS-STATE-06, SYS-PRIVACY-01)", () => {
  const legacy = {
    v: 2,
    scriptId: "tb",
    night: 1,
    order: ["1", "2", "3", "4", "5"],
    players: {
      1: {
        name: "A",
        alive: true,
        claimed: true,
        roleId: "empath",
        shownRoleId: "empath",
        reminders: [],
      },
      2: {
        name: "B",
        alive: true,
        claimed: true,
        roleId: "imp",
        shownRoleId: "imp",
        reminders: [],
      },
      3: {
        name: "C",
        alive: false,
        claimed: true,
        roleId: "chef",
        shownRoleId: "chef",
        reminders: [],
      },
      4: {
        name: "D",
        alive: true,
        claimed: true,
        roleId: "monk",
        shownRoleId: "monk",
        reminders: [],
      },
      5: {
        name: "E",
        alive: true,
        claimed: true,
        roleId: "poisoner",
        shownRoleId: "poisoner",
        reminders: [],
      },
    },
    bluffs: [],
    nightOrder: [],
    log: [],
    notes: "secret",
  };
  const migrated = migrateV2(legacy);
  assert.equal(migrated.v, 4);
  assert.equal(migrated.players["3"].alive, false);
  assert.equal(migrated.deaths.length, 1);
  const exported = exportGame(migrated);
  const imported = importGame(exported);
  assert.equal(imported.ok, true);
  assert.equal(imported.state.players["1"].roleId, "empath");
  const bad = importGame({ format: "pocket-grimoire", version: 3, game: { v: 3, players: {} } });
  assert.equal(bad.ok, false);

  const role = { name: "Empath", team: "townsfolk", ability: "Learn a number." } as Role;
  const publicRole = publicRoleView(migrated.players["1"], role);
  assert.equal(JSON.stringify(publicRole).includes("roleId"), false);
  const publicGame = publicGameView(migrated);
  const text = JSON.stringify(publicGame);
  assert.equal(text.includes("empath"), false);
  assert.equal(text.includes("poisoner"), false);
  assert.equal(text.includes("secret"), false);
});

test("Imp attack on the Mayor can be redirected to another player", () => {
  const state = make({
    1: "mayor",
    2: "chef",
    3: "monk",
    4: "soldier",
    5: "empath",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "poisoner", { targetIds: ["5"] });
  const imp = roleStep(state, "imp");
  const first = completeStep(state, imp.key, { targetIds: ["1"] }) as StepResult;
  assert.equal(first.ok, false);
  assert.equal(first.needsRedirect, true);
  const second = completeStep(state, imp.key, { targetIds: ["1"], redirectId: "2" });
  assert.equal(second.ok, true);
  assert.equal(state.players["1"].alive, true);
  assert.equal(state.players["2"].alive, false);
});

test("a Mayor redirect to a dead player kills nobody and keeps the Mayor alive", () => {
  const state = make({
    1: "mayor",
    2: "chef",
    3: "monk",
    4: "soldier",
    5: "empath",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "poisoner", { targetIds: ["5"] });
  kill(state, "2", "test");
  const deathsBefore = state.deaths.length;
  const imp = roleStep(state, "imp");
  const prompt = completeStep(state, imp.key, { targetIds: ["1"] }) as StepResult;
  assert.equal(prompt.ok, false);
  assert.equal(prompt.needsRedirect, true);
  assert.ok(
    prompt.options!.some((option) => option.id === "2" && option.alive === false),
    "the Storyteller may name a dead player",
  );
  const attack = completeStep(state, imp.key, {
    targetIds: ["1"],
    redirectId: "2",
  }) as StepResult;
  assert.equal(attack.ok, true);
  assert.equal(attack.result!.noDeath, true);
  assert.equal(attack.result!.deathId, undefined);
  assert.equal(state.players["1"].alive, true, "the Mayor survives");
  assert.equal(state.players["2"].alive, false);
  assert.equal(state.deaths.length, deathsBefore, "a dead replacement produces no extra death");
});

test("a Mayor redirect to a healthy Soldier kills nobody and keeps the Mayor alive", () => {
  const state = make({
    1: "mayor",
    2: "chef",
    3: "monk",
    4: "soldier",
    5: "empath",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "poisoner", { targetIds: ["5"] });
  const imp = roleStep(state, "imp");
  const attack = completeStep(state, imp.key, {
    targetIds: ["1"],
    redirectId: "4",
  }) as StepResult;
  assert.equal(attack.ok, true);
  assert.equal(attack.result!.noDeath, true);
  assert.equal(state.players["1"].alive, true, "the Mayor survives a Soldier replacement");
  assert.equal(state.players["4"].alive, true, "the Soldier is safe from the Demon");
});

test("a Mayor redirect to a Monk-protected player kills nobody and keeps the Mayor alive", () => {
  const state = make({
    1: "mayor",
    2: "chef",
    3: "monk",
    4: "soldier",
    5: "empath",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "poisoner", { targetIds: ["4"] });
  completeRole(state, "monk", { targetIds: ["5"] });
  const imp = roleStep(state, "imp");
  const attack = completeStep(state, imp.key, {
    targetIds: ["1"],
    redirectId: "5",
  }) as StepResult;
  assert.equal(attack.ok, true);
  assert.equal(attack.result!.noDeath, true);
  assert.equal(state.players["1"].alive, true, "the Mayor survives");
  assert.equal(state.players["5"].alive, true, "the Monk-protected replacement survives");
});

test("a poisoned Mayor dies to the Demon with no redirection and no host prompt", () => {
  const state = make({
    1: "mayor",
    2: "chef",
    3: "empath",
    4: "poisoner",
    5: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "poisoner", { targetIds: ["1"] });
  const imp = roleStep(state, "imp");
  // The Poisoner's own step must never look like a redirect decision.
  const poisonStep = state.night.queue.find((step) => step.roleId === "poisoner")!;
  assert.equal(
    attackNeedsRedirect(state, {
      attackerId: poisonStep.actorId!,
      targetId: poisonStep.targetIds![0],
    }),
    false,
  );
  assert.equal(attackNeedsRedirect(state, { attackerId: "5", targetId: "1" }), false);
  const attack = completeStep(state, imp.key, { targetIds: ["1"] }) as StepResult;
  assert.equal(attack.ok, true);
  assert.equal(attack.needsRedirect, undefined);
  assert.equal(state.players["1"].alive, false);
  assert.equal(state.deaths.at(-1)!.roleId, "mayor");
  assert.equal(state.deaths.at(-1)!.impaired, true);
});

test("a poisoned Mayor does not win for good at three alive without execution", () => {
  const state = make({
    1: "mayor",
    2: "chef",
    3: "empath",
    4: "poisoner",
    5: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "poisoner", { targetIds: ["1"] });
  skipStep(state, roleStep(state, "imp").key, "test");
  skipNight(state);
  assert.equal(state.phase, "day");
  kill(state, "2", "test", dayAt(state));
  kill(state, "3", "test", dayAt(state));
  endDay(state);
  // Three living, no execution, but the poisoned Mayor has no ability.
  assert.equal(state.winner, null);
});

test("a Monk-protected or Soldier Mayor target never asks for a redirection", () => {
  const state = make({
    1: "mayor",
    2: "chef",
    3: "monk",
    4: "soldier",
    5: "empath",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  assert.equal(attackNeedsRedirect(state, { attackerId: "7", targetId: "1" }), true);
  completeRole(state, "monk", { targetIds: ["1"] });
  assert.equal(attackNeedsRedirect(state, { attackerId: "7", targetId: "1" }), false);
  assert.equal(attackNeedsRedirect(state, { attackerId: "7", targetId: "4" }), false);
  kill(state, "5", "test", dayAt(state));
  assert.equal(attackNeedsRedirect(state, { attackerId: "7", targetId: "5" }), false);
  state.players["1"].alive = false;
  assert.equal(attackNeedsRedirect(state, { attackerId: "7", targetId: "1" }), false);
});

test("a poisoned Demon attacking a healthy Mayor asks for no redirection", () => {
  const state = make({
    1: "mayor",
    2: "chef",
    3: "monk",
    4: "soldier",
    5: "empath",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "poisoner", { targetIds: ["7"] });
  assert.equal(isImpaired(state, "7", { phase: "night", number: 2 }), true);
  assert.equal(attackNeedsRedirect(state, { attackerId: "7", targetId: "1" }), false);
  const attack = completeRole(state, "imp", { targetIds: ["1"] });
  assert.equal(attack.result!.noDeath, true);
  assert.equal(state.players["1"].alive, true);
});

test("a poisoned Scarlet Woman cannot inherit the Demon role", () => {
  const state = make({
    1: "chef",
    2: "empath",
    3: "monk",
    4: "soldier",
    5: "mayor",
    6: "virgin",
    7: "slayer",
    8: "poisoner",
    9: "scarletwoman",
    10: "imp",
  });
  startNight(state);
  completeSystem(state, "minioninfo");
  completeSystem(state, "demoninfo");
  completeRole(state, "poisoner", { targetIds: ["9"] });
  skipNight(state);
  openNominations(state);
  appoint(state, "1", "10", ["1", "2", "3", "4", "5", "6"]);
  execute(state, state.day.nominations[0].id);
  assert.equal(state.players["9"].roleId, "scarletwoman");
  assert.equal(state.winner && state.winner.team, "good");
});

test("Spy and Recluse registrations are explicit host choices (TB-RECLUSE-01, SYS-EFFECTS-02)", () => {
  const state = make({
    1: "recluse",
    2: "imp",
    3: "chef",
    4: "empath",
    5: "monk",
    6: "soldier",
    7: "mayor",
    8: "poisoner",
  });
  assert.equal(chefCount(state, {}), 0);
  assert.equal(chefCount(state, { 1: "evil" }), 2);

  const fortune = make({
    1: "recluse",
    2: "imp",
    3: "chef",
    4: "empath",
    5: "monk",
    6: "soldier",
    7: "mayor",
    8: "poisoner",
  });
  fortune.setup.herringId = "3";
  assert.equal(fortuneTellerYes(fortune, ["1"], {}), false);
  assert.equal(fortuneTellerYes(fortune, ["1"], { 1: "demon" }), true);
});

test("the Chef offers the count for a Recluse registered per pair (TB-CHEF-02)", () => {
  const seats = {
    1: "recluse",
    2: "imp",
    3: "chef",
    4: "empath",
    5: "monk",
    6: "soldier",
    7: "mayor",
    8: "poisoner",
  } as const;
  const state = make(seats);
  startNight(state);
  const info = infoForStep(state, roleStep(state, "chef"), {});

  // Chef r2510, Example 4: the Recluse sits between the Imp and the Poisoner
  // and registers as evil for one adjacent pair, good for the other. The
  // Storyteller may therefore choose 0, 1 or 2 pairs.
  assert.equal(info.kind, "number");
  assert.equal(info.needsChoice, true);
  assert.deepEqual(info.options, [0, 1, 2]);

  const key = roleStep(state, "chef").key;
  const one = completeStep(state, key, { given: { value: 1 } });
  assert.equal(one.ok, true, JSON.stringify(one));
  assert.equal(state.night.queue.find((step) => step.key === key)!.given!.value, 1);

  const illegal = make(seats);
  startNight(illegal);
  const three = completeStep(illegal, roleStep(illegal, "chef").key, { given: { value: 3 } });
  assert.equal(three.ok, false, "a count outside every legal registration is rejected");
});

test("the Chef needs no registration answer without a Spy or Recluse (TB-CHEF-02)", () => {
  const state = make({ 1: "chef", 2: "empath", 3: "monk", 4: "poisoner", 5: "imp" });
  startNight(state);
  const info = infoForStep(state, roleStep(state, "chef"), {});
  assert.equal(info.needsChoice, false);
  assert.equal(info.value, 1, "the Imp and the Poisoner are adjacent");
});

test("Fortune Teller may choose themself and dead players (TB-FORTUNETELLER-01)", () => {
  const state = make({
    1: "fortuneteller",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "soldier",
    6: "poisoner",
    7: "imp",
  });
  state.setup.herringId = "3";
  startNight(state);
  const step = roleStep(state, "fortuneteller");
  assert.equal(step.targetMode, "two");
  const selfAndChef = completeStep(state, step.key, {
    targetIds: ["1", "2"],
  }) as StepResult;
  assert.equal(selfAndChef.ok, true, "selecting themself is allowed");
  assert.equal(selfAndChef.step!.given!.value, false);
  assert.equal(step.impaired, false);
});

test("the Fortune Teller answers yes for a real Demon (TB-FORTUNETELLER-01)", () => {
  const state = make({
    1: "fortuneteller",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "soldier",
    6: "poisoner",
    7: "imp",
  });
  state.setup.herringId = "3";
  startNight(state);
  const result = completeStep(state, roleStep(state, "fortuneteller").key, {
    targetIds: ["6", "7"],
  }) as StepResult;
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.step!.given!.value, true, "the Imp in the pair answers yes");
});

test("the Fortune Teller may be their own red herring", () => {
  const state = make({
    1: "fortuneteller",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "soldier",
    6: "poisoner",
    7: "imp",
  });
  state.setup.herringId = "1";
  assert.equal(
    secretsErrors(state).some((error) => error.code === "herring-self"),
    false,
    "self red herring is a legal setup",
  );
  assert.equal(
    fortuneTellerYes(state, ["1", "2"], {}),
    true,
    "choosing themself reads the herring",
  );
});

test("Fortune Teller may pair a dead player with themself", () => {
  const state = make({
    1: "fortuneteller",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "soldier",
    6: "poisoner",
    7: "imp",
  });
  state.setup.herringId = "3";
  startNight(state);
  kill(state, "2", "test");
  const step = roleStep(state, "fortuneteller");
  const result = completeStep(state, step.key, {
    targetIds: ["1", "2"],
  }) as StepResult;
  assert.equal(result.ok, true);
  assert.equal(result.step!.given!.value, false);
  assert.equal(fortuneTellerYes(state, ["1", "3"], {}), true, "the red herring still answers yes");
});

test("one-of-two setup rejects a pair without the real role", () => {
  const state = make({
    1: "washerwoman",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "undertaker",
    6: "poisoner",
    7: "imp",
  });
  state.setup.info.washerwoman = { roleId: "chef", pair: ["1", "3"], matchIndex: 0 };
  assert.ok(secretsErrors(state).some((error) => error.code === "info-true-washerwoman"));
});

test("an illegal Butler vote is counted and only warned about privately (TB-BUTLER-01)", () => {
  const state = make({
    1: "butler",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "soldier",
    6: "virgin",
    7: "poisoner",
    8: "imp",
  });
  startNight(state);
  completeSystem(state, "minioninfo");
  completeSystem(state, "demoninfo");
  completeRole(state, "poisoner", { targetIds: ["5"] });
  completeRole(state, "chef");
  completeRole(state, "empath");
  completeRole(state, "butler", { targetIds: ["2"] });
  skipNight(state);
  openNominations(state);
  const nomination = appoint(state, "1", "2", ["1"]);
  assert.equal(nomination.count, 1, "the vote that was cast still counts");
  assert.deepEqual(nomination.votes, ["1"]);
  assert.ok(
    nomination.butlerWarning.some((warning) => warning.includes("Дворецкий")),
    "the host still gets a private warning",
  );
});

test("a Butler vote counts normally when the master votes too", () => {
  const state = make({
    1: "butler",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "soldier",
    6: "virgin",
    7: "poisoner",
    8: "imp",
  });
  startNight(state);
  completeSystem(state, "minioninfo");
  completeSystem(state, "demoninfo");
  completeRole(state, "poisoner", { targetIds: ["5"] });
  completeRole(state, "chef");
  completeRole(state, "empath");
  completeRole(state, "butler", { targetIds: ["2"] });
  skipNight(state);
  openNominations(state);
  const nomination = appoint(state, "1", "2", ["1", "2"]);
  assert.equal(nomination.count, 2);
  assert.deepEqual(nomination.votes, ["1", "2"]);
  assert.equal(nomination.butlerWarning.length, 0);
});

test("a player killed before their night wake is skipped (SYS-NIGHT-03)", () => {
  const state = make({
    1: "empath",
    2: "chef",
    3: "monk",
    4: "soldier",
    5: "mayor",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "poisoner", { targetIds: ["5"] });
  completeRole(state, "imp", { targetIds: ["1"] });
  const empath = state.night.queue.find((step) => step.roleId === "empath")!;
  assert.equal(empath.skipped, true);
  assert.notEqual(currentStep(state)?.roleId, "empath");
});

test("a minion promoted to Demon loses their old night step", () => {
  const state = make({
    1: "chef",
    2: "empath",
    3: "monk",
    4: "soldier",
    5: "mayor",
    6: "virgin",
    7: "slayer",
    8: "spy",
    9: "poisoner",
    10: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  const imp = roleStep(state, "imp");
  const attack = completeStep(state, imp.key, { targetIds: ["10"] });
  assert.equal(attack.ok, true);
  assert.ok(state.night.queue.find((step) => step.roleId === "imp")!.pending);
  const heir = chooseDemonHeir(state, imp.key, "8");
  assert.equal(heir.ok, true);
  assert.equal(state.players["8"].roleId, "imp");
  assert.equal(state.night.queue.find((step) => step.roleId === "spy")!.skipped, true);
});

test("the host execution result needs no nomination ledger", () => {
  const state = make({
    1: "chef",
    2: "empath",
    3: "monk",
    4: "soldier",
    5: "mayor",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  const before = state.deaths.length;
  const result = executeByDecision(state, "2");
  assert.equal(result.ok, true);
  assert.equal(state.deaths.length, before + 1);
  assert.equal(state.day.execution!.playerId, "2");
  assert.equal(state.day.execution!.deathId, result.death!.id);
  assert.equal(state.day.ended, true);
  assert.equal(state.winner, null);
});

test("table Virgin control spends a non-triggering nomination without opening a vote ledger", () => {
  const state = make(
    {
      1: "virgin",
      2: "drunk",
      3: "chef",
      4: "empath",
      5: "monk",
      6: "poisoner",
      7: "imp",
      8: "undertaker",
    },
    { drunkShownId: "soldier" },
  );
  toDay(state);
  const result = recordVirginNomination(state, "2", "1");
  assert.equal(result.ok, true);
  assert.equal(state.players["1"].used.virgin, true);
  assert.equal(state.day.execution, null);
  assert.equal(state.day.activeNominationId, null);
  assert.equal(recordVirginNomination(state, "3", "1").ok, false);
  const roundtrip = importGame(exportGame(state));
  const roundtripError = roundtrip.ok ? undefined : roundtrip.error;
  assert.equal(roundtrip.ok, true, roundtripError);
  assert.equal(roundtrip.state.players["1"].used.virgin, true);
});

test("table Virgin control executes a qualifying nominator and persists the death reference", () => {
  const state = make({
    1: "virgin",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "undertaker",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  const result = recordVirginNomination(state, "2", "1");
  assert.equal(result.virgin, true);
  assert.equal(state.day.ended, true);
  assert.equal(state.players["2"].alive, false);
  assert.ok(state.day.execution!.deathId);
  assert.equal(importGame(exportGame(state)).ok, true);
});

test("claim recovery clears only the selected claim and records a reason", () => {
  const state = make({
    1: "virgin",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "undertaker",
    6: "poisoner",
    7: "imp",
  });
  state.players["1"].claimed = true;
  state.players["2"].claimed = true;
  const role = state.players["1"].roleId;
  assert.equal(recoverClaim(state, "1", "Mistaken number").ok, true);
  assert.equal(state.players["1"].claimed, false);
  assert.equal(state.players["1"].name, "");
  assert.equal(state.players["1"].roleId, role);
  assert.equal(state.players["2"].claimed, true);
  assert.equal(state.corrections.at(-1)!.reason, "Mistaken number");
});

test("Librarian learns one of two players is a particular Outsider or that zero are in play", () => {
  const withOutsider = make({
    1: "librarian",
    2: "saint",
    3: "chef",
    4: "empath",
    5: "poisoner",
    6: "imp",
  });
  startNight(withOutsider);
  const info = infoForStep(withOutsider, roleStep(withOutsider, "librarian"), {});
  assert.equal(info.kind, "one-of-two");
  assert.equal(info.roleId, "saint");
  assert.equal(info.pair!.length, 2);
  assert.equal(info.pair!.includes("2"), true);
  assert.equal(info.zero, undefined);
  assert.equal(info.needsChoice, false);
  withOutsider.setup.info.librarian = { zero: true, pair: [] };
  assert.equal(
    secretsErrors(withOutsider).some((error) => error.code === "librarian-zero"),
    true,
    "zero is illegal when an Outsider is in play",
  );

  const zero = make({ 1: "librarian", 2: "chef", 3: "empath", 4: "poisoner", 5: "imp" });
  startNight(zero);
  const zeroInfo = infoForStep(zero, roleStep(zero, "librarian"), {});
  assert.equal(zeroInfo.kind, "one-of-two");
  assert.equal(zeroInfo.zero, true);
  assert.ok(!zeroInfo.needsChoice);
  assert.deepEqual(secretsErrors(zero), []);
});

test("Investigator learns one of two players is a particular Minion (TB-INVESTIGATOR-01)", () => {
  const state = make({
    1: "investigator",
    2: "chef",
    3: "empath",
    4: "saint",
    5: "poisoner",
    6: "imp",
  });
  startNight(state);
  const info = infoForStep(state, roleStep(state, "investigator"), {});
  assert.equal(info.kind, "one-of-two");
  assert.equal(info.roleId, "poisoner");
  assert.equal(info.pair!.length, 2);
  assert.equal(info.pair!.includes("5"), true);
  assert.equal(info.needsChoice, false);
  state.setup.info.investigator = { roleId: "poisoner", pair: ["2", "3"], matchIndex: 0 };
  assert.equal(
    secretsErrors(state).some((error) => error.code === "info-true-investigator"),
    true,
    "a pair without the real Minion is rejected",
  );
});

test("a Librarian impaired with no Outsider in play may give the true zero answer (TB-LIBRARIAN-01)", () => {
  const state = make({ 1: "librarian", 2: "chef", 3: "empath", 4: "poisoner", 5: "imp" });
  startNight(state);
  completeRole(state, "poisoner", { targetIds: ["1"] });
  const step = roleStep(state, "librarian");
  const info = infoForStep(state, step, {});
  assert.equal(info.impaired, true);
  assert.equal(info.needsChoice, true);
  assert.equal(info.zero, true, "zero are in play, so the true answer is legal");
  assert.ok(info.options!.includes("zero"), "the zero answer is offered");
  assert.equal(
    info
      .options!.filter((id) => id !== "zero")
      .every((id) => roleTeam(id as string) === "outsider"),
    true,
    "the other answers are Outsider roles",
  );
  assert.equal(info.pair!.length, 2);
  assert.equal(info.pair!.includes("1"), false);
  const zero = completeStep(state, step.key, { given: { ...info, zero: true, roleId: null } });
  assert.equal(zero.ok, true, JSON.stringify(zero));
  const recorded = state.night.queue.find((candidate) => candidate.roleId === "librarian")!.given!;
  assert.equal(recorded.zero, true);
  assert.equal(recorded.roleId, null);

  const contradictoryState = make({
    1: "librarian",
    2: "chef",
    3: "empath",
    4: "poisoner",
    5: "imp",
  });
  startNight(contradictoryState);
  completeRole(contradictoryState, "poisoner", { targetIds: ["1"] });
  const contradictoryStep = roleStep(contradictoryState, "librarian");
  const contradictory = completeStep(contradictoryState, contradictoryStep.key, {
    given: { ...info, zero: true, roleId: "saint" },
  });
  assert.equal(contradictory.ok, false, "zero plus a role is contradictory");
  assert.equal("errorCode" in contradictory ? contradictory.errorCode : null, "error.66");

  const falseRoleState = make({
    1: "librarian",
    2: "chef",
    3: "empath",
    4: "poisoner",
    5: "imp",
  });
  startNight(falseRoleState);
  completeRole(falseRoleState, "poisoner", { targetIds: ["1"] });
  const falseRoleStep = roleStep(falseRoleState, "librarian");
  const falseRoleInfo = infoForStep(falseRoleState, falseRoleStep, {});
  const falseRole = completeStep(falseRoleState, falseRoleStep.key, {
    given: { ...falseRoleInfo, zero: false, roleId: "saint" },
  });
  assert.equal(falseRole.ok, true, JSON.stringify(falseRole));
  const falseRecorded = falseRoleState.night.queue.find(
    (candidate) => candidate.roleId === "librarian",
  )!.given!;
  assert.equal(falseRecorded.zero, false);
  assert.equal(falseRecorded.roleId, "saint");
});

test("a paired impaired Librarian rejects the zero answer (TB-LIBRARIAN-01)", () => {
  const state = make({
    1: "librarian",
    2: "saint",
    3: "chef",
    4: "empath",
    5: "poisoner",
    6: "imp",
  });
  startNight(state);
  completeRole(state, "poisoner", { targetIds: ["1"] });
  const step = roleStep(state, "librarian");
  const info = infoForStep(state, step, {});
  assert.equal(info.impaired, true);
  assert.equal(info.zero, undefined, "an Outsider is in play, so zero is not a legal true answer");
  assert.equal(info.options!.includes("zero"), false);
  const rejected = completeStep(state, step.key, { given: { ...info, zero: true, roleId: null } });
  assert.equal(rejected.ok, false);
  assert.equal("errorCode" in rejected ? rejected.errorCode : null, "error.66");
});

test("a Recluse registers as evil, a Minion or a Demon and a Spy as good, a Townsfolk or an Outsider even when dead (TB-RECLUSE-02, TB-SPY-01)", () => {
  const state = make({
    1: "recluse",
    2: "spy",
    3: "chef",
    4: "empath",
    5: "monk",
    6: "imp",
  });
  kill(state, "1", "demon");
  kill(state, "2", "demon");
  const recluse = state.players["1"];
  const spy = state.players["2"];
  assert.equal(recluse.alive, false);
  assert.equal(spy.alive, false);

  assert.equal(alignmentOf(state, recluse, {}), "good");
  assert.equal(alignmentOf(state, recluse, { 1: "evil" }), "evil");
  assert.equal(registersAsMinion(state, recluse, { 1: "minion" }), true);
  assert.equal(registersAsDemon(state, recluse, { 1: "demon" }), true);
  assert.equal(registersAsDemon(state, recluse, { 1: "evil" }), false);
  assert.equal(registersAsDemon(state, recluse, {}), false);
  assert.equal(registersAsMinion(state, recluse, {}), false);

  assert.equal(alignmentOf(state, spy, {}), "evil");
  assert.equal(alignmentOf(state, spy, { 2: "good" }), "good");
  assert.equal(registersAsTownsfolk(state, spy, { 2: "townsfolk" }), true);
  assert.equal(registersAsOutsider(state, spy, { 2: "outsider" }), true);
  assert.equal(registersAsTownsfolk(state, spy, {}), false);
  assert.equal(registersAsOutsider(state, spy, {}), false);
});

test("a poisoned Saint executed by the town does not lose the game for good (TB-SAINT-02)", () => {
  const state = make({
    1: "saint",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "poisoner",
    6: "imp",
  });
  startNight(state);
  completeRole(state, "poisoner", { targetIds: ["1"] });
  skipNight(state);
  openNominations(state);
  const nomination = nominate(state, "2", "1").nomination!;
  assert.equal(recordVotes(state, nomination.id, ["2", "3", "4"]).ok, true);
  const result = execute(state, nomination.id);
  assert.equal(result.ok, true, JSON.stringify(result));
  const death = state.deaths.find((candidate) => candidate.playerId === "1");
  assert.ok(death);
  assert.equal(death.impaired, true);
  assert.equal(state.winner, null);
});

test("the Spy sees the grimoire on their night step and may register as good, a Townsfolk or an Outsider", () => {
  const state = make({
    1: "spy",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "saint",
    6: "imp",
  });
  startNight(state);
  const step = roleStep(state, "spy");
  assert.ok(step);
  assert.equal(step.infoKind, "grimoire");
  const info = infoForStep(state, step, {});
  assert.equal(info.kind, "grimoire");
  assert.equal(registersAsTownsfolk(state, state.players["1"], { 1: "townsfolk" }), true);
  assert.equal(registersAsOutsider(state, state.players["1"], { 1: "outsider" }), true);
  assert.equal(alignmentOf(state, state.players["1"], { 1: "good" }), "good");
});

test("Trouble Brewing uses the official first-night and other-night order", () => {
  assert.deepEqual(NIGHT_FIRST, [
    "minioninfo",
    "demoninfo",
    "poisoner",
    "washerwoman",
    "librarian",
    "investigator",
    "chef",
    "empath",
    "fortuneteller",
    "butler",
    "spy",
  ]);
  assert.deepEqual(NIGHT_OTHER, [
    "poisoner",
    "monk",
    "scarletwoman",
    "imp",
    "ravenkeeper",
    "empath",
    "fortuneteller",
    "undertaker",
    "butler",
    "spy",
  ]);

  const state = make({
    1: "washerwoman",
    2: "librarian",
    3: "investigator",
    4: "chef",
    5: "empath",
    6: "fortuneteller",
    7: "undertaker",
    8: "ravenkeeper",
    9: "monk",
    10: "saint",
    11: "recluse",
    12: "poisoner",
    13: "spy",
    14: "scarletwoman",
    15: "imp",
  });
  startNight(state);
  assert.deepEqual(
    state.night.queue.map((step) => step.system || step.roleId),
    [
      "minioninfo",
      "demoninfo",
      "poisoner",
      "washerwoman",
      "librarian",
      "investigator",
      "chef",
      "empath",
      "fortuneteller",
      "spy",
    ],
    "the queue matches the official first-night sequence",
  );
  assert.equal(
    state.night.queue.at(-1)!.roleId,
    "spy",
    "the Spy wakes last and sees the final grimoire",
  );
});

test("every Trouble Brewing first-night information role offers allowed false information while impaired (SYS-EFFECTS-01, TB-EMPATH-03)", () => {
  const state = make({
    1: "washerwoman",
    2: "librarian",
    3: "investigator",
    4: "chef",
    5: "empath",
    6: "fortuneteller",
    7: "undertaker",
    8: "ravenkeeper",
    9: "monk",
    10: "saint",
    11: "recluse",
    12: "poisoner",
    13: "spy",
    14: "scarletwoman",
    15: "imp",
  });
  startNight(state);
  const source = state.players["12"];
  for (const targetId of ["1", "2", "3", "4", "5", "6"]) {
    state.effects.push({
      id: "test-poison-" + targetId,
      kind: "poison",
      sourceId: source.id,
      targetId,
      start: { phase: "night", number: 1 },
      expires: { phase: "night", number: 2 },
      active: true,
    });
  }
  assert.equal(isImpaired(state, "1", { phase: "night", number: 1 }), true);

  const expected = {
    washerwoman: "townsfolk",
    librarian: "outsider",
    investigator: "minion",
  };
  for (const [roleId, team] of Object.entries(expected)) {
    const info = infoForStep(state, roleStep(state, roleId), {});
    assert.equal(info.impaired, true, roleId);
    assert.equal(info.needsChoice, true, roleId);
    assert.ok(info.options!.length > 0, roleId);
    assert.equal(
      info.options!.every((id) => roleTeam(id as string) === team),
      true,
      roleId,
    );
  }

  const chef = infoForStep(state, roleStep(state, "chef"), {});
  assert.equal(chef.needsChoice, true);
  assert.equal(chef.options![0], 0);
  assert.equal(chef.options!.includes(chef.value), true, "the true count is an allowed answer");

  const empath = infoForStep(state, roleStep(state, "empath"), {});
  assert.equal(empath.needsChoice, true);
  assert.deepEqual(empath.options, [0, 1, 2]);

  const fortune = infoForStep(state, roleStep(state, "fortuneteller"), {});
  assert.equal(fortune.needsChoice, true);
  assert.deepEqual(fortune.options, [true, false]);
});

test("the Empath counts the nearest living neighbours and follows their deaths (TB-EMPATH-01)", () => {
  const state = make({ 1: "chef", 2: "empath", 3: "monk", 4: "poisoner", 5: "imp" }, { count: 5 });
  startNight(state);
  const empath = roleStep(state, "empath");
  assert.equal(infoForStep(state, empath, {}).value, 0, "seat 1 and seat 3 are good");

  state.players["1"].alive = false;
  assert.equal(
    infoForStep(state, empath, {}).value,
    1,
    "the dead seat 1 gives way to the evil Imp at seat 5",
  );

  state.players["3"].alive = false;
  assert.equal(
    infoForStep(state, empath, {}).value,
    2,
    "both nearest living neighbours, the Poisoner and the Imp, are evil",
  );
});

test("the Empath counts the host's Spy and Recluse registration (TB-EMPATH-02)", () => {
  const state = make(
    {
      1: "spy",
      2: "empath",
      3: "recluse",
      4: "chef",
      5: "monk",
      6: "soldier",
      7: "undertaker",
      8: "saint",
      9: "imp",
    },
    { count: 9 },
  );
  startNight(state);
  const empath = roleStep(state, "empath");
  assert.equal(infoForStep(state, empath, {}).value, 1, "the Spy is evil; the Recluse is good");
  assert.equal(
    infoForStep(state, empath, { registrations: { "1": "good" } }).value,
    0,
    "a Spy registered as good is not counted",
  );
  assert.equal(
    infoForStep(state, empath, { registrations: { "3": "evil" } }).value,
    2,
    "a Recluse registered as evil is counted",
  );
});

test("an impaired Undertaker collects an execution today and then offers any character", () => {
  const state = make({
    1: "undertaker",
    2: "chef",
    3: "empath",
    4: "saint",
    5: "poisoner",
    6: "imp",
  });
  startNight(state);
  skipNight(state);
  openNominations(state);
  const nomination = nominate(state, "2", "3").nomination!;
  assert.equal(recordVotes(state, nomination.id, ["2", "3", "4"]).ok, true);
  assert.equal(execute(state, nomination.id).ok, true);
  assert.equal(endDay(state).ok, true);
  assert.equal(state.night.number, 2);
  completeRole(state, "poisoner", { targetIds: ["1"] });
  const step = roleStep(state, "undertaker");
  assert.ok(step, "the Undertaker wakes after an execution death");
  const info = infoForStep(state, step, {});
  assert.equal(info.impaired, true);
  assert.equal(info.needsChoice, true);
  assert.equal(info.options!.length, ALL_ROLES.length);
  assert.equal(info.options!.includes("imp"), true);
});

test("an impaired Ravenkeeper killed tonight offers any character for the false answer", () => {
  const state = make({
    1: "ravenkeeper",
    2: "chef",
    3: "empath",
    4: "saint",
    5: "poisoner",
    6: "imp",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  assert.equal(state.night.number, 2);
  state.effects.push({
    id: "test-poison-1",
    kind: "poison",
    sourceId: "5",
    targetId: "1",
    start: { phase: "night", number: 2 },
    expires: { phase: "night", number: 3 },
    active: true,
  });
  const attack = completeStep(state, roleStep(state, "imp").key, { targetIds: ["1"] });
  assert.equal(attack.ok, true, JSON.stringify(attack));
  const step = roleStep(state, "ravenkeeper");
  assert.ok(step, "the Ravenkeeper wakes after dying tonight");
  const info = infoForStep(state, step, { targetIds: ["2"] });
  assert.equal(info.impaired, true);
  assert.equal(info.needsChoice, true);
  assert.equal(info.options!.length, ALL_ROLES.length);
});

test("a living player may nominate only once per day and a player may be nominated only once per day (SYS-VOTES-01)", () => {
  const state = make({
    1: "chef",
    2: "empath",
    3: "monk",
    4: "saint",
    5: "poisoner",
    6: "imp",
  });
  toDay(state);
  openNominations(state);
  const first = nominate(state, "1", "2");
  assert.equal(first.ok, true);
  assert.equal(nominate(state, "1", "3").errorCode, "error.10");
  assert.equal(recordVotes(state, first.nomination!.id, ["1"]).ok, true);
  assert.equal(nominate(state, "1", "3").errorCode, "error.13");
  assert.equal(nominate(state, "3", "2").errorCode, "error.14");
  kill(state, "4", "manual");
  assert.equal(nominate(state, "4", "5").errorCode, "error.11");
});

test("a Trouble Brewing game runs from deal through a night and a day at every player count from five to fifteen", () => {
  for (let count = 5; count <= 15; count += 1) {
    const bag = presetBag("tb", count, 0);
    assert.ok(bag && bag.valid, "preset " + count);
    const state = createGame(count);
    state.setup.roles = bag.roles.slice();
    state.setup.bluffs = bag.bluffs.slice();
    state.setup.drunkShownId = bag.drunkShownId;
    const dealt = dealGame(state);
    assert.equal(dealt.ok, true, count + ": " + JSON.stringify(dealt));
    autoSecrets(state);
    assert.deepEqual(secretsErrors(state), [], String(count));
    assert.equal(startNight(state).ok, true, "night starts at " + count);

    for (let guard = 0; guard < 40; guard += 1) {
      const step = currentStep(state);
      if (!step) break;
      if (step.kind === "system") {
        assert.equal(completeStep(state, step.key, {}).ok, true, step.system);
        continue;
      }
      const living = state.order.filter((id) => state.players[id].alive);
      const options: { targetIds?: string[]; given?: InfoResult } = {};
      if (step.targetMode === "one-any" || step.targetMode === "one-other") {
        options.targetIds = [living.find((id) => id !== step.actorId) || living[0]];
      } else if (step.targetMode === "two") {
        options.targetIds = living.filter((id) => id !== step.actorId).slice(0, 2);
      }
      const info = infoForStep(state, step, options);
      if (info.needsChoice) options.given = info;
      const done = completeStep(state, step.key, options);
      assert.equal(
        done.ok,
        true,
        count + " " + (step.roleId || step.system) + ": " + JSON.stringify(done),
      );
    }
    assert.equal(endNight(state).ok, true, "night ends at " + count);

    openNominations(state);
    const nominee = state.order
      .map((id) => state.players[id])
      .find((player) =>
        [
          "chef",
          "empath",
          "fortuneteller",
          "undertaker",
          "monk",
          "soldier",
          "butler",
          "librarian",
          "investigator",
        ].includes(player.roleId!),
      )!;
    const nominator = state.order.find((id) => id !== nominee.id)!;
    const nomination = nominate(state, nominator, nominee.id).nomination!;
    const living = state.order.filter((id) => state.players[id].alive);
    assert.equal(recordVotes(state, nomination.id, living).ok, true, "votes at " + count);
    assert.equal(execute(state, nomination.id).ok, true, "execution at " + count);
    assert.equal(state.winner, null, "the Demon survives the first execution at " + count);
    assert.equal(endDay(state).ok, true, "the day ends at " + count);
    assert.equal(state.phase, "night");
    assert.equal(state.night.number, 2);
    assert.equal(state.day.number, 2);
  }
});

test("a sober Spy registered as a Townsfolk triggers the Virgin (TB-VIRGIN-01, TB-SPY-01)", () => {
  const state = make({
    1: "virgin",
    2: "spy",
    3: "chef",
    4: "empath",
    5: "mayor",
    6: "slayer",
    7: "imp",
  });
  toDay(state);
  openNominations(state);
  const nomination = nominate(state, "2", "1", { spyRegistersTownsfolk: true });
  assert.equal(nomination.ok, true, JSON.stringify(nomination));
  assert.equal(Boolean(nomination.virgin), true, "the registered Townsfolk Spy triggers");
  assert.equal(state.players["2"].alive, false, "the Spy is executed at once");
  assert.equal(state.players["1"].used.virgin, true);
});

test("a sober Slayer kills a Recluse registered as the Demon (TB-SLAYER-01, TB-RECLUSE-02)", () => {
  const state = make(
    {
      1: "slayer",
      2: "recluse",
      3: "chef",
      4: "empath",
      5: "mayor",
      6: "monk",
      7: "saint",
      8: "imp",
      9: "spy",
    },
    { count: 9 },
  );
  toDay(state);
  const slayer = useSlayer(state, "1", "2", { recluseRegistersDemon: true });
  assert.equal(slayer.ok, true);
  assert.equal(slayer.hit, true, "the Recluse registers as the Demon");
  assert.equal(state.players["2"].alive, false);
});

test("a drunk or poisoned Spy or Recluse registration never applies to an ability (TB-RECLUSE-01, TB-SPY-01)", () => {
  const spyState = make({
    1: "virgin",
    2: "spy",
    3: "chef",
    4: "empath",
    5: "mayor",
    6: "slayer",
    7: "imp",
  });
  toDay(spyState);
  spyState.effects.push({
    id: "poison-spy",
    kind: "poison",
    sourceId: "3",
    targetId: "2",
    start: { phase: "night", number: 1 },
    expires: { phase: "night", number: 2 },
    active: true,
  });
  assert.equal(isImpaired(spyState, "2", dayAt(spyState)), true);
  assert.ok(
    registrationError(spyState, { 2: "townsfolk" }),
    "an impaired registrant cannot record a registration",
  );
  assert.equal(alignmentOf(spyState, spyState.players["2"], { 2: "good" }), "evil");
  assert.equal(registersAsTownsfolk(spyState, spyState.players["2"], { 2: "townsfolk" }), false);
  openNominations(spyState);
  const nomination = nominate(spyState, "2", "1", { spyRegistersTownsfolk: true });
  assert.equal(nomination.ok, true, JSON.stringify(nomination));
  assert.equal(Boolean(nomination.virgin), false, "the impaired Spy does not trigger the Virgin");
  assert.equal(spyState.players["1"].used.virgin, true);
  assert.equal(spyState.players["2"].alive, true);

  const recluseState = make({
    1: "slayer",
    2: "recluse",
    3: "chef",
    4: "empath",
    5: "mayor",
    6: "monk",
    7: "saint",
    8: "imp",
    9: "spy",
  });
  toDay(recluseState);
  recluseState.effects.push({
    id: "poison-recluse",
    kind: "poison",
    sourceId: "3",
    targetId: "2",
    start: { phase: "night", number: 1 },
    expires: { phase: "night", number: 2 },
    active: true,
  });
  assert.equal(isImpaired(recluseState, "2", dayAt(recluseState)), true);
  assert.equal(registersAsDemon(recluseState, recluseState.players["2"], { 2: "demon" }), false);
  recluseState.setup.herringId = "5";
  assert.equal(fortuneTellerYes(recluseState, ["2"], { 2: "demon" }), false);
  const slayer = useSlayer(recluseState, "1", "2", { recluseRegistersDemon: true });
  assert.equal(slayer.ok, true);
  assert.equal(slayer.hit, false, "the impaired Recluse does not register as the Demon");
  assert.equal(recluseState.players["2"].alive, true);
});

test("a Poisoner who becomes the Imp ends the poison it sourced (TB-POISONER-01)", () => {
  const state = make({
    1: "poisoner",
    2: "mayor",
    3: "chef",
    4: "imp",
    5: "empath",
    6: "monk",
    7: "soldier",
  });
  toDay(state);
  assert.equal(endDay(state).ok, true);
  completeRole(state, "poisoner", { targetIds: ["2"] });
  assert.equal(isImpaired(state, "2"), true, "the Mayor is poisoned tonight");
  const imp = roleStep(state, "imp");
  const attack = completeStep(state, imp.key, { targetIds: [imp.actorId!] });
  assert.equal(attack.ok, true, JSON.stringify(attack));
  assert.equal(state.players["1"].roleId, "imp", "the Poisoner inherited the Demon role");
  assert.equal(isImpaired(state, "2"), false, "the poison ended with the role change");
  assert.ok(
    state.effects
      .filter((effect) => effect.kind === "poison")
      .every((effect) => effect.active === false),
  );
});

test("a Mayor redirect onto the Imp is not the Imp's self-kill (TB-MAYOR-01)", () => {
  const state = make({
    1: "mayor",
    2: "chef",
    3: "scarletwoman",
    4: "imp",
    5: "empath",
  });
  toDay(state);
  kill(state, "5", "test", dayAt(state));
  assert.equal(endDay(state).ok, true);
  const imp = roleStep(state, "imp");
  const prompt = completeStep(state, imp.key, { targetIds: ["1"] }) as StepResult;
  assert.equal(prompt.ok, false);
  assert.equal(prompt.needsRedirect, true);
  const attack = completeStep(state, imp.key, {
    targetIds: ["1"],
    redirectId: "4",
  }) as StepResult;
  assert.equal(attack.ok, true, JSON.stringify(attack));
  assert.equal(attack.result!.redirected, true);
  assert.equal(state.players["4"].alive, false, "the redirected Imp dies");
  assert.equal(state.deaths.at(-1)!.cause, "demon", "the redirected death is a normal Demon death");
  assert.equal(state.players["3"].roleId, "scarletwoman", "below five living, nobody inherits");
  assert.equal(state.winner?.team, "good");
  assert.equal(state.winner?.reason, "demon-dead");
  const redirectChoice = state.log.find((entry) => entry.case === "mayor-redirect");
  assert.ok(redirectChoice, "the redirect is recorded in the secret journal");
});

test("the Virgin's first nomination is recorded after a day execution (TB-VIRGIN-01)", () => {
  const state = make({
    1: "virgin",
    2: "butler",
    3: "chef",
    4: "empath",
    5: "monk",
    6: "poisoner",
    7: "imp",
    8: "soldier",
  });
  toDay(state);
  const executed = executeByDecision(state, "3") as { ok: boolean };
  assert.equal(executed.ok, true, JSON.stringify(executed));
  assert.ok(state.day.execution, "the day already carries an execution");
  const recorded = recordVirginNomination(state, "2", "1");
  assert.equal(recorded.ok, true, JSON.stringify(recorded));
  assert.equal(state.players["1"].used.virgin, true, "the first nomination spends the ability");
  assert.equal(state.day.nominations.length, 1);
  assert.equal(state.day.nominations[0]!.recorded, true);
});

test("an impaired Virgin's first nomination still spends the ability", () => {
  const state = make({
    1: "virgin",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "soldier",
    6: "poisoner",
    7: "imp",
  });
  toDay(state);
  state.effects.push({
    id: "poison-virgin",
    kind: "poison",
    sourceId: "6",
    targetId: "1",
    start: { phase: "night", number: 1 },
    expires: { phase: "night", number: 2 },
    active: true,
  });
  openNominations(state);
  const result = nominate(state, "2", "1");
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(Boolean(result.virgin), false);
  assert.equal(state.players["1"].used.virgin, true);
  assert.equal(state.players["2"].alive, true);
});

test("official execution of a dead player records an event without another death", () => {
  const state = make({ 1: "chef", 2: "empath", 3: "monk", 4: "poisoner", 5: "imp" });
  toDay(state);
  kill(state, "2", "test", dayAt(state));
  const deaths = state.deaths.length;
  const result = executeByDecision(state, "2");
  assert.equal(result.ok, true);
  assert.equal(result.death, null);
  assert.equal(state.deaths.length, deaths);
  assert.equal(state.day.execution?.playerId, "2");
  assert.equal(state.day.execution?.deathId, null);
  assert.equal(state.executions.at(-1)?.playerId, "2");
  assert.equal(state.day.ended, true);
  assert.equal(executeByDecision(state, "3").ok, false);
});

test("official execution without a death blocks the Mayor win at day end", () => {
  const state = make({ 1: "mayor", 2: "chef", 3: "monk", 4: "poisoner", 5: "imp" });
  toDay(state);
  kill(state, "2", "test", dayAt(state));
  kill(state, "3", "test", dayAt(state));
  openNominations(state);
  const nomination = appoint(state, "1", "2", ["1", "4"]);
  assert.equal(execute(state, nomination.id).ok, true);
  assert.equal(state.day.execution?.deathId, null);
  assert.equal(endDay(state).ok, true);
  assert.equal(state.winner, null);
  assert.equal(state.phase, "night");
});

test("official execution without a death satisfies the Vortox execution condition", () => {
  const state = makeSnv({ 1: "clockmaker", 6: "witch", 7: "vortox" }, { count: 7 });
  state.phase = "day";
  state.day.number = 1;
  kill(state, "1", "test", dayAt(state));
  openNominations(state);
  const nomination = appoint(state, "2", "1", ["2", "3", "4"]);
  const result = execute(state, nomination.id);
  assert.equal(result.ok, true);
  assert.equal(state.day.execution?.deathId, null);
  assert.equal(endDay(state).ok, true);
  assert.equal(state.winner, null);
  assert.equal(state.phase, "night");
});

test("a host execution of a dead player still closes the day", () => {
  const state = make({
    1: "mayor",
    2: "chef",
    3: "monk",
    4: "poisoner",
    5: "imp",
  });
  toDay(state);
  kill(state, "2", "test", dayAt(state));
  kill(state, "3", "test", dayAt(state));
  const result = executeByDecision(state, "2");
  assert.equal(result.ok, true);
  assert.equal(state.day.execution?.playerId, "2");
  assert.equal(state.day.execution?.deathId, null);
  assert.equal(state.day.ended, true);
});

test("the Saint loss is scoped to the day of the execution (TB-SAINT-01)", () => {
  const state = make({
    1: "saint",
    2: "chef",
    3: "empath",
    4: "monk",
    5: "soldier",
    6: "poisoner",
    7: "imp",
    8: "virgin",
  });
  toDay(state);
  openNominations(state);
  appoint(state, "2", "1", ["1", "2", "3", "4"]);
  execute(state, state.day.nominations[0]!.id);
  assert.equal(state.winner?.reason, "saint");
  state.winner = null;
  state.phase = "day";
  state.day = {
    number: 2,
    morning: [],
    nominations: [],
    activeNominationId: null,
    execution: null,
    ended: false,
    open: false,
  };
  assert.equal(checkWin(state), null, "yesterday's Saint execution does not re-fire");
});

test("startNight rejects the day phase", () => {
  const state = make({
    1: "chef",
    2: "empath",
    3: "monk",
    4: "saint",
    5: "poisoner",
    6: "imp",
  });
  toDay(state);
  const result = startNight(state);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "error.68");
  assert.equal(state.phase, "day");
});

test("a sober Sailor survives execution and only a bypassing kill lands (BMR-SAILOR-01)", () => {
  const state = makeBmr(
    {
      1: "sailor",
      2: "chambermaid",
      3: "courtier",
      4: "gossip",
      5: "fool",
      6: "assassin",
      7: "po",
    },
    { count: 8 },
  );
  state.phase = "day";
  state.day = {
    number: 1,
    morning: [],
    nominations: [],
    activeNominationId: null,
    execution: null,
    ended: false,
    open: true,
  };
  const executed = executeByDecision(state, "1") as { ok: boolean; death?: unknown };
  assert.equal(executed.ok, true, JSON.stringify(executed));
  assert.equal(executed.death ?? null, null);
  assert.equal(state.players["1"].alive, true, "the Sailor is executed but remains alive");
  const bypass = kill(
    state,
    "1",
    "demon",
    { phase: "night", number: 1 },
    { bypassProtection: true },
  );
  assert.ok(bypass, "the Assassin's bypass still kills the Sailor");
  assert.equal(state.players["1"].alive, false);
});

test("the Zombuul's first death is recorded and keeps it from waking that night (BMR-ZOMBUUL-01)", () => {
  const state = makeBmr(
    {
      1: "chambermaid",
      2: "courtier",
      3: "sailor",
      4: "gossip",
      5: "devilsadvocate",
      6: "zombuul",
      7: "fool",
    },
    { count: 8 },
  );
  state.phase = "day";
  state.day = {
    number: 1,
    morning: [],
    nominations: [],
    activeNominationId: null,
    execution: null,
    ended: false,
    open: true,
  };
  const executed = executeByDecision(state, "6") as { ok: boolean };
  assert.equal(executed.ok, true);
  assert.equal(state.players["6"].alive, true);
  assert.equal(state.players["6"].registeredDead, true);
  const death = state.deaths.find((entry) => entry.playerId === "6");
  assert.ok(death, "the replaced death is recorded for the day");
  assert.equal(death!.cause, "execution");
  assert.equal(death!.number, 1);
  assert.equal(endDay(state).ok, true);
  assert.equal(state.night.number, 2);
  assert.equal(
    state.night.queue.some((step) => step.roleId === "zombuul"),
    false,
    "the Zombuul does not wake after the day it registered dead",
  );
});

test("the Fool is not spent when Tea Lady or Innkeeper protection prevents the death (BMR-FOOL-01)", () => {
  const tea = makeBmr(
    {
      1: "fool",
      2: "tealady",
      3: "chambermaid",
      4: "courtier",
      5: "gossip",
      6: "assassin",
      7: "po",
    },
    { count: 8 },
  );
  const at = { phase: "night" as const, number: 1 };
  assert.equal(kill(tea, "1", "demon", at), null);
  assert.equal(tea.players["1"].used.fool, undefined, "the Tea Lady was the reason");
  assert.equal(tea.players["1"].alive, true);

  const inn = makeBmr(
    {
      1: "fool",
      2: "chambermaid",
      3: "courtier",
      4: "gossip",
      5: "devilsadvocate",
      6: "po",
    },
    { count: 8 },
  );
  inn.effects.push({
    id: "innkeeper-protect",
    kind: "protected",
    bmr: "innkeeper",
    sourceId: "2",
    targetId: "1",
    start: at,
    active: true,
  });
  assert.equal(kill(inn, "1", "demon", at), null);
  assert.equal(inn.players["1"].used.fool, undefined, "the Innkeeper was the reason");
  assert.equal(inn.players["1"].alive, true);
});

function rejectionCode(result: unknown): string | undefined {
  return (result as { errorCode?: string }).errorCode;
}

test("Bad Moon Rising target modes reject dead, self and invalid targets (BMR-DEVILSADVOCATE-02)", () => {
  const state = makeBmr(
    {
      1: "chambermaid",
      2: "courtier",
      3: "sailor",
      4: "gossip",
      5: "devilsadvocate",
      6: "po",
    },
    { count: 8 },
  );
  startNight(state);
  kill(state, "7", "test", { phase: "night", number: 1 });
  const sailor = roleStep(state, "sailor");
  const deadSailor = completeStep(state, sailor.key, { targetIds: ["7"] });
  assert.equal(deadSailor.ok, false);
  assert.equal(rejectionCode(deadSailor), "error.55");
  assert.equal(
    completeStep(state, sailor.key, { targetIds: ["3"], drunkId: "3" }).ok,
    true,
    "the Sailor may choose themself",
  );

  const advocate = roleStep(state, "devilsadvocate");
  const deadAdvocate = completeStep(state, advocate.key, { targetIds: ["7"] });
  assert.equal(deadAdvocate.ok, false);
  assert.equal(rejectionCode(deadAdvocate), "error.55");

  const maid = roleStep(state, "chambermaid");
  const selfMaid = completeStep(state, maid.key, { targetIds: ["1", "2"] });
  assert.equal(selfMaid.ok, false);
  assert.equal(rejectionCode(selfMaid), "error.40");
  const deadMaid = completeStep(state, maid.key, { targetIds: ["7", "2"] });
  assert.equal(deadMaid.ok, false);
  assert.equal(rejectionCode(deadMaid), "error.55");
});

test("a registered-dead Zombuul is not a Tea Lady neighbour but still counts as alive (BMR-TEALADY-01, BMR-ZOMBUUL-01)", () => {
  const state = makeBmr(
    {
      1: "zombuul",
      2: "tealady",
      3: "chambermaid",
      4: "courtier",
      5: "assassin",
    },
    { count: 8 },
  );
  state.players["1"].registeredDead = true;
  const at = { phase: "night" as const, number: 1 };
  assert.equal(
    kill(state, "3", "demon", at),
    null,
    "the Tea Lady protects her real living neighbours",
  );
  assert.equal(state.players["3"].alive, true);
  assert.equal(state.players["1"].alive, true, "the Zombuul itself stays alive");
  assert.equal(livingPlayers(state).length, 8, "the game's alive count keeps the real state");
});

test("a registered-dead player does not count toward the Scarlet Woman's five (TB-SCARLETWOMAN-01)", () => {
  const state = make({
    1: "scarletwoman",
    2: "imp",
    3: "chef",
    4: "empath",
    5: "monk",
  });
  // A player other abilities see as dead (the Zombuul's registered-dead state).
  state.players["3"].registeredDead = true;
  state.phase = "day";
  state.day = {
    number: 1,
    morning: [],
    nominations: [],
    activeNominationId: null,
    execution: null,
    ended: false,
    open: true,
  };
  const executed = executeByDecision(state, "2") as { ok: boolean };
  assert.equal(executed.ok, true);
  assert.equal(state.players["2"].alive, false, "the Imp dies");
  assert.equal(
    state.players["1"].roleId,
    "scarletwoman",
    "five real living but four registered alive is below the threshold",
  );
  assert.equal(state.winner?.team, "good");
});

test("the Pacifist survival flag is legal only for a good target with a sober Pacifist (BMR-PACIFIST-01)", () => {
  const dayState = () => {
    const state = makeBmr(
      {
        1: "pacifist",
        2: "chambermaid",
        3: "courtier",
        4: "gossip",
        5: "assassin",
        6: "po",
      },
      { count: 8 },
    );
    state.phase = "day";
    state.day = {
      number: 1,
      morning: [],
      nominations: [],
      activeNominationId: null,
      execution: null,
      ended: false,
      open: true,
    };
    return state;
  };

  const evil = dayState();
  const evilResult = executeByDecision(evil, "6", { survives: true }) as {
    ok: boolean;
    errorCode?: string;
  };
  assert.equal(evilResult.ok, false);
  assert.equal(evilResult.errorCode, "error.57");
  assert.equal(evil.players["6"].alive, true);
  assert.equal(evil.day.execution, null);

  const good = dayState();
  const goodResult = executeByDecision(good, "2", { survives: true });
  assert.equal(goodResult.ok, true, JSON.stringify(goodResult));
  assert.equal(good.players["2"].alive, true);

  const poisoned = dayState();
  poisoned.effects.push({
    id: "poison-pacifist",
    kind: "poison",
    sourceId: "5",
    targetId: "1",
    start: { phase: "night", number: 1 },
    expires: { phase: "night", number: 2 },
    active: true,
  });
  const impaired = executeByDecision(poisoned, "2", { survives: true }) as {
    ok: boolean;
    errorCode?: string;
  };
  assert.equal(impaired.ok, false);
  assert.equal(impaired.errorCode, "error.57");

  const noPacifist = makeBmr(
    { 1: "fool", 2: "chambermaid", 3: "courtier", 4: "gossip", 5: "assassin", 6: "po" },
    { count: 8 },
  );
  noPacifist.phase = "day";
  noPacifist.day = {
    number: 1,
    morning: [],
    nominations: [],
    activeNominationId: null,
    execution: null,
    ended: false,
    open: true,
  };
  const foolResult = executeByDecision(noPacifist, "1", { survives: true }) as {
    ok: boolean;
    errorCode?: string;
  };
  assert.equal(foolResult.ok, false, "without a Pacifist the flag cannot spare a role");
  assert.equal(foolResult.errorCode, "error.57");
  assert.equal(noPacifist.players["1"].used.fool, undefined, "the Fool's ability is not spent");
  assert.equal(noPacifist.players["1"].alive, true);
});

test("a protected Tinker does not die from their ability (BMR-TINKER-01)", () => {
  const state = makeBmr(
    {
      1: "tinker",
      2: "tealady",
      3: "sailor",
      4: "gossip",
      5: "assassin",
      6: "po",
    },
    { count: 8 },
  );
  toDay(state);
  assert.equal(
    applyCommand(state, {
      id: "tinker-protected",
      type: "tinkerDeath",
      payload: { playerId: "1" },
    }).status,
    "allowed",
  );
  assert.equal(state.players["1"].alive, true, "the Tea Lady protects the Tinker");
  assert.equal(
    state.deaths.some((death) => death.playerId === "1"),
    false,
  );

  state.effects.push({
    id: "tinker-tea-poison",
    kind: "poison",
    sourceId: "5",
    targetId: "2",
    start: { phase: "day", number: 1 },
    expires: null,
    active: true,
  });
  assert.equal(
    applyCommand(state, {
      id: "tinker-unprotected",
      type: "tinkerDeath",
      payload: { playerId: "1" },
    }).status,
    "allowed",
  );
  assert.equal(state.players["1"].alive, false, "a poisoned Tea Lady protects nobody");
});

test("a sober Tinker dies from an ability death during the day and the night (BMR-TINKER-01)", () => {
  const state = makeBmr(
    {
      1: "tinker",
      2: "chambermaid",
      3: "courtier",
      4: "gossip",
      5: "assassin",
      6: "po",
    },
    { count: 8 },
  );
  toDay(state);
  const result = applyCommand(state, {
    id: "tinker-day",
    type: "tinkerDeath",
    payload: { playerId: "1" },
  });
  assert.equal(result.status, "allowed", JSON.stringify(result));
  assert.equal(state.players["1"].alive, false);
  const death = state.deaths.at(-1)!;
  assert.equal(death.playerId, "1");
  assert.equal(death.cause, "ability");
  assert.equal(death.bmr, "tinker");

  const night = makeBmr(
    { 1: "tinker", 2: "chambermaid", 3: "courtier", 4: "gossip", 5: "assassin", 6: "po" },
    { count: 8 },
  );
  assert.equal(startNight(night).ok, true);
  const nightResult = applyCommand(night, {
    id: "tinker-night",
    type: "tinkerDeath",
    payload: { playerId: "1" },
  });
  assert.equal(nightResult.status, "allowed", JSON.stringify(nightResult));
  assert.equal(night.players["1"].alive, false);

  const other = makeBmr(
    { 1: "chambermaid", 2: "tinker", 3: "courtier", 4: "gossip", 5: "assassin", 6: "po" },
    { count: 8 },
  );
  assert.equal(startNight(other).ok, true);
  const wrong = applyCommand(other, {
    id: "tinker-wrong",
    type: "tinkerDeath",
    payload: { playerId: "1" },
  });
  assert.equal(wrong.status, "rejected");
  assert.equal(wrong.errorCode, "error.58");
});

test("the Klutz public choice runs through the command surface", () => {
  const state = makeSnv({ 1: "klutz", 2: "clockmaker", 3: "witch", 7: "fanggu" }, { count: 7 });
  state.players["1"].alive = false;
  const result = applyCommand(state, {
    id: "klutz-choice",
    type: "recordKlutzChoice",
    payload: { targetId: "2" },
  });
  assert.equal(result.status, "allowed", JSON.stringify(result));
  assert.equal(state.players["1"].used.klutz, true);
  assert.equal(state.players["1"].used.klutzTarget, "2");
  const missing = applyCommand(state, {
    id: "klutz-missing",
    type: "recordKlutzChoice",
    payload: {},
  });
  assert.equal(missing.status, "rejected");
});

test("a Juggler with zero guesses still answers on the night after their first day", () => {
  const state = makeSnv({ 1: "juggler", 2: "clockmaker", 3: "witch", 7: "fanggu" }, { count: 7 });
  toDay(state);
  const empty = applyCommand(state, {
    id: "juggler-empty",
    type: "jugglerGuess",
    payload: { guesses: [] },
  });
  assert.equal(empty.status, "allowed", JSON.stringify(empty));
  assert.equal(state.juggler?.day, 1);
  assert.deepEqual(state.juggler?.guesses, []);
  assert.equal(endDay(state).ok, true);
  assert.equal(state.phase, "night");
  const step = state.night.queue.find((candidate) => candidate.roleId === "juggler");
  assert.ok(step, "the Juggler answers on the night after their first day");
  const info = infoForStep(state, step);
  assert.equal(info.kind, "number");
  assert.equal(info.value, 0);

  const noGuesses = makeSnv(
    { 1: "juggler", 2: "clockmaker", 3: "witch", 7: "fanggu" },
    { count: 7 },
  );
  toDay(noGuesses);
  assert.equal(endDay(noGuesses).ok, true);
  assert.deepEqual(noGuesses.juggler, { day: 1, guesses: [] });
  const zeroStep = noGuesses.night.queue.find((candidate) => candidate.roleId === "juggler");
  assert.ok(zeroStep, "a Juggler who never guessed still wakes");
});

test("a nomination execution of the Demon arms the Mastermind", () => {
  const state = makeBmr(
    {
      1: "mastermind",
      2: "sailor",
      3: "chambermaid",
      4: "exorcist",
      5: "pacifist",
      6: "innkeeper",
      7: "tinker",
      8: "po",
    },
    { count: 8 },
  );
  startNight(state);
  skipNight(state);
  openNominations(state);
  const nomination = nominate(state, "2", "8").nomination!;
  assert.equal(recordVotes(state, nomination.id, ["2", "3", "4", "5"]).ok, true);
  const result = execute(state, nomination.id);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(state.winner, null, "the Mastermind suppresses the Demon-dead win");
  assert.equal(state.mastermind?.active, true, "the Mastermind arms the extra day");
});
