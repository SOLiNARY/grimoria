import type { DeadAt, GameState, NightStep, RoleId } from "../model/types.ts";
import { playerById } from "../model/state.ts";
import type { AbilityDecision, RoleEffect } from "../roles/ability.ts";
import type { RoleModule } from "../roles/types.ts";
import { setStepNote } from "./context.ts";
import { kill } from "./death.ts";
import { isImpaired } from "./effects.ts";

/**
 * Runs one module-declared ability and applies its intents through the shared
 * mechanics. The module receives read-only facts, so it cannot write state.
 * A step without an actor, or a module without an ability, does nothing.
 */
export function applyRoleAbility(
  state: GameState,
  module: RoleModule,
  step: NightStep,
  targets: readonly string[],
  at: DeadAt,
  chosenRoleId: RoleId | null,
): void {
  const ability = module.ability;
  const actorId = step.actorId;
  if (!ability || !actorId) return;
  const decision = ability.resolve({
    actorId,
    targetIds: targets,
    chosenRoleId,
    impaired: isImpaired(state, actorId, at),
    actualRoleOf: (playerId) => playerById(state, playerId)?.roleId ?? null,
    hasPlayer: (playerId) => playerById(state, playerId) != null,
  });
  applyDecision(state, module, step, decision, at);
}

function applyDecision(
  state: GameState,
  module: RoleModule,
  step: NightStep,
  decision: AbilityDecision,
  at: DeadAt,
): void {
  if (decision.kind === "suppressed") {
    setStepNote(
      step,
      "note.abilityFailed",
      null,
      "Способность не сработала: игрок отравлен или пьян.",
    );
    return;
  }
  if (decision.kind !== "effects") return;
  for (const effect of decision.effects) applyEffect(state, module, effect, at);
}

function applyEffect(state: GameState, module: RoleModule, effect: RoleEffect, at: DeadAt): void {
  // The ability name and the edition marker are engine bookkeeping, so they
  // come from the module, not from the role's intent.
  kill(
    state,
    effect.playerId,
    "ability",
    at,
    module.edition === "bmr" ? { ability: module.id, bmr: true } : { ability: module.id },
  );
}
