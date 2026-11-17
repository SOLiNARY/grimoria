import { ALL_ROLES, roleTeam } from "../../model/rules.ts";
import type { RoleModule } from "../types.ts";

export const role = {
  id: "washerwoman",
  edition: "tb",
  capabilities: [
    {
      kind: "night-step",
      // Washerwoman r2630: "You start knowing that 1 of 2 players is a
      // particular Townsfolk." The Washerwoman is shown the two players and the
      // character on the first night and never wakes again.
      timing: "first",
      step: { infoKind: "one-of-two" },
    },
    {
      kind: "information",
      infoKind: "washerwoman",
      // Washerwoman r2630: "While preparing the first night", the Storyteller
      // marks a Townsfolk and one other player. That choice is the answer, so
      // the module does not compute one: it says the answer is the prepared one
      // and that it names a Townsfolk. A drunk or poisoned Washerwoman may be
      // shown any Townsfolk.
      resolve() {
        return {
          kind: "prepared",
          possible: ALL_ROLES.filter((id) => roleTeam(id) === "townsfolk"),
        };
      },
    },
  ],
} satisfies RoleModule;
