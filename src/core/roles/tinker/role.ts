import type { RoleModule } from "../types.ts";

export const role = {
  id: "tinker",
  edition: "bmr",
  capabilities: [
    {
      kind: "night-step",
      // The Tinker is on the order of the nights after the first only.
      timing: "other",
      step: { target: "none", canKill: true, noteKey: "note.bmr.tinker" },
      // Tinker r1782: "At any time, you may decide that the Tinker dies." The
      // Tinker chooses nothing, so the step resolves to nothing: the host marks
      // the death on the step's outcome.
      resolve: () => ({ kind: "no-effect" }),
    },
  ],
} satisfies RoleModule;
