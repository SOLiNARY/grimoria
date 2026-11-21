// The prototype set: the graphite reading surface of /reference carried onto
// the two main screens. This module holds the shared pieces and the example
// data; the comps themselves live in home.tsx and table.tsx.
import { useState, type ReactNode } from "react";
import { nightSequence } from "../../../core/model/rules.ts";
import type { Role } from "../../../core/model/types.ts";
import { cx } from "../../components/arcane/classes.ts";
import { useShellPorts } from "../../ports.ts";

export interface ProtoSeat {
  seat: number;
  name: string;
  role: Role;
  alive: boolean;
}

export interface ProtoQueueItem {
  order: number;
  role: Role;
  current: boolean;
  done: boolean;
}

export interface ProtoTable {
  edition: string;
  night: number;
  stepOrder: number;
  stepTotal: number;
  role: Role;
  question: string;
  seats: ProtoSeat[];
  queue: ProtoQueueItem[];
  living: number;
  total: number;
  threshold: number;
  deadRole: Role | null;
}

export type ProtoTeam = "townsfolk" | "outsider" | "minion" | "demon";

export interface ProtoEdition {
  id: "tb" | "bmr" | "snv";
  name: string;
  count: number;
  sample: Role[];
  teams: Record<ProtoTeam, number>;
}

export interface ProtoHome {
  firstNight: Role[];
  firstNightOrder: Role[];
  deadRole: Role | null;
  editions: ProtoEdition[];
  total: number;
}

const TEAM_DOT: Record<string, string> = {
  townsfolk: "bg-townsfolk",
  outsider: "bg-outsider",
  minion: "bg-minion",
  demon: "bg-demon",
  traveller: "bg-traveller",
};

const SAMPLE_EDITION: Record<"tb" | "bmr" | "snv", string[]> = {
  tb: ["washerwoman", "chef", "empath", "imp"],
  bmr: ["grandmother", "gossip", "assassin", "zombuul"],
  snv: ["clockmaker", "savant", "witch", "vortox"],
};

const SCENARIO_KEYS: Record<"tb" | "bmr" | "snv", string> = {
  tb: "sheetScenarioTb",
  bmr: "sheetScenarioBmr",
  snv: "sheetScenarioSnv",
};

const FALLBACK_ROLE: Role = { id: "unknown", name: "—", team: "townsfolk", edition: "tb" };

const TABLE_SEATS: Array<[string, string, boolean]> = [
  ["Аня", "washerwoman", true],
  ["Борис", "chef", true],
  ["Вера", "empath", true],
  ["Гриша", "fortuneteller", true],
  ["Даша", "recluse", false],
  ["Егор", "monk", true],
  ["Женя", "poisoner", true],
  ["Зоя", "imp", true],
];

const TABLE_QUEUE: Array<[string, "done" | "current" | "next"]> = [
  ["poisoner", "done"],
  ["washerwoman", "done"],
  ["chef", "done"],
  ["fortuneteller", "current"],
  ["empath", "next"],
  ["monk", "next"],
  ["undertaker", "next"],
];

export function useProtoHome(): ProtoHome {
  const ports = useShellPorts();
  const role = (id: string) => ports.roles.byId(id);
  const all = ports.roles
    .all()
    .filter(
      (item) =>
        item.team !== "traveller" &&
        (item.edition === "tb" || item.edition === "bmr" || item.edition === "snv"),
    );
  const editions = (["tb", "bmr", "snv"] as const).map((id) => {
    const teams: Record<ProtoTeam, number> = {
      townsfolk: all.filter((item) => item.edition === id && item.team === "townsfolk").length,
      outsider: all.filter((item) => item.edition === id && item.team === "outsider").length,
      minion: all.filter((item) => item.edition === id && item.team === "minion").length,
      demon: all.filter((item) => item.edition === id && item.team === "demon").length,
    };
    return {
      id,
      name: ports.strings.t(SCENARIO_KEYS[id]),
      count: all.filter((item) => item.edition === id).length,
      sample: SAMPLE_EDITION[id].map(role).filter((item): item is Role => item !== null),
      teams,
    };
  });
  const order = nightSequence(1, "tb")
    .map(role)
    .filter((item): item is Role => item !== null);
  return {
    firstNight: order.slice(0, 5),
    firstNightOrder: order,
    deadRole: role("butler"),
    editions,
    total: all.length,
  };
}

