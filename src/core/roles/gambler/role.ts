import type { RoleModule } from "../types.ts";

export const role = {
  id: "gambler",
  edition: "bmr",
  capabilities: [
    {
      kind: "night-step",
      // Gambler r3073: "Each night*". The Gambler does not act on the first
      // night.
      timing: "other",
      step: { target: "one-any", canKill: false, noteKey: "note.bmr.gambler" },
      resolve({ actorId, targetIds, chosenRoleId, impaired, actualRoleOf, hasPlayer }) {
        if (impaired) return { kind: "suppressed" };
        const target = targetIds[0];
        if (!target || !chosenRoleId || !hasPlayer(target)) return { kind: "no-effect" };
        // The guess names a character, so the Recluse's registration as a Demon
        // does not make a Demon guess correct.
        if (actualRoleOf(target) === chosenRoleId) return { kind: "no-effect" };
        return {
          kind: "effects",
          effects: [{ kind: "kill", playerId: actorId }],
        };
      },
    },
  ],
} satisfies RoleModule;
