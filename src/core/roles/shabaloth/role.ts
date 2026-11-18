import type { RoleModule } from "../types.ts";

export const role = {
  id: "shabaloth",
  edition: "bmr",
  capabilities: [
    {
      kind: "night-step",
      // Shabaloth r1790: "Each night except the first, wake the Shabaloth."
      timing: "other",
      step: {
        target: "two",
        canKill: true,
        canResurrect: true,
        noteKey: "note.bmr.shabaloth",
      },
      // The host marks the deaths and the regurgitation on the step's outcome.
      // The two players are recorded even when both survive, so the next
      // night's regurgitation has "a dead player you chose last night". A
      // drunk or poisoned Shabaloth records no choice.
      resolve({ targetIds, impaired }) {
        if (impaired || !targetIds.length) return { kind: "no-effect" };
        return {
          kind: "effects",
          effects: [{ kind: "record-choices", playerIds: targetIds.slice(0, 2) }],
        };
      },
    },
  ],
} satisfies RoleModule;
