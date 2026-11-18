import { roleLabel } from "../../model/rules.ts";
import type { RoleModule } from "../types.ts";

export const role = {
  id: "cerenovus",
  edition: "snv",
  capabilities: [
    {
      kind: "night-step",
      // Cerenovus r3048: "Each night, wake the Cerenovus."
      timing: "any",
      step: { target: "one-any", infoKind: "note" },
      // "They point at any player and at any Townsfolk or Outsider icon": the
      // command refuses another character before the step resolves. "During
      // the next day or night" the Storyteller may execute the mad player, so
      // the madness lasts until the next dawn. A drunk or poisoned Cerenovus,
      // or a choice without a character, makes nobody mad.
      resolve({ targetIds, chosenRoleId, impaired, at, nameOf }) {
        const playerId = targetIds[0];
        if (!playerId || !chosenRoleId || impaired) return { kind: "no-effect" };
        const name = nameOf(playerId);
        return {
          kind: "effects",
          effects: [
            {
              kind: "madness",
              playerId,
              roleId: chosenRoleId,
              expires: { phase: "day", number: at.number + 1 },
            },
          ],
          note: {
            key: "note.madness",
            vars: { name, role: chosenRoleId },
            text:
              name +
              " должен быть «помешан» на роли " +
              roleLabel(chosenRoleId) +
              " до следующего рассвета.",
          },
        };
      },
    },
  ],
} satisfies RoleModule;
