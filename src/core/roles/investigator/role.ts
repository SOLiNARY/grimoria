import { ALL_ROLES, roleTeam } from "../../model/rules.ts";
import type { RoleModule } from "../types.ts";

export const role = {
  id: "investigator",
  edition: "tb",
  capabilities: [
    {
      kind: "night-step",
      // Investigator r2983: "You start knowing that 1 of 2 players is a
      // particular Minion." The Investigator is shown the two players and the
      // character on the first night and never wakes again.
      timing: "first",
      step: { infoKind: "one-of-two" },
    },
    {
      kind: "information",
      infoKind: "investigator",
      // Investigator r2983: "While preparing the first night", the Storyteller
      // marks a Minion and one other player. That choice is the answer, so the
      // module does not compute one: it says the answer is the prepared one and
      // that it names a Minion. A drunk or poisoned Investigator may be shown
      // any Minion.
      resolve() {
        return {
          kind: "prepared",
          possible: ALL_ROLES.filter((id) => roleTeam(id) === "minion"),
        };
      },
    },
  ],
} satisfies RoleModule;
