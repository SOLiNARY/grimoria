import type { RoleModule } from "../types.ts";

export const role = {
  id: "vigormortis",
  edition: "snv",
  capabilities: [
    {
      kind: "night-step",
      // Vigormortis r3015: "Each night except the first, wake the Vigormortis."
      timing: "other",
      step: { target: "one-any", canKill: true },
      // The host marks the death, and the neighbour a killed Minion poisons, on
      // the step's outcome, which checks the Vigormortis's health.
      // The step itself resolves to nothing.
      resolve: () => ({ kind: "no-effect" }),
    },
  ],
} satisfies RoleModule;
