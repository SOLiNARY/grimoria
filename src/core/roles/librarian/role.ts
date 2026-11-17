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
      // poisoned Librarian may be shown any Outsider. "(Or that zero are in
      // play.)" is a form of this ability alone, so the module declares it:
      // setup may hold a zero in place of the two players. Whether zero are in
      // play stays the Storyteller's answer, and the engine writes its record.
      resolve() {
        return {
          kind: "prepared",
          possible: ALL_ROLES.filter((id) => roleTeam(id) === "outsider"),
          orZero: true,
        };
      },
    },
  ],
} satisfies RoleModule;
