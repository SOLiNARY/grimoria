# Game mechanics

These instructions supplement the root AGENTS.md for this subtree. Run commands from the repository root (with the configured RTK wrapper).

Apply the root **Stop before changing game behavior** check before editing a
mechanic or its tests. Read the pinned official text first, using the root
source-recovery commands if local files are missing. For a verified conflict,
cite the source, ask the owner and end the turn; do not explore implementation
before the answer. If the source is unreachable, report the failure and stop.
For other rules checks, until the verdict is `compliant`, investigate read-only;
do not add death guards, change victory conditions or rewrite expected outcomes
to satisfy a conflicting request. A requested behavior is not a rules source.

Trace the shared mechanic and every caller before changing a role-specific path. Reuse the existing effects, information, death and queue helpers; expose public operations through `index.ts`.

Keep Validate/Preview/Apply atomic and deterministic. Preserve command identity checks, preview/apply agreement and idempotency; rejected actions must leave state unchanged.

Do not invent false information, registrations, redirects or heirs on behalf of the Storyteller.

Add a RED regression in the relevant engine/commands, BMR or Sects & Violets suite beside the module, then prove GREEN. Check: `npm test`; also exercise the affected screen with a real game state.
