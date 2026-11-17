import type { RoleModule } from "../types.ts";

export const role = {
  id: "eviltwin",
  edition: "snv",
  capabilities: [
    {
      kind: "night-step",
      // Evil Twin r3101: "During the first night, wake both Twins." The pair
      // is shown from `sv.ts`.
      timing: "first",
      step: { target: "none", infoKind: "note" },
    },
  ],
} satisfies RoleModule;
