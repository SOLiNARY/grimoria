import { ALL_ROLES, roleTeam } from "../../model/rules.ts";
import type { RoleModule } from "../types.ts";

export const role = {
  id: "librarian",
  edition: "tb",
  capabilities: [
    {
      kind: "night-step",
      // Librarian r1721: "You start knowing that 1 of 2 players is a
      // particular Outsider. (Or that zero are in play.)" The Librarian is shown
      // the answer on the first night and never wakes again.
      timing: "first",
      step: { infoKind: "one-of-two" },
    },
    {
      kind: "information",
      infoKind: "librarian",
      // Librarian r1721: "While preparing the first night", the Storyteller
      // marks an Outsider and one other player. That choice is the answer, so
      // the module does not compute one: it says the answer is the prepared one
      // and that it names an Outsider, the Drunk among them. A drunk or
      // poisoned Librarian may be shown any Outsider. The zero is prepared in
      // setup like the pair, and the engine still writes its record.
      resolve() {
        return {
          kind: "prepared",
          possible: ALL_ROLES.filter((id) => roleTeam(id) === "outsider"),
        };
      },
    },
  ],
} satisfies RoleModule;
