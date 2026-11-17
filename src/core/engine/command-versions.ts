/** New commands use the current version; recorded commands keep their behavior. */
export const LEGACY_RULESET_VERSION = "tb-bmr-snv-2026-11-10";
/**
 * The last version that answered a zero prepared for any role as the
 * Librarian's. From the next one the zero is the answer of the role that
 * declares it (Librarian r1721).
 */
export const ANY_ROLE_ZERO_RULESET_VERSION = "tb-bmr-snv-2026-11-16";
export const RULESET_VERSION = "tb-bmr-snv-2026-11-17";
export const SUPPORTED_RULESET_VERSIONS = new Set([
  LEGACY_RULESET_VERSION,
  ANY_ROLE_ZERO_RULESET_VERSION,
  RULESET_VERSION,
]);

/** Whether a command recorded under this version answers a zero held for any role. */
export function answersZeroForAnyRole(version: string | undefined): boolean {
  return version === LEGACY_RULESET_VERSION || version === ANY_ROLE_ZERO_RULESET_VERSION;
}
