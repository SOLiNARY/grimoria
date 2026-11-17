import type { RoleEffect } from "../ability.ts";
import type { RoleModule } from "../types.ts";

export const role = {
  id: "butler",
  edition: "tb",
  capabilities: [
    {
      kind: "night-step",
      timing: "any",
      // Butler r3120: choose a player other than yourself.
      step: { target: "one-other" },
      resolve({ targetIds, impaired, at, nameOf }) {
        const masterId = targetIds[0];
        if (!masterId) return { kind: "no-effect" };
        // "Mark this player with the MASTER reminder token" (Butler r3120):
        // the choice is recorded even when the ability does not work. The
        // restriction covers tomorrow's votes and ends at the next dusk.
        const effects: RoleEffect[] = [
          { kind: "record-master", playerId: masterId },
          {
            kind: "timed-effect",
            effect: "butler",
            playerId: masterId,
            expires: { phase: "night", number: at.number + 1 },
          },
        ];
        // A drunk or poisoned Butler votes freely (States r1039): the engine
        // keeps a suppressed effect as a record that never applies.
        if (impaired) return { kind: "suppressed", effects };
        const name = nameOf(masterId);
        return {
          kind: "effects",
          effects,
          note: {
            key: "note.butlerMaster",
            vars: { name },
            text: "Завтра голосует только вместе с: " + name + ".",
          },
        };
      },
    },
  ],
} satisfies RoleModule;
