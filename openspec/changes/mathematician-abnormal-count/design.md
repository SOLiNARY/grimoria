# Design

## Context

The existing Mathematician step is a `note` with no value and no host input.
The rules give the Storyteller a marking procedure, then a count: mark each
character whose ability worked abnormally because of another ability, count the
characters with reminders, remove the reminders. The count is mechanical once
the marks exist; deciding a mark is not.

## Goals

- Make the count real and replayable from recorded causes.
- Never invent that an ability was abnormal.
- Keep the false-number decision for impairment and the Vortox.
- Keep the private reasons out of public projections and keep old saves valid.

## Non-Goals

- Automatically detecting abnormal workings from effects, registrations or
  information. The engine cannot decide every case (the Recluse's registration,
  a false statement, a Storyteller-chosen target).
- Counting poisoned players as such. The pinned text explicitly excludes
  drunkenness or poisoning itself.
- A per-event journal beyond the existing secret log.

## Decisions

### The mark ledger is the causal evidence

`state.abnormal` holds `{ playerId, reason, at }`. `recordAbnormal` requires a
day or night, no winner, a real player and a trimmed reason. It rejects a
second mark for the same player in the same day/night number, so the ledger
matches the "one ABNORMAL reminder per character" procedure.

### The window is the current day and night number

The Mathematician wakes at night N after day N. A mark made during day N or
night N counts; a mark from night N-1 has number N-1 and does not. The step
clears the ledger after it resolves, matching "remove all ABNORMAL reminders".

### The count is computed; the number shown may be false

`svInfoForStep` returns `kind: "number"` with the true count and no choice in a
healthy game. If the Mathematician is impaired or a living unimpaired Vortox is
in play, it keeps the true value in `value` but sets `needsChoice` with options
0..players, so the host supplies the false number. This reuses the same host
choice path as the Chef, Empath and Juggler.

### One UI surface

The table menu already hosts cross-phase host actions (madness, Tinker, manual
winner). The ABNORMAL marking panel lives there, lists the marks and dispatches
`recordAbnormal`; the day card and night card do not duplicate it.

## Risks / Trade-offs

- A host who forgets to mark an event produces a low count. The panel shows the
  current marks during the window, so the mistake is visible before the night.
- The ledger is not automatically pruned when the Mathematician is absent. The
  window filter keeps old marks harmless; the step clears the ledger whenever it
  resolves.
- The reasons are free text and stay in the Storyteller state and the secret
  log; the existing export warning covers them.
