import type { DeadAt, GameState, InfoPair, NightStep, Player, RoleId } from "../model/types.ts";

type Registrations = Record<string, string>;
type InfoOptions = { targetIds?: string[]; registrations?: Registrations };
/** What a night step hands the Storyteller: computed, chosen or missing. */
export type InfoResult = {
  kind: string;
  value?: unknown;
  roleId?: RoleId | null;
  pair?: string[];
  matchIndex?: number;
  impaired?: boolean;
  needsChoice?: boolean;
  options?: unknown[];
  text?: string;
  /** Catalog key for `text`; the stored Russian sentence stays the fallback. */
  textKey?: string;
  textVars?: Record<string, string | number | undefined>;
  /** Runs of false information end with the shared Storyteller suffix. */
  falsifiedSuffix?: boolean;
  /** An impaired actor may receive false or true information; not mandatory. */
  mayBeFalseSuffix?: boolean;
  missing?: boolean;
  /** The host answers because the data source is missing, not because the answer is false. */
  hostAnswer?: boolean;
  zero?: boolean;
  bluffs?: string[];
  demonId?: string | null;
  lunaticId?: string | null;
  playerId?: string | null;
};

// Trouble Brewing domain: information. No DOM or persistence.
import { ALL_ROLES, roleTeam } from "../model/rules.ts";
import { orderedPlayers, playerById, realTeamOf, executionDeathForDay } from "../model/state.ts";

import { nightAt, aliveNeighbors } from "./context.ts";
import { isImpaired } from "./effects.ts";
import { informationOf, nightStepFor } from "../roles/night-step.ts";
import { roleModule } from "../roles/registry.ts";
import type { RoleModule } from "../roles/types.ts";
import type { InformationContext } from "../roles/ability.ts";
import { resolveInformationCapability } from "./ability.ts";
import { bmrInfoForStep } from "./bmr.ts";
import type { CommandExecutionContext } from "../model/ports.ts";
import { systemPorts } from "../model/ports.ts";
import { svInfoForStep } from "./sv.ts";

// Registration is an ability (Spy r3118, Recluse r3007): a drunk or poisoned
// registrant has no ability, so the override never reaches an information path.
function registrationApplies(state: GameState, player: Player | null): boolean {
  return player ? !isImpaired(state, player.id) : false;
}

export function alignmentOf(
  state: GameState,
  player: Player | null,
  registrations: Registrations = {},
): "good" | "evil" | null {
  if (!player) return null;
  const override = registrationApplies(state, player) ? registrations[player.id] : undefined;
  if (override === "good" || override === "evil") return override;
  return realTeamOf(player) === "evil" ? "evil" : "good";
}

export function registersAsDemon(
  state: GameState,
  player: Player | null,
  registrations: Registrations = {},
): boolean {
  if (!player) return false;
  if (roleTeam(player.roleId || "") === "demon") return true;
  if (player.roleId === "recluse") {
    return registrationApplies(state, player) && registrations[player.id] === "demon";
  }
  return false;
}

export function registersAsTownsfolk(
  state: GameState,
  player: Player | null,
  registrations: Registrations = {},
): boolean {
  if (!player) return false;
  if (roleTeam(player.roleId || "") === "townsfolk") return true;
  return (
    player.roleId === "spy" &&
    registrationApplies(state, player) &&
    registrations[player.id] === "townsfolk"
  );
}

export function registersAsMinion(
  state: GameState,
  player: Player | null,
  registrations: Registrations = {},
): boolean {
  if (!player) return false;
  if (roleTeam(player.roleId || "") === "minion") return true;
  return (
    player.roleId === "recluse" &&
    registrationApplies(state, player) &&
    registrations[player.id] === "minion"
  );
}

export function registersAsOutsider(
  state: GameState,
  player: Player | null,
  registrations: Registrations = {},
): boolean {
  if (!player) return false;
  if (roleTeam(player.roleId || "") === "outsider") return true;
  return (
    player.roleId === "spy" &&
    registrationApplies(state, player) &&
    registrations[player.id] === "outsider"
  );
}

/**
 * The number of evil pairs a Chef would be shown under these registrations.
 * The rule is the role module's; this query hands it the engine's facts
 * outside a night step.
 */
export function chefCount(state: GameState, registrations: Registrations = {}): number {
  const module = roleModule("chef");
  const information = informationOf(module);
  if (!module || !information) return 0;
  const decision = resolveInformationCapability(
    module,
    informationFacts(state, {
      actorId: "",
      infoKind: information.infoKind,
      targetIds: [],
      registrations,
      impaired: false,
      at: nightAt(state),
    }),
  );
  return decision?.kind === "answer" && typeof decision.value === "number" ? decision.value : 0;
}

