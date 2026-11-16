// Compile-time contract checks. `tsc -p tsconfig.test.json` consumes them.
import type {
  AbilityContext,
  AbilityDecision,
  InformationContext,
  InformationDecision,
  RoleCapability,
  RoleEffect,
} from "./ability.ts";

// A resolver reads facts. The game state and the players map are not reachable,
// so a role cannot mutate unrelated state from its ability.
// @ts-expect-error -- the context exposes no game state
export type StateAccess = AbilityContext["state"];
// @ts-expect-error -- the context exposes no players map
export type PlayersAccess = AbilityContext["players"];

// The engine applies a closed set of intents.
export const unknownEffect: RoleEffect = {
  // @ts-expect-error -- a role cannot invent an effect kind
  kind: "set-winner",
  playerId: "1",
  ability: "gambler",
};

// A dated effect names a mechanic the engine already has.
export const unknownTimedEffect: RoleEffect = {
  kind: "timed-effect",
  // @ts-expect-error -- a role cannot invent an effect kind for the effect graph
  effect: "winner",
  playerId: "1",
  expires: { phase: "night", number: 2 },
};

// The engine stamps the source and mints the id of a dated effect.
export const forgedTimedEffect: RoleEffect = {
  kind: "timed-effect",
  effect: "poison",
  playerId: "1",
  expires: { phase: "night", number: 2 },
  // @ts-expect-error -- a role cannot choose the effect id
  id: "eff-1-abcd",
};

// The master record belongs to the acting seat: a role cannot write it on
// another player.
export const foreignMaster: RoleEffect = {
  kind: "record-master",
  playerId: "2",
  // @ts-expect-error -- a role cannot name the seat the record is written on
  actorId: "3",
};

// A role cannot switch a dated effect off or on: the engine derives that from
// the decision, so a suppressed ability never leaves a working effect.
export const selfActivatedEffect: RoleEffect = {
  kind: "timed-effect",
  effect: "butler",
  playerId: "2",
  expires: { phase: "night", number: 2 },
  // @ts-expect-error -- a role cannot choose whether the effect applies
  active: true,
};

// A night-step resolver reads the same facts as every ability: no game state.
type NightStepArm = Extract<RoleCapability, { kind: "night-step" }>;
type NightStepFacts = Parameters<NonNullable<NightStepArm["resolve"]>>[0];
// @ts-expect-error -- the night-step context exposes no game state
export type NightStepStateAccess = NightStepFacts["state"];

// An attack names the chosen player and the title of its log line. The engine
// derives the attacker from the acting seat, takes the Mayor's redirect from
// the host and writes the cause of death.
type AttackDecision = Extract<AbilityDecision, { kind: "attack" }>;
export const foreignAttack: AttackDecision = {
  kind: "attack",
  playerId: "2",
  title: "attack",
  // @ts-expect-error -- a role cannot name the attacker
  attackerId: "3",
};
export const selfRedirectedAttack: AttackDecision = {
  kind: "attack",
  playerId: "2",
  title: "attack",
  // @ts-expect-error -- the redirect is the host's answer, not the role's
  redirectId: "4",
};
export const renamedDeath: AttackDecision = {
  kind: "attack",
  playerId: "2",
  title: "attack",
  // @ts-expect-error -- a role cannot choose the cause of the death
  cause: "execution",
};

// An information capability reads facts and returns the answer and the values
// it can take. The engine decides whether the ability works, whether the host
// answers and which options one step offers.
// @ts-expect-error -- the information context exposes no game state
export type InformationStateAccess = InformationContext["state"];
// The engine applies the host's registrations behind `registersAsDemon` and
// `registeredTeamOf`, and names the red herring by id only.
// @ts-expect-error -- the information context exposes no host registrations
export type InformationRegistrationAccess = InformationContext["registrations"];
// @ts-expect-error -- the information context exposes no setup secrets
export type InformationSetupAccess = InformationContext["setup"];
type InformationAnswer = Extract<InformationDecision, { kind: "answer" }>;
export const selfFalsifiedAnswer: InformationAnswer = {
  kind: "answer",
  value: 1,
  possible: [0, 1, 2],
  // @ts-expect-error -- a role cannot mark its own answer as false
  impaired: true,
};
export const selfRequiredChoice: InformationAnswer = {
  kind: "answer",
  value: 1,
  // @ts-expect-error -- a role cannot require the host's answer
  needsChoice: true,
};
export const selfOfferedOptions: InformationAnswer = {
  kind: "answer",
  value: 1,
  // @ts-expect-error -- a role cannot name the options of one step
  options: [0, 1, 2],
};
