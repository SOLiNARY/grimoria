import type { DeadAt, GameState, NightStep, RoleId } from "../model/types.ts";
import { livingPlayers, playerById, registersAlive, seatName } from "../model/state.ts";
import { roleTeam } from "../model/rules.ts";
import type {
  AbilityDecision,
  DayContext,
  DayDecision,
  PendingDeathFact,
  RoleEffect,
  TimedEffectKind,
  TransformationContext,
  TransformationDecision,
  InformationContext,
  InformationDecision,
  ExecutionContext,
  ExecutionDecision,
} from "../roles/ability.ts";
import { nightArmFor } from "../roles/night-step.ts";
import type { RoleModule } from "../roles/types.ts";
import { setStepNote } from "./context.ts";
import { idSuffix, systemPorts } from "../model/ports.ts";
import type { CommandExecutionContext } from "../model/ports.ts";
import { checkWin, kill, resolveAttack, resolveDemonDeath } from "./death.ts";
import { givenBy, isImpaired, SAFE_EFFECT, SURVIVES_EXECUTION_EFFECT } from "./effects.ts";
import { keepDemonAsleep } from "./bmr.ts";
import { delayPukkaDeath, poisonPukkaPlayer, pukkaPendings, resolvePukkaDeath } from "./pukka.ts";

/** The host's answers for one step. The command path has validated them. */
export interface HostAnswers {
  /** The character answer: the Courtier's character or the Gambler's guess. */
  readonly chosenRoleId?: RoleId | null;
  /** The Mayor's redirect for an attack: a seat, "none", or absent while unanswered. */
  readonly redirectId?: string | null;
  /** Who the ability makes drunk: the Sailor's or the Innkeeper's answer. */
  readonly drunkId?: string | null;
}

/** What the shared attack path returned for one attack. */
export type AttackResult = ReturnType<typeof resolveAttack>;

/** What the caller still owes a step once its ability is resolved. */
export type AbilityOutcome =
  /** The decision was applied. The step finishes through the shared path. */
  | { readonly kind: "applied" }
  /** Nothing was applied: the host owes the redirect of an attack on the Mayor. */
  | { readonly kind: "needs-redirect"; readonly options: NonNullable<AttackResult["options"]> }
  /** An attack was resolved. The step keeps the attack's own record. */
  | { readonly kind: "attack"; readonly title: string; readonly attack: AttackResult };

const APPLIED: AbilityOutcome = { kind: "applied" };

/**
 * Runs the resolver a module declares for this night's step and applies its
 * decision through the shared mechanics. The module receives read-only facts,
 * so it cannot write state. A step without an actor, or a module without a
 * resolver for this night, does nothing. The outcome tells the caller how the
 * step completes.
 */
export function applyRoleAbility(
  state: GameState,
  module: RoleModule,
  step: NightStep,
  targets: readonly string[],
  at: DeadAt,
  answers: HostAnswers = {},
  ports: CommandExecutionContext = systemPorts,
): AbilityOutcome {
  const arm = nightArmFor(module, at.number);
  const resolve = arm?.resolve;
  const actorId = step.actorId;
  if (!resolve || !actorId) return APPLIED;
  // Tonight's choice replaces the last one also when the ability fails, so
  // the old effects end first and the owner's health is read after.
  for (const kind of arm.endsOnUse ?? []) endOwnEffects(state, actorId, kind);
  const decision = resolve({
    actorId,
    targetIds: targets,
    chosenRoleId: answers.chosenRoleId ?? null,
    drunkId: answers.drunkId ?? null,
    impaired: isImpaired(state, actorId, at),
    at: { phase: "night", number: at.number },
    pendings: pukkaPendings(state, actorId).map((effect): PendingDeathFact => ({
      id: effect.id,
      playerId: effect.targetId == null ? null : String(effect.targetId),
      suspended: Boolean(effect.suspended),
      resumeOnHealthy: effect.resumeOnHealthy === true,
      resolveAtNight: effect.resolve ? Number(effect.resolve.number) : null,
    })),
    actualRoleOf: (playerId) => playerById(state, playerId)?.roleId ?? null,
    hasPlayer: (playerId) => playerById(state, playerId) != null,
    nameOf: (playerId) => seatName(state, playerId),
  });
  return applyDecision(
    state,
    module,
    step,
    decision,
    at,
    actorId,
    answers.redirectId ?? null,
    ports,
  );
}

