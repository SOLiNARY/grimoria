// One scoped execution context per command. Rule handlers read the command's
// seeded sequence through this module instead of temporarily replacing the
// global `Math.random`, so a handler can never leak randomness to another
// command or to concurrent work.
export interface ExecutionContext {
  random: () => number;
}

let active: ExecutionContext | null = null;

export function runWithExecutionContext<T>(context: ExecutionContext, fn: () => T): T {
  const previous = active;
  active = context;
  try {
    return fn();
  } finally {
    active = previous;
  }
}

/** The command's seeded value, or the platform default outside a command. */
export function nextRandom(): number {
  return active ? active.random() : Math.random();
}

/** The short base-36 suffix the state ids use, drawn from the same sequence. */
export function randomSuffix(length: number): string {
  return nextRandom()
    .toString(36)
    .slice(2, 2 + length);
}
