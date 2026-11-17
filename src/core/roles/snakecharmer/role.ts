import { roleTeam } from "../../model/rules.ts";
import type { RoleModule } from "../types.ts";

export const role = {
  id: "snakecharmer",
  edition: "snv",
  capabilities: [
    {
      kind: "night-step",
      // Snake Charmer r2905: "Each night, wake the Snake Charmer. They point at
      // any player." The command refuses a dead player ("choose an alive
      // player").
      timing: "any",
      step: { target: "one-any", infoKind: "note" },
    },
    {
      kind: "transformation",
      cause: "snakecharmer",
      // "If that player is not the Demon, nothing happens." A chosen Demon
      // "swaps characters & alignments with you & is then poisoned"; the new
      // Snake Charmer stays poisoned for good. A drunk or poisoned Snake
      // Charmer has no ability.
      resolve({ targetId, impaired, actualRoleOf }) {
        if (impaired) return { kind: "no-effect", reason: "impaired" };
        if (roleTeam(actualRoleOf(targetId) || "") !== "demon") {
          return { kind: "no-effect", reason: "not-demon" };
        }
        return { kind: "swap", playerId: targetId, alignments: true, poisoned: true };
      },
    },
  ],
} satisfies RoleModule;
