import type { RoleModule } from "../types.ts";

export const role = {
  id: "oracle",
  edition: "snv",
  capabilities: [
    {
      kind: "night-step",
      // Oracle r2909: "Each night except the first, wake the Oracle." The
      // count is still computed in `sv.ts`.
      timing: "other",
      step: { target: "none", infoKind: "number" },
    },
  ],
} satisfies RoleModule;
