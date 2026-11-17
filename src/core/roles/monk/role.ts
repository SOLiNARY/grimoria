import type { RoleModule } from "../types.ts";

export const role = {
  id: "monk",
  edition: "tb",
  capabilities: [
    {
      kind: "night-step",
      // Monk r3124: "Each night*". The Monk does not act on the first night.
      timing: "other",
      step: { target: "one-other" },
      // The chosen player is safe from the Demon tonight, so the protection
      // ends at dawn. A new choice replaces the protection this Monk gave.
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
              effect: "protected",
              playerId: targetId,
              expires: { phase: "day", number: at.number },
              replacesPrevious: true,
            },
          ],
          note: {
            key: "note.protected",
            vars: { name },
            text: "Защищён этой ночью: " + name + ".",
          },
        };
      },
    },
  ],
} satisfies RoleModule;
