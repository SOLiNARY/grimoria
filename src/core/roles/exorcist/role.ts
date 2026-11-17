import { roleTeam } from "../../model/rules.ts";
import type { RoleEffect } from "../ability.ts";
import type { RoleModule } from "../types.ts";

export const role = {
  id: "exorcist",
  edition: "bmr",
  capabilities: [
    {
      kind: "night-step",
      // Exorcist r2973: "Each night except the first, wake the Exorcist."
      timing: "other",
      step: { target: "one-any", noteKey: "note.bmr.exorcist" },
      resolve({ actorId, targetIds, impaired, actualRoleOf, nameOf }) {
        const playerId = targetIds[0] ?? null;
        // "Different to last night" is about the choice, not about whether the
        // ability worked, so the choice is recorded also when it fails.
        const choice: RoleEffect = { kind: "record-choice", playerId };
        // An impaired Exorcist stops nobody (States r1039).
        if (impaired) return { kind: "suppressed", effects: [choice] };
        const roleId = playerId ? actualRoleOf(playerId) : null;
        // "The Demon, if chosen": any other player changes nothing.
        if (!playerId || !roleId || roleTeam(roleId) !== "demon") {
          return { kind: "effects", effects: [choice] };
        }
        // "Learns who you are then doesn't wake tonight."
        const name = nameOf(actorId);
        return {
          kind: "effects",
          effects: [
            choice,
            {
              kind: "block-demon",
              playerId,
              note: {
                key: "note.exorcistBlocked",
                vars: { name },
                text:
                  "Экзорцист (" +
                  name +
                  ") выбрал Демона. Демон узнаёт Экзорциста и не просыпается.",
              },
              log: {
                title: "Экзорцист выбрал Демона",
                detail: nameOf(playerId) + " узнаёт Экзорциста и не действует этой ночью.",
              },
            },
          ],
        };
      },
    },
  ],
} satisfies RoleModule;