/**
 * Whether a Fortune Teller who chose these players hears yes. The rule is the
 * role module's; this query hands it the engine's facts outside a night step.
 */
export function fortuneTellerYes(
  state: GameState,
  targetIds: string[] | undefined,
  registrations: Registrations = {},
): boolean {
  const module = roleModule("fortuneteller");
  const information = informationOf(module);
  if (!module || !information) return false;
  const decision = resolveInformationCapability(
    module,
    informationFacts(state, {
      actorId: "",
      infoKind: information.infoKind,
      targetIds: targetIds || [],
      registrations,
      impaired: false,
      at: nightAt(state),
    }),
  );
  return decision?.kind === "answer" && decision.value === true;
}

export function characterChoices(
  state: GameState,
  targetId: string,
  actorImpaired: boolean = false,
): RoleId[] {
  if (actorImpaired) return ALL_ROLES.slice();
  const player = playerById(state, targetId);
  if (!player) return [];
  // A drunk or poisoned Spy or Recluse has no registration to show.
  if (isImpaired(state, targetId)) return [player.roleId as RoleId];
  if (player.roleId === "recluse") {
    return [player.roleId].concat(
      ALL_ROLES.filter((id) => roleTeam(id) === "minion" || roleTeam(id) === "demon"),
    );
  }
  if (player.roleId === "spy") {
    return [player.roleId].concat(
      ALL_ROLES.filter((id) => roleTeam(id) === "townsfolk" || roleTeam(id) === "outsider"),
    );
  }
  return [player.roleId as RoleId];
}

// ---------------------------------------------------------------------------
// Night queue

/** The read-only facts an information capability resolves from. */
function informationFacts(
  state: GameState,
  query: {
    actorId: string;
    infoKind: string;
    targetIds: readonly string[];
    registrations: Registrations;
    impaired: boolean;
    at: DeadAt;
  },
): InformationContext {
  const { registrations } = query;
  return {
    actorId: query.actorId,
    infoKind: query.infoKind,
    targetIds: query.targetIds,
    impaired: query.impaired,
    at: query.at,
    seatIds: state.order.slice(),
    aliveNeighborIds: (playerId) => aliveNeighbors(state, playerId),
    registeredTeamOf: (playerId) => alignmentOf(state, playerById(state, playerId), registrations),
    // Recluse r3007 and Spy r3118: a sober and healthy Recluse might register
    // as evil and a sober and healthy Spy as good, whatever the host has
    // chosen for this step so far.
    mayRegisterAs: (playerId, team) => {
      const player = playerById(state, playerId);
      if (alignmentOf(state, player) === team) return true;
      return Boolean(
        player &&
        player.roleId === (team === "evil" ? "recluse" : "spy") &&
        registrationApplies(state, player),
      );
    },
    registersAsDemon: (playerId) =>
      registersAsDemon(state, playerById(state, playerId), registrations),
    // The setup secret first, then the top-level field, as before the move.
    redHerringId:
      (state.setup && state.setup.herringId ? state.setup.herringId : state.herringId) ?? null,
    actualRoleOf: (playerId) => playerById(state, playerId)?.roleId ?? null,
    hasPlayer: (playerId) => playerById(state, playerId) != null,
  };
}

/**
 * The answer of a role module that owns its information. Null means the module
 * declares none and the engine keeps its own path.
 *
 * The role says what its ability learns and which answers exist. Whether the
 * ability works is the engine's fact: an impaired owner gets the host's answer
 * from the values the role says are possible, and the true one stays among
 * them (Drunk r3165: the information may be false).
 */
export function moduleInfoForStep(
  state: GameState,
  module: RoleModule | null | undefined,
  step: NightStep,
  options: InfoOptions = {},
): InfoResult | null {
  const information = informationOf(module);
  if (!module || !information) return null;
  const actor = step.actorId ? playerById(state, step.actorId) : null;
  const at = nightAt(state);
  const impaired = actor ? isImpaired(state, actor.id, at) : false;
  const decision = resolveInformationCapability(
    module,
    informationFacts(state, {
      actorId: actor ? actor.id : "",
      infoKind: information.infoKind,
      targetIds: options.targetIds || step.targetIds || [],
      registrations: options.registrations || step.registrations || {},
      impaired,
      at,
    }),
  );
  if (decision?.kind !== "answer") return { kind: "none" };
  // A working ability whose answer depends on a registration is the host's
  // choice among the legal values; an impaired one among every possible value.
  const legal = decision.legal ?? [];
  const registrationChoice = !impaired && legal.length > 1;
  return {
    kind: nightStepFor(module, at.number)?.infoKind ?? "none",
    value: decision.value,
    impaired,
    needsChoice: impaired || registrationChoice,
    options: impaired ? [...(decision.possible ?? [])] : registrationChoice ? [...legal] : [],
  };
}

