import type { RoleId } from "../model/types.ts";

/**
 * The facts one ability may read. The game state is not reachable, so a role
 * cannot write unrelated state, set a winner or bypass a shared invariant.
 */
export interface AbilityContext {
  /** The seat taking the step. */
  readonly actorId: string;
  /** Targets the command path already validated, in the host's order. */
  readonly targetIds: readonly string[];
  /** The host's character answer for the step: the Courtier's character or the Gambler's guess. */
  readonly chosenRoleId: RoleId | null;
  /** True when the effect graph says the actor is drunk or poisoned now. */
  readonly impaired: boolean;
  /** The character on a seat; never a registration, a bluff or a shown mask. */
  actualRoleOf(playerId: string): RoleId | null;
  /** False when the id names no seat. */
  hasPlayer(playerId: string): boolean;
}

/** An intent the engine applies through a shared mechanic. */
export type RoleEffect = {
  readonly kind: "kill";
  readonly playerId: string;
  /** Recorded on the death entry as the ability that caused it. */
  readonly ability: string;
};

export type AbilityDecision =
  | { readonly kind: "effects"; readonly effects: readonly RoleEffect[] }
  /** The ability did nothing because its owner is drunk or poisoned. */
  | { readonly kind: "suppressed" }
  | { readonly kind: "no-effect" };

/** The optional capability a role module declares. */
export interface RoleAbility {
  resolve(context: AbilityContext): AbilityDecision;
}