export function useProtoTable(): ProtoTable {
  const ports = useShellPorts();
  const role = (id: string) => ports.roles.byId(id);
  const seats = TABLE_SEATS.flatMap(([name, roleId, alive], index) => {
    const found = role(roleId);
    return found ? [{ seat: index + 1, name, role: found, alive }] : [];
  });
  const queue = TABLE_QUEUE.flatMap(([roleId, state], index) => {
    const found = role(roleId);
    if (!found) return [];
    return [
      { order: index + 1, role: found, current: state === "current", done: state === "done" },
    ];
  });
  const current = queue.find((item) => item.current);
  const living = seats.filter((item) => item.alive).length;
  return {
    edition: ports.strings.t("sheetScenarioTb"),
    night: 1,
    stepOrder: current?.order ?? 1,
    stepTotal: 12,
    role: current?.role ?? seats[0]?.role ?? FALLBACK_ROLE,
    question: ports.strings.t("chooseTwo"),
    seats,
    queue,
    living,
    total: seats.length,
    threshold: Math.ceil(living / 2),
    deadRole: role("butler"),
  };
}

export function Token({
  role,
  size = 40,
  disc = "bg-ref-token",
}: {
  role: Role;
  size?: 28 | 32 | 36 | 40 | 44 | 56;
  disc?: string;
}) {
  const ports = useShellPorts();
  const box = {
    28: "size-7",
    32: "size-8",
    36: "size-9",
    40: "size-10",
    44: "size-11",
    56: "size-14",
  }[size];
  return (
    <span
      className={cx("grid shrink-0 place-items-center rounded-full", disc, box)}
      aria-hidden="true"
    >
      <img className="h-[80%] w-[80%] object-contain" src={ports.roles.image(role)} alt="" />
    </span>
  );
}

export function TeamDot({ team }: { team: string }) {
  return (
    <span
      className={cx("inline-block size-1.5 shrink-0 rounded-full", TEAM_DOT[team] ?? "bg-ref-dim")}
      aria-hidden="true"
    />
  );
}

const ACTION =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] px-4 text-[14px] font-medium leading-none transition-colors focus-visible:outline-2 focus-visible:outline-ref-ink focus-visible:outline-offset-2";

export function Primary({
  children,
  full,
  disabled,
  onClick,
  className,
}: {
  children: ReactNode;
  full?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cx(
        ACTION,
        "bg-ref-ink font-semibold text-[#111] hover:bg-white disabled:cursor-not-allowed disabled:border disabled:border-ref-rule disabled:bg-ref-well disabled:text-ref-dim",
        full && "w-full",
        className,
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Secondary({
  children,
  full,
  onClick,
  className,
}: {
  children: ReactNode;
  full?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cx(
        ACTION,
        "border border-ref-edge text-ref-ink hover:border-ref-muted hover:bg-ref-well",
        full && "w-full",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Quiet({
  children,
  full,
  onClick,
  className,
}: {
  children: ReactNode;
  full?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cx(
        ACTION,
        "text-ref-muted hover:bg-ref-well hover:text-ref-ink",
        full && "w-full",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function DeadMark() {
  const ports = useShellPorts();
  return (
    <span className="inline-flex items-center rounded-[6px] border border-[#4a2521] px-1.5 py-0.5 text-[11px] leading-[14px] text-[#ff9c90]">
      {ports.strings.t("deadShort")}
    </span>
  );
}

export function usePick(max: number) {
  const [ids, setIds] = useState<string[]>([]);
  const toggle = (id: string) =>
    setIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : previous.length >= max
          ? previous
          : [...previous, id],
    );
  return { ids, toggle, clear: () => setIds([]), has: (id: string) => ids.includes(id) };
}

export const CARD = "rounded-[16px] border border-ref-edge bg-ref-surface";
export const LABEL = "text-[11px] font-semibold uppercase tracking-[.12em] text-ref-dim";
export const PAGE = "min-h-[calc(100dvh-49px)] bg-ref-page text-ref-ink";
