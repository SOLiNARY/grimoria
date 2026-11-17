/** New commands use the current version; recorded commands keep their behavior. */
export const LEGACY_RULESET_VERSION = "tb-bmr-snv-2026-11-10";
/**
 * The last version that answered a zero prepared for any role as the
 * Librarian's. From the next one the zero is the answer of the role that
 * declares it (Librarian r1721).
 */
export const ANY_ROLE_ZERO_RULESET_VERSION = "tb-bmr-snv-2026-11-16";
/**
 * The last version that woke a new Demon a second time on the night after a
 * night succession, and queued the wake of a heir the host named only when a
 * later step of that night ended. From the next one the new Demon is woken
 * once, the night of the change (Imp r3116, Scarlet Woman r3117).
 */
export const REPEATED_DEMON_WAKE_RULESET_VERSION = "tb-bmr-snv-2026-11-17";
export const RULESET_VERSION = "tb-bmr-snv-2026-11-17.1";
export const SUPPORTED_RULESET_VERSIONS = new Set([
  LEGACY_RULESET_VERSION,
  ANY_ROLE_ZERO_RULESET_VERSION,
  REPEATED_DEMON_WAKE_RULESET_VERSION,
  RULESET_VERSION,
]);

/** Whether a command recorded under this version answers a zero held for any role. */
export function answersZeroForAnyRole(version: string | undefined): boolean {
  return version === LEGACY_RULESET_VERSION || version === ANY_ROLE_ZERO_RULESET_VERSION;
}

/**
 * Whether a command recorded under this version wakes a new Demon the way it
 * did before the fix: again on the night after a night change, and, after a
 * named heir, only when a later step of the night ends.
 */
export function repeatsDemonWake(version: string | undefined): boolean {
  return (
    version === LEGACY_RULESET_VERSION ||
    version === ANY_ROLE_ZERO_RULESET_VERSION ||
    version === REPEATED_DEMON_WAKE_RULESET_VERSION
  );
}
