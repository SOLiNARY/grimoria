import type { RoleModule } from "../types.ts";

export const role = {
  id: "fortuneteller",
  edition: "tb",
  capabilities: [
    {
      kind: "night-step",
      // Fortune Teller r3123: "Each night, wake the Fortune Teller. The Fortune
      // Teller points at any two players." The answer is a nod or a shake.
      timing: "any",
      step: { target: "two", infoKind: "yes-no" },
    },
    {
      kind: "information",
      infoKind: "fortuneteller",
      // Fortune Teller r3123: "If either chosen player is a Demon or the Red
      // Herring, nod your head yes. Otherwise, shake your head no." A dead
      // player and the Fortune Teller's own seat are legal choices.
      resolve(context) {
        const value = context.targetIds.some(
          (playerId) =>
            context.hasPlayer(playerId) &&
            (playerId === context.redHerringId || context.registersAsDemon(playerId)),
        );
        return { kind: "answer", value, possible: [true, false] };
      },
    },
  ],
} satisfies RoleModule;
