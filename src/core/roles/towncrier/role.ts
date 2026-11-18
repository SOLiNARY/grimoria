import type { RoleModule } from "../types.ts";

export const role = {
  id: "towncrier",
  edition: "snv",
  capabilities: [
    {
      kind: "night-step",
      // Town Crier r3145: "Each night except the first, wake the Town Crier."
      // The answer is still read from the day in `sv.ts`.
      timing: "other",
      step: { target: "none", infoKind: "yes-no" },
    },
  ],
} satisfies RoleModule;
