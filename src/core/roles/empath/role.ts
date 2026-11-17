import type { RoleModule } from "../types.ts";

export const role = {
  id: "empath",
  edition: "tb",
  capabilities: [
    {
      kind: "night-step",
      // Empath r1724: "Each night, wake the Empath." The step takes no target
      // and shows a number.
      timing: "any",
      step: { infoKind: "number" },
    },
    {
      kind: "information",
      infoKind: "empath",
      // Empath r1724: how many of the two nearest living neighbours are evil.
      // A Spy or a Recluse counts as the team it registers as. The host shows
      // 0, 1 or 2 fingers, so those are the possible answers.
      resolve(context) {
        const value = context
          .aliveNeighborIds(context.actorId)
          .filter((playerId) => context.registeredTeamOf(playerId) === "evil").length;
        return { kind: "answer", value, possible: [0, 1, 2] };
      },
    },
  ],
} satisfies RoleModule;
