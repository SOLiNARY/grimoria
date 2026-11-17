import type { RoleModule } from "../types.ts";

export const role = {
  id: "po",
  edition: "bmr",
  capabilities: [
    {
      kind: "night-step",
      // Po r3104: "Each night except the first, wake the Po."
      timing: "other",
      step: {
        target: "po",
        minTargets: 0,
        maxTargets: 3,
        canKill: true,
        noteKey: "note.bmr.po",
      },
      // The host marks the Po's deaths on the step's outcome, which checks the
      // Po's health. The step records only whether the Po chose no one: "if
      // the Po was drunk or poisoned when they chose nobody last night, they
      // still choose three players tonight".
      resolve: ({ targetIds }) => ({
        kind: "effects",
        effects: [{ kind: "record-no-one", noOne: targetIds.length === 0 }],
      }),
    },
  ],
} satisfies RoleModule;