function applyDecision(
  state: GameState,
  module: RoleModule,
  step: NightStep,
  decision: AbilityDecision,
  at: DeadAt,
  actorId: string,
  redirectId: string | null,
  ports: CommandExecutionContext,
): AbilityOutcome {
  if (decision.kind === "no-effect") return APPLIED;
  if (decision.kind === "attack") {
    // The attacker is the acting seat and the redirect is the host's answer:
    // neither comes from the role. An attack that still needs the redirect
    // returns before anything is written, so the step waits untouched.
    const attack = resolveAttack(
      state,
      { attackerId: actorId, targetId: decision.playerId, at, redirectId },
      ports,
    );
    if (attack.needsRedirect) return { kind: "needs-redirect", options: attack.options };
    return { kind: "attack", title: decision.title, attack };
  }
  if (decision.kind === "suppressed") {
    for (const effect of decision.effects || []) {
      applyEffect(state, module, step, effect, at, actorId, ports, true);
    }
    setStepNote(
      step,
      decision.noteKey || "note.abilityFailed",
      null,
      decision.text || "Способность не сработала: игрок отравлен или пьян.",
    );
    if (decision.result) step.result = { ...decision.result };
    return APPLIED;
  }
  const resolved = [];
  for (const effect of decision.effects) {
    const outcome = applyEffect(state, module, step, effect, at, actorId, ports);
    if (outcome) resolved.push(outcome);
  }
  if (decision.note) {
    setStepNote(step, decision.note.key, decision.note.vars || null, decision.note.text);
  }
  if (decision.result) {
    const result: Record<string, unknown> = { ...decision.result };
    if (resolved.length) {
      const last = resolved.at(-1);
      if (last && typeof last === "object" && "death" in last) {
        result.deaths = last.death ? [last.death] : [];
        result.resolved = last;
      }
    }
    step.result = result;
  }
  return APPLIED;
}

/** How a dated effect is stored, where an engine reader expects its own shape. */
interface StoredShape {
  readonly kind: string;
  readonly bmr?: string;
  /** The effect names the day it covers: the day after the night it starts. */
  readonly withDay?: boolean;
}

/** How a dated effect is stored: under its own kind, except where a reader expects another. */
function storedShape(kind: TimedEffectKind): StoredShape {
  if (kind === "safe") return SAFE_EFFECT;
  if (kind === "survives-execution") return SURVIVES_EXECUTION_EFFECT;
  return { kind };
}

/** Ends the dated effects of one kind that the acting seat's ability gave. */
function endOwnEffects(state: GameState, actorId: string, kind: TimedEffectKind): void {
  const stored = storedShape(kind).kind;
  for (const candidate of state.effects) {
    if (candidate.kind === stored && givenBy(candidate, actorId)) candidate.active = false;
  }
}

/**
 * Applies one intent. `wasted` is the suppressed path: the ability did
 * nothing, so a dated effect stays as a record that never applies.
 */
function applyEffect(
  state: GameState,
  module: RoleModule,
  step: NightStep,
  effect: RoleEffect,
  at: DeadAt,
  actorId: string,
  ports: CommandExecutionContext,
  wasted = false,
): unknown {
  switch (effect.kind) {
    case "kill":
      // The ability name and the edition marker are engine bookkeeping, so
      // they come from the module, not from the role's intent.
      kill(
        state,
        effect.playerId,
        effect.cause || "ability",
        at,
        module.edition === "bmr" ? { ability: module.id, bmr: true } : { ability: module.id },
        ports,
      );
      return null;
    case "poison":
      return poisonPukkaPlayer(state, actorId, effect.playerId, at);
    case "delay-death":
      return delayPukkaDeath(state, actorId, effect.playerId, at, effect.resolveAtNight);
    case "suspend-death": {
      const pending = state.effects.find((candidate) => candidate.id === effect.pendingId);
      if (!pending) return null;
      pending.suspended = effect.reason;
      if (effect.resumeOnHealthy !== undefined) pending.resumeOnHealthy = effect.resumeOnHealthy;
      return null;
    }
    case "release-poisons":
      for (const candidate of state.effects) {
        if (candidate.kind !== "poison" || candidate.pukka !== true) continue;
        if (candidate.sourceId !== actorId) continue;
        if (candidate.targetId === effect.keepPlayerId) continue;
        candidate.active = false;
      }
      return null;
    case "resolve-death": {
      const pending = state.effects.find((candidate) => candidate.id === effect.pendingId) || null;
      return resolvePukkaDeath(state, pending, at, {}, ports);
    }
    case "timed-effect": {
      // The source, the start and the id are engine bookkeeping: the id comes
      // from the command ports, so a role cannot choose it.
      if (effect.replacesPrevious && !wasted) endOwnEffects(state, actorId, effect.effect);
      const stored = storedShape(effect.effect);
      state.effects.push({
        id: "eff-" + (state.effects.length + 1) + "-" + idSuffix(ports, 4),
        kind: stored.kind,
        ...(stored.bmr ? { bmr: stored.bmr } : {}),
        sourceId: actorId,
        targetId: effect.playerId,
        start: at,
        ...(stored.withDay ? { day: at.number } : {}),
        expires: { phase: effect.expires.phase, number: effect.expires.number },
        // A wasted use has no effect later (States r1039): the record stays
        // inactive even after its owner recovers.
        active: !wasted,
      });
      return null;
    }
    case "record-master": {
      const actor = playerById(state, actorId);
      if (actor) actor.butlerMasterId = effect.playerId;
      return null;
    }
    case "record-choice": {
      // The record is the step builder's: it names the role by its module, so
      // a role cannot write another role's restriction.
      const actor = playerById(state, actorId);
      if (!actor) return null;
      actor.used = actor.used || {};
      actor.used[module.id + "Target"] = effect.playerId;
      actor.used[module.id + "TargetNight"] = effect.playerId ? at.number : null;
      return null;
    }
    case "record-no-one": {
      const actor = playerById(state, actorId);
      if (!actor) return null;
      actor.used = actor.used || {};
      actor.used[module.id + "NoOne"] = effect.noOne;
      return null;
    }
    case "record-choices": {
      // Last night's choice moves aside before tonight's is written, in this
      // key order, because saved games hold the record as it was written.
      const actor = playerById(state, actorId);
      if (!actor) return null;
      const used = (actor.used = actor.used || {});
      const current = used[module.id + "Targets"];
      used[module.id + "PreviousTargets"] = Array.isArray(current) ? current.slice() : [];
      used[module.id + "PreviousNight"] = used[module.id + "TargetsNight"];
      used[module.id + "Targets"] = effect.playerIds.slice();
      used[module.id + "TargetsNight"] = at.number;
      return null;
    }
    case "madness": {
      // A failed ability makes nobody mad, so nothing is kept as a record.
      if (wasted) return null;
      // The id, the source, the start and the ability that owns the token
      // are engine bookkeeping. The key order is the stored token's.
      state.effects.push({
        id: "eff-madness-" + module.id + "-" + actorId + "-" + effect.playerId + "-" + at.number,
        kind: "madness",
        madness: module.id,
        roleId: effect.roleId,
        sourceId: actorId,
        targetId: effect.playerId,
        start: at,
        expires: { phase: effect.expires.phase, number: effect.expires.number },
        active: true,
      });
      return null;
    }
    case "block-demon": {
      const demon = playerById(state, effect.playerId);
      if (demon) keepDemonAsleep(state, step, demon, effect.note, effect.log, at, ports);
      return null;
    }
  }
}

