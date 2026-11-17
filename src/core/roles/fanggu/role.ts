import type { RoleModule } from "../types.ts";

export const role = {
  id: "fanggu",
  edition: "snv",
  capabilities: [
    {
      kind: "night-step",
      // Fang Gu r2974: "Each night except the first, wake the Fang Gu."
      timing: "other",
      step: { target: "one-any", canKill: true },
      // The host marks the death, or the jump into the first Outsider it kills,
      // on the step's outcome, which checks the Fang Gu's health.
      // The step itself resolves to nothing.
      resolve: () => ({ kind: "no-effect" }),
    },
  ],
} satisfies RoleModule;
