import type { RoleModule } from "../types.ts";

export const role = {
  id: "dreamer",
  edition: "snv",
  capabilities: [
    {
      kind: "night-step",
      // Dreamer r2904: "Each night, wake the Dreamer. They point at any
      // player." The command refuses the Dreamer themself; the two characters
      // are still offered from `sv.ts`.
      timing: "any",
      step: { target: "one-any", infoKind: "note" },
    },
  ],
} satisfies RoleModule;
