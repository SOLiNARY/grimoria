import type { AbilityContext, AbilityDecision, RoleEffect } from "../ability.ts";
import type { RoleModule } from "../types.ts";

// Devil's Advocate r2594: "Each night, choose a living player (different to
// last night): if executed tomorrow, they don't die." The command path checks
// that the player is living and was not last night's choice.
function resolve({ targetIds, impaired, at }: AbilityContext): AbilityDecision {
  const playerId = targetIds[0];
  // The command path requires the player.
  if (!playerId) return { kind: "no-effect" };
  // "Different to last night" is about the choice, not about whether the
  // ability worked, so the choice is recorded also when it fails.
  const choice: RoleEffect = { kind: "record-choice", playerId };
  // An impaired Devil's Advocate protects nobody (States r1039).
  if (impaired) return { kind: "suppressed", effects: [choice] };
  return {
    kind: "effects",
    effects: [
      choice,
      {
        kind: "timed-effect",
        effect: "survives-execution",
        playerId,
        // "If executed tomorrow": the protection ends when the next night starts.
        expires: { phase: "night", number: at.number + 1 },
      },
    ],
  };
}

export const role = {
  id: "devilsadvocate",
  edition: "bmr",
  capabilities: [
    // "Each night, wake the Devil's Advocate", the first night included. The
    // two nights differ only in the note the host reads.
    {
      kind: "night-step",
      timing: "first",
      step: { target: "one-any", noteKey: "note.bmr.devilAdvocateFirst" },
      // Tonight's choice replaces the last one, also when the Devil's
      // Advocate is drunk or poisoned now.
      endsOnUse: ["survives-execution"],
      resolve,
    },
    {
      kind: "night-step",
      timing: "other",
      step: { target: "one-any", noteKey: "note.bmr.devilAdvocateOther" },
      endsOnUse: ["survives-execution"],
      resolve,
    },
  ],
} satisfies RoleModule;