export function infoForStep(
  state: GameState,
  step: NightStep,
  options: InfoOptions = {},
  ports: CommandExecutionContext = systemPorts,
): InfoResult {
  if (step.bmr) return bmrInfoForStep(state, step, options, ports);
  if (step.sv) return svInfoForStep(state, step, options);
  const actor = step.actorId ? playerById(state, step.actorId) : null;
  const at = nightAt(state);
  const impaired = actor ? isImpaired(state, actor.id, at) : false;
  const role = step.roleId;

  if (step.kind === "system") {
    if (step.system === "demoninfo") {
      return {
        kind: "demon-info",
        bluffs: step.bluffs || [],
        lunaticId: (step.lunaticId as string | null | undefined) ?? null,
      };
    }
    if (step.system === "minioninfo") {
      return { kind: "minion-info", demonId: step.demonId ?? null };
    }
    return { kind: "note", text: step.note || "" };
  }

  // A role that owns its answer never falls through to the branches below.
  const owned = moduleInfoForStep(state, role ? roleModule(role) : null, step, options);
  if (owned) return owned;

  if (role === "washerwoman" || role === "librarian" || role === "investigator") {
    const setup = state.setup.info[role];
    if (!setup) {
      if (actor && actor.roleId === "drunk") {
        const team =
          role === "washerwoman" ? "townsfolk" : role === "librarian" ? "outsider" : "minion";
        const options = ALL_ROLES.filter((id) => roleTeam(id) === team);
        const others = orderedPlayers(state)
          .filter((player) => player.id !== actor.id)
          .map((player) => player.id);
        return {
          kind: "one-of-two",
          missing: false,
          roleId: options[0] || null,
          pair: others.slice(0, 2),
          matchIndex: 0,
          impaired: true,
          needsChoice: true,
          options,
          text: "Пьяница: предложена ложная информация.",
        };
      }
      return { kind: "one-of-two", missing: true, needsChoice: true };
    }
    if ("zero" in setup && setup.zero) {
      if (impaired) {
        const options = ALL_ROLES.filter((id) => roleTeam(id) === "outsider");
        const others = orderedPlayers(state)
          .filter((player) => !actor || player.id !== actor.id)
          .map((player) => player.id);
        return {
          kind: "one-of-two",
          zero: true,
          roleId: options[0] || null,
          pair: others.slice(0, 2),
          matchIndex: 0,
          impaired,
          needsChoice: true,
          // The true zero answer stays legal: a drunk or poisoned player may
          // still receive true information (Drunk r3165 "may give false").
          options: [...options, "zero"],
          text: "Игрок отравлен или пьян: можно показать ложную пару или верный ответ «нет Изгоев».",
        };
      }
      return { kind: "one-of-two", zero: true, text: "В игре нет Изгоев." };
    }
    const pairInfo = setup as InfoPair;
    if (!pairInfo.roleId || !Array.isArray(pairInfo.pair) || pairInfo.pair.length !== 2) {
      return { kind: "one-of-two", missing: true, needsChoice: true };
    }
    return {
      kind: "one-of-two",
      roleId: pairInfo.roleId,
      pair: pairInfo.pair.slice(),
      matchIndex: pairInfo.matchIndex || 0,
      impaired,
      needsChoice: impaired,
      options: impaired
        ? ALL_ROLES.filter(
            (id) =>
              roleTeam(id) ===
              (role === "washerwoman" ? "townsfolk" : role === "librarian" ? "outsider" : "minion"),
          )
        : [],
    };
  }

  if (role === "undertaker") {
    const death = executionDeathForDay(state, nightAt(state).number - 1);
    if (!death) return { kind: "none", text: "Сегодня казни со смертью не было." };
    const choices = characterChoices(state, death.playerId, impaired);
    return {
      kind: "character",
      roleId: death.roleId,
      playerId: death.playerId,
      impaired,
      needsChoice: impaired || choices.length > 1,
      options: choices,
    };
  }

  if (role === "spy") {
    return { kind: "grimoire" };
  }

  if (role === "ravenkeeper") {
    const targetId = (options.targetIds || step.targetIds || [])[0];
    const target = targetId ? playerById(state, targetId) : null;
    if (!target)
      return { kind: "character", roleId: null, needsChoice: true, options: ALL_ROLES.slice() };
    const choices = characterChoices(state, target.id, impaired);
    return {
      kind: "character",
      roleId: target.roleId,
      playerId: target.id,
      impaired,
      needsChoice: impaired || choices.length > 1,
      options: choices,
    };
  }

  return { kind: "none" };
}

// ---------------------------------------------------------------------------
// Death, inheritance and win
