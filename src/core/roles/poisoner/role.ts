import type { RoleModule } from "../types.ts";

export const role = {
  id: "poisoner",
  edition: "tb",
  capabilities: [
    {
      kind: "night-step",
      timing: "any",
      step: { target: "one-any" },
      // Poisoner r1737: the chosen player is poisoned tonight and tomorrow
      // day, so the poison ends at the next dusk. A new choice replaces the
      // poison this Poisoner already holds.
      resolve({ targetIds, impaired, at, nameOf }) {
        if (impaired) return { kind: "suppressed" };
        const targetId = targetIds[0];
        if (!targetId) return { kind: "no-effect" };
        const name = nameOf(targetId);
        return {
          kind: "effects",
          effects: [
            {
              kind: "timed-effect",
              effect: "poison",
              playerId: targetId,
              expires: { phase: "night", number: at.number + 1 },
              replacesPrevious: true,
            },
          ],
          note: { key: "note.poisoned", vars: { name }, text: "Отравлен: " + name + "." },
        };
      },
    },
  ],
} satisfies RoleModule;
