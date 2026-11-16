import type { RoleModule } from "../types.ts";

const numbers = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

export const role = {
  id: "chef",
  edition: "tb",
  capabilities: [
    {
      kind: "night-step",
      // Chef r2510: "You start knowing how many pairs of evil players there
      // are." The Chef is shown fingers on the first night and never wakes again.
      timing: "first",
      step: { infoKind: "number" },
    },
    {
      kind: "information",
      infoKind: "chef",
      // Chef r2510: "A pair is two players, but one player may be a part of
      // two pairs." Every seat is paired with the next one around the circle.
      resolve(context) {
        const seats = context.seatIds;
        let pairs = 0;
        let fewest = 0;
        let most = 0;
        seats.forEach((seat, index) => {
          const next = seats[(index + 1) % seats.length]!;
          if (
            context.registeredTeamOf(seat) === "evil" &&
            context.registeredTeamOf(next) === "evil"
          )
            pairs += 1;
          // Chef r2510, Example 4: a player who may register either way does so
          // for each pair on its own, so every count from the pairs that
          // cannot be avoided to the pairs that can be made is legal.
          if (context.mayRegisterAs(seat, "evil") && context.mayRegisterAs(next, "evil")) most += 1;
          if (!context.mayRegisterAs(seat, "good") && !context.mayRegisterAs(next, "good"))
            fewest += 1;
        });
        return {
          kind: "answer",
          value: pairs,
          possible: numbers(0, seats.length),
          legal: numbers(fewest, most),
        };
      },
    },
  ],
} satisfies RoleModule;
