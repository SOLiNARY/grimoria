import type { RoleEffect } from "../ability.ts";
import type { RoleModule } from "../types.ts";

export const role = {
  id: "pukka",
  edition: "bmr",
  capabilities: [
    {
      kind: "night-step",
      // Pukka r3074: "Each night". Unlike other Demons, the Pukka acts during
      // the first night.
      timing: "any",
      step: { target: "one-any", noteKey: "note.bmr.pukka" },
      resolve({ actorId, targetIds, impaired, at, pendings }) {
        if (impaired) {
          const effects: RoleEffect[] = [];
          for (const pending of pendings) {
            if (pending.resumeOnHealthy) continue;
            if (pending.resolveAtNight === null || at.number >= pending.resolveAtNight) {
              effects.push({ kind: "suspend-death", pendingId: pending.id, reason: "impaired" });
            }
          }
          return {
            kind: "suppressed",
            effects,
            noteKey: "note.pukkaSuspended",
            text: "Способность не сработала: Пукка отравлен или пьян. Яд на прежней цели приостановлен.",
            result: { deaths: [], poisonedId: null, suspended: true },
          };
        }
        const targetId = targetIds[0];
        if (!targetId) return { kind: "no-effect" };
        const self = targetId === actorId;
        const previous = pendings.find((pending) => !pending.resumeOnHealthy) || null;
        // The new poison lands first: it can impair a protector (for example the
        // Tea Lady) before the previous victim's death is resolved.
        const effects: RoleEffect[] = [
          { kind: "poison", playerId: targetId },
          { kind: "delay-death", playerId: targetId, resolveAtNight: at.number + 1 },
        ];
        if (self) {
          if (previous) {
            effects.push({
              kind: "suspend-death",
              pendingId: previous.id,
              reason: "self-target",
              resumeOnHealthy: true,
            });
          }
          // The previous victim becomes healthy, but its death stays on hold.
          effects.push({ kind: "release-poisons", keepPlayerId: actorId });
          return {
            kind: "effects",
            effects,
            result: { deaths: [], resolved: null, poisonedId: targetId, suspended: true },
          };
        }
        if (previous) effects.push({ kind: "resolve-death", pendingId: previous.id });
        return {
          kind: "effects",
          effects,
          result: { deaths: [], resolved: null, poisonedId: targetId },
        };
      },
    },
  ],
} satisfies RoleModule;
