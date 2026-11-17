import type { RoleModule } from "../types.ts";

export const role = {
  id: "nodashii",
  edition: "snv",
  capabilities: [
    {
      kind: "night-step",
      // No Dashii r3158: "Each night except the first, wake the No Dashii."
      timing: "other",
      step: { target: "one-any", canKill: true },
      // The host marks the death on the step's outcome, which checks the No
      // Dashii's health. The poison of its neighbours is not a night step.
      // The step itself resolves to nothing.
      resolve: () => ({ kind: "no-effect" }),
    },
  ],
} satisfies RoleModule;
