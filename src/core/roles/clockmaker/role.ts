import type { RoleModule } from "../types.ts";

export const role = {
  id: "clockmaker",
  edition: "snv",
  capabilities: [
    {
      kind: "night-step",
      // Clockmaker r2967: "You start knowing"; "During the first night, wake
      // the Clockmaker." The answer is still computed in `sv.ts`.
      timing: "first",
      step: { target: "none", infoKind: "number" },
    },
  ],
} satisfies RoleModule;
