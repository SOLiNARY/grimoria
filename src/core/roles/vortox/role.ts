import type { RoleModule } from "../types.ts";

export const role = {
  id: "vortox",
  edition: "snv",
  capabilities: [
    {
      kind: "night-step",
      // Vortox r3017: "Each night except the first, wake the Vortox."
      timing: "other",
      step: { target: "one-any", canKill: true },
      // The host marks the death on the step's outcome, which checks the
      // Vortox's health. Its false information and its win are not night steps.
      // The step itself resolves to nothing.
      resolve: () => ({ kind: "no-effect" }),
    },
  ],
} satisfies RoleModule;
