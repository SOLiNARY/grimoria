import type { RoleModule } from "../types.ts";

// Spy r3118: "Each night, you see the Grimoire." The step is the same on every
// night and applies nothing. The answer is the Grimoire itself: the module
// reads no fact and names no value. Which good characters the Spy might
// register as is the adjudication below; the engine applies it.
export const role = {
  id: "spy",
  edition: "tb",
  capabilities: [
    { kind: "night-step", timing: "any", step: { infoKind: "grimoire" } },
    {
      kind: "information",
      infoKind: "spy",
      resolve() {
        return { kind: "grimoire" };
      },
    },
    {
      kind: "adjudication",
      case: "registration",
      options: ["good"],
    },
  ],
} satisfies RoleModule;
