// Compile-time contract checks. `tsc -p tsconfig.test.json` consumes them.
import type { AbilityContext, RoleEffect } from "./ability.ts";

// A resolver reads facts. The game state and the players map are not reachable,
// so a role cannot mutate unrelated state from its ability.
// @ts-expect-error -- the context exposes no game state
export type StateAccess = AbilityContext["state"];
// @ts-expect-error -- the context exposes no players map
export type PlayersAccess = AbilityContext["players"];

// The engine applies a closed set of intents.
export const unknownEffect: RoleEffect = {
  // @ts-expect-error -- a role cannot invent an effect kind
  kind: "set-winner",
  playerId: "1",
  ability: "gambler",
};