/**
 * Runs a module's transformation capability for one cause. The caller applies
 * the returned decision through the shared character-change path.
 */
export function resolveTransformationCapability(
  module: RoleModule,
  context: TransformationContext,
): TransformationDecision | null {
  const capability = (module.capabilities || []).find(
    (candidate): candidate is Extract<typeof candidate, { kind: "transformation" }> =>
      candidate.kind === "transformation" && candidate.cause === context.cause,
  );
  return capability ? capability.resolve(context) : null;
}

/** Runs a module's information capability for one info kind. */
export function resolveInformationCapability(
  module: RoleModule,
  context: InformationContext,
): InformationDecision | null {
  const capability = (module.capabilities || []).find(
    (candidate): candidate is Extract<typeof candidate, { kind: "information" }> =>
      candidate.kind === "information" && candidate.infoKind === context.infoKind,
  );
  return capability ? capability.resolve(context) : null;
}

/** Runs a module's execution contribution for one executed player. */
export function resolveExecutionCapability(
  module: RoleModule,
  context: ExecutionContext,
): ExecutionDecision | null {
  const capability = (module.capabilities || []).find(
    (candidate): candidate is Extract<typeof candidate, { kind: "execution" }> =>
      candidate.kind === "execution",
  );
  return capability ? capability.resolve(context) : null;
}

export function applyDayCapability(
  state: GameState,
  module: RoleModule,
  context: DayContext,
  ports: CommandExecutionContext = systemPorts,
): { handled: boolean; result?: Readonly<Record<string, unknown>> } {
  const capability = (module.capabilities || []).find(
    (candidate): candidate is Extract<typeof candidate, { kind: "day-action" }> =>
      candidate.kind === "day-action" && candidate.action === context.action,
  );
  if (!capability) return { handled: false };

  const decision: DayDecision = capability.resolve(context);
  if (decision.kind === "no-effect") return { handled: true, result: { hit: false } };
  if (decision.kind === "record") return { handled: true, result: decision.result };

  const result: Record<string, unknown> = {};
  for (const effect of decision.effects) {
    if (effect.kind !== "kill") continue;
    const target = playerById(state, effect.playerId);
    const livingBefore = livingPlayers(state).filter(registersAlive).length;
    const cause = effect.cause || "ability";
    const death = kill(state, effect.playerId, cause, context.at, {}, ports);
    let inheritance = null;
    if (death && effect.succession && target && roleTeam(target.roleId || "") === "demon") {
      inheritance = resolveDemonDeath(
        state,
        {
          playerId: effect.playerId,
          roleId: target.roleId,
          cause,
          livingBefore,
          at: context.at,
        },
        ports,
      );
    }
    if (effect.succession) checkWin(state, {}, ports);
    result.hit = true;
    result.death = death;
    result.inheritance = inheritance;
  }
  return { handled: true, result };
}
