import type { RoleModule } from "../types.ts";

export const role = {
  id: "flowergirl",
  edition: "snv",
  capabilities: [
    {
      kind: "night-step",
      // Flowergirl r2907: "Each night except the first, wake the Flowergirl."
      // The answer is still read from the day in `sv.ts`.
      timing: "other",
      step: { target: "none", infoKind: "yes-no" },
    },
  ],
} satisfies RoleModule;
