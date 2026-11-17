import type { RoleModule } from "../types.ts";

export const role = {
  id: "mathematician",
  edition: "snv",
  capabilities: [
    {
      kind: "night-step",
      // Mathematician r3153: "Each night, wake the Mathematician." The count
      // and the removal of the ABNORMAL reminders stay in `sv.ts`.
      timing: "any",
      step: { target: "none", infoKind: "number" },
    },
  ],
} satisfies RoleModule;
