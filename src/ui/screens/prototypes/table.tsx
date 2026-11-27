// Three console comps in the /reference language: one sheet, one workstation,
// one roster ledger. The shared action row carries the same controls in each.
import { cx } from "../../components/arcane/classes.ts";
import { useShellPorts } from "../../ports.ts";
import {
  CARD,
  DeadMark,
  LABEL,
  PAGE,
  Primary,
  Quiet,
  Secondary,
  TeamDot,
  Token,
  usePick,
} from "./parts.tsx";
import type { ProtoTable } from "./parts.tsx";

const NAV: Array<[string, string]> = [
  ["table", "table"],
  ["player", "navPlayer"],
  ["seat", "seats"],
  ["secrets", "secrets"],
  ["bag", "navBag"],
  ["sheet", "roleSheet"],
];

function TableNav({ active }: { active: string }) {
  const t = useShellPorts().strings.t;
  return (
    <nav className="hidden items-center gap-4 text-[13px] whitespace-nowrap min-[760px]:flex">
      {NAV.map(([route, key]) => (
        <span key={route} className={route === active ? "text-ref-ink" : "text-ref-dim"}>
          {t(key)}
        </span>
      ))}
    </nav>
  );
}

export function TableSheet({ data }: { data: ProtoTable }) {
  const ports = useShellPorts();
  const t = ports.strings.t;
  const pick = usePick(2);
  const progress = Math.round((data.stepOrder / data.stepTotal) * 100);
  return (
    <main className={cx(PAGE, "px-3 py-4 min-[560px]:px-5 min-[560px]:py-6")}>
      <div className="mx-auto w-full max-w-[880px]">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium tracking-[.1em] uppercase text-ref-dim">
          <span>Grimoria · {data.edition}</span>
          <span className="flex items-center gap-4">
            <span className="text-ref-muted">{t("menu")}</span>
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-ref-muted" aria-hidden="true" />
              {t("night")} {data.night}
            </span>
          </span>
        </div>

        <article className={cx(CARD, "mt-3 p-4 min-[560px]:p-6")}>
          <div className="flex items-center justify-between gap-4">
            <h1 className="min-w-0 text-[26px] leading-[30px] font-semibold tracking-[-0.02em] min-[560px]:text-[30px]">
              {data.role.name}
            </h1>
            <Token role={data.role} size={56} />
          </div>
          <p className="mt-1 max-w-[56ch] text-[13px] leading-[20px] text-ref-muted">
            {data.role.ability}
          </p>

          <div className="mt-5 border-t border-ref-divider pt-4">
            <p className="m-0 text-[16px] leading-[25px]">{data.question}</p>
            <div className="mt-3 grid gap-1 min-[520px]:grid-cols-2">
              {data.seats.map((seat) => {
                const on = pick.has(String(seat.seat));
                return (
                  <button
                    key={seat.seat}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pick.toggle(String(seat.seat))}
                    className={cx(
                      "flex min-h-12 w-full items-center gap-2.5 rounded-[8px] border px-2 py-1.5 text-left transition-colors focus-visible:outline-ref-ink",
                      on
                        ? "border-ref-ink bg-[#2b2b2b]"
                        : "border-transparent hover:border-ref-rule hover:bg-ref-well",
                      !seat.alive && "opacity-50",
                    )}
                  >
                    <span className="w-5 shrink-0 text-[11px] tabular-nums text-ref-dim">
                      {String(seat.seat).padStart(2, "0")}
                    </span>
                    <Token role={seat.role} size={28} />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cx(
                          "block truncate text-[14px] leading-[18px] font-medium",
                          !seat.alive && "line-through",
                        )}
                      >
                        {seat.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-[15px] text-ref-dim">
                        <TeamDot team={seat.role.team} />
                        {seat.role.name}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-ref-divider pt-4">
            <div className="flex flex-wrap gap-2">
              <Primary disabled={pick.ids.length === 0} onClick={pick.clear}>
                {t("confirmTarget")}
              </Primary>
              <Secondary onClick={pick.clear}>{t("skipWake")}</Secondary>
            </div>
            <Quiet onClick={pick.clear}>{t("undo")}</Quiet>
          </div>
        </article>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-ref-rule" aria-hidden="true">
            <div className="h-full rounded-full bg-ref-ink" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[11px] tabular-nums text-ref-dim">
            {data.stepOrder} / {data.stepTotal}
          </span>
        </div>
        <p className="mt-4 text-center text-[11px] text-ref-dim">
          Пример партии · визуальный прототип · данные не сохраняются
        </p>
      </div>
    </main>
  );
}

export function TableConsole({ data }: { data: ProtoTable }) {
  const ports = useShellPorts();
  const t = ports.strings.t;
  const pick = usePick(2);
  return (
    <div className={cx(PAGE, "flex flex-col")}>
      <header className="border-b border-[#262626] px-4 min-[900px]:px-6">
        <div className="mx-auto flex min-h-14 w-full max-w-[1200px] items-center gap-4">
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Grimoria</span>
          <span className="truncate text-[12px] text-ref-dim">{data.edition}</span>
          <div className="ml-auto">
            <TableNav active="table" />
          </div>
          <span className="ml-auto text-[12px] text-ref-dim min-[760px]:hidden">{t("menu")}</span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1200px] min-h-0 flex-1 flex-col min-[900px]:flex-row">
        <aside className="border-b border-[#262626] px-4 py-4 min-[900px]:w-[268px] min-[900px]:shrink-0 min-[900px]:border-b-0 min-[900px]:border-r min-[900px]:px-5 min-[900px]:py-5">
          <div className="flex items-baseline justify-between gap-2">
            <h1 className="text-[24px] leading-[28px] font-semibold tracking-[-0.02em]">
              {t("night")} {data.night}
            </h1>
            <span className="text-[12px] tabular-nums text-ref-dim">
              {data.stepOrder} / {data.stepTotal}
            </span>
          </div>
          <ol className="mt-4 hidden list-none p-0 min-[900px]:block">
            {data.queue.map((item) => (
              <li
                key={item.order}
                className={cx(
                  "flex items-center gap-2.5 border-b border-ref-rule py-2.5",
                  item.current && "text-ref-ink",
                )}
              >
                <span className="w-4 shrink-0 text-[11px] tabular-nums text-ref-dim">
                  {item.order}
                </span>
                {item.current ? (
                  <span className="size-1 shrink-0 rounded-full bg-ref-ink" aria-hidden="true" />
                ) : (
                  <span className="size-1 shrink-0 rounded-full bg-ref-rule" aria-hidden="true" />
                )}
                <span
                  className={cx(
                    "min-w-0 truncate text-[13px]",
                    item.current
                      ? "font-medium text-ref-ink"
                      : item.done
                        ? "text-ref-dim line-through"
                        : "text-ref-muted",
                  )}
                >
                  {item.role.name}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-ref-divider pt-3 text-[12px] text-ref-muted min-[900px]:mt-5">
            <span>{t("dawnSurvivors", { living: data.living, total: data.total })}</span>
            <span>
              {t("threshold")} {data.threshold}
            </span>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 min-[900px]:px-6 min-[900px]:py-6">
          <article className={cx(CARD, "p-4 min-[560px]:p-5")}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[22px] leading-[26px] font-semibold tracking-[-0.02em]">
                    {data.role.name}
                  </h2>
                  <span className="rounded-[6px] border border-ref-rule px-2 py-0.5 text-[11px] font-medium text-ref-muted">
                    {t("currentStep")}
                  </span>
                </div>
                <p className="mt-1 max-w-[56ch] text-[13px] leading-[20px] text-ref-muted">
                  {data.role.ability}
                </p>
              </div>
              <Token role={data.role} size={44} />
            </div>
            <p className="mt-3 border-t border-ref-rule pt-3 text-[15px] leading-[23px]">
              {data.question}
            </p>
          </article>

          <div className="mt-4 flex items-baseline justify-between gap-3">
            <h2 className={LABEL}>{t("seats")}</h2>
            <span className="text-[12px] tabular-nums text-ref-dim">{pick.ids.length} / 2</span>
          </div>
          <ul className="mt-2 grid list-none grid-cols-2 gap-2 p-0 min-[640px]:grid-cols-4">
            {data.seats.map((seat) => {
              const on = pick.has(String(seat.seat));
              return (
                <li key={seat.seat}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => pick.toggle(String(seat.seat))}
                    className={cx(
                      "flex h-full w-full flex-col rounded-[12px] border p-3 text-left transition-colors focus-visible:outline-ref-ink",
                      on
                        ? "border-ref-ink bg-[#2b2b2b]"
                        : "border-ref-rule bg-[#191919] hover:border-ref-muted",
                      !seat.alive && "opacity-45",
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-[11px] tabular-nums text-ref-dim">
                        {String(seat.seat).padStart(2, "0")}
                      </span>
                      <TeamDot team={seat.role.team} />
                    </span>
                    <span className="mt-2">
                      <Token role={seat.role} size={40} />
                    </span>
                    <span
                      className={cx(
                        "mt-2 block w-full truncate text-[13px] leading-[17px] font-medium",
                        !seat.alive && "line-through",
                      )}
                    >
                      {seat.name}
                    </span>
                    <span className="mt-0.5 block w-full truncate text-[11px] leading-[15px] text-ref-muted">
                      {seat.role.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </main>
      </div>

      <footer className="sticky bottom-0 border-t border-[#262626] bg-[#141414]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 py-3 min-[560px]:flex-row min-[560px]:items-center min-[900px]:px-6">
          <Quiet onClick={pick.clear} className="order-last min-[560px]:order-first">
            {t("undo")}
          </Quiet>
          <span className="hidden flex-1 min-[560px]:block" />
          <div className="flex flex-col-reverse gap-2 min-[560px]:flex-row">
            <Secondary onClick={pick.clear} className="min-[560px]:min-w-[140px]">
              {t("skipWake")}
            </Secondary>
            <Primary
              disabled={pick.ids.length === 0}
              onClick={pick.clear}
              className="min-[560px]:min-w-[170px]"
            >
              {t("confirmTarget")}
            </Primary>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function TableLedger({ data }: { data: ProtoTable }) {
  const ports = useShellPorts();
  const t = ports.strings.t;
  const pick = usePick(2);
  const chosen = data.seats.filter((seat) => pick.has(String(seat.seat)));
  return (
    <main className={cx(PAGE, "px-3 py-4 min-[560px]:px-6 min-[560px]:py-6")}>
      <div className="mx-auto w-full max-w-[1180px]">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-ref-divider pb-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[26px] leading-[30px] font-semibold tracking-[-0.02em]">
              {t("table")}
            </h1>
            <span className="truncate text-[12px] text-ref-dim">{data.edition}</span>
          </div>
          <div className="flex items-center gap-4">
            <TableNav active="table" />
            <span className="text-[12px] text-ref-dim min-[760px]:hidden">{t("menu")}</span>
          </div>
        </header>

        <div className="mt-5 grid gap-4 min-[900px]:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)] min-[900px]:gap-6">
          <section className="order-2 min-w-0 min-[900px]:order-1">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className={LABEL}>{t("seats")}</h2>
              <span className="text-[12px] tabular-nums text-ref-dim">
                {data.living} {t("alive")} · {t("threshold")} {data.threshold}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-[28px_minmax(0,1fr)_minmax(0,0.9fr)] items-center gap-2 border-b border-ref-divider pb-2 text-[11px] font-medium text-ref-dim">
              <span>№</span>
              <span>{t("navPlayer")}</span>
              <span>{t("role")}</span>
            </div>

            <ul className="list-none p-0">
              {data.seats.map((seat) => {
                const on = pick.has(String(seat.seat));
                return (
                  <li key={seat.seat}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => pick.toggle(String(seat.seat))}
                      className={cx(
                        "grid min-h-12 w-full grid-cols-[28px_minmax(0,1fr)_minmax(0,0.9fr)] items-center gap-2 border-b border-ref-rule px-1 py-2 text-left transition-colors focus-visible:outline-ref-ink",
                        on ? "bg-[#262626]" : "hover:bg-ref-well",
                        !seat.alive && "opacity-50",
                      )}
                    >
                      <span className="text-[12px] tabular-nums text-ref-dim">
                        {String(seat.seat).padStart(2, "0")}
                      </span>
                      <span className="flex min-w-0 items-center gap-2">
                        <Token role={seat.role} size={28} />
                        <span
                          className={cx(
                            "truncate text-[14px] leading-[18px] font-medium",
                            !seat.alive && "line-through",
                          )}
                        >
                          {seat.name}
                        </span>
                        {!seat.alive && <DeadMark />}
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ref-muted">
                        <TeamDot team={seat.role.team} />
                        <span className="truncate">{seat.role.name}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="order-1 min-w-0 self-start min-[900px]:order-2 min-[900px]:sticky min-[900px]:top-5">
            <article className={cx(CARD, "p-4")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[20px] leading-[24px] font-semibold tracking-[-0.02em]">
                      {data.role.name}
                    </h2>
                    <span className="rounded-[6px] border border-ref-rule px-2 py-0.5 text-[11px] font-medium text-ref-muted">
                      {t("currentStep")}
                    </span>
                  </div>
                </div>
                <Token role={data.role} size={44} />
              </div>
              <p className="mt-2 max-w-[40ch] text-[13px] leading-[20px] text-ref-muted">
                {data.role.ability}
              </p>
              <div className="mt-3 border-t border-ref-rule pt-3">
                <p className="m-0 text-[15px] leading-[23px]">{data.question}</p>
                <div className="mt-2 flex min-h-8 flex-wrap items-center gap-1.5">
                  {chosen.length === 0 ? (
                    <span className="text-[12px] text-ref-dim">{t("chooseTarget")}</span>
                  ) : (
                    chosen.map((seat) => (
                      <span
                        key={seat.seat}
                        className="rounded-[6px] bg-ref-well px-2 py-1 text-[12px] leading-[15px]"
                      >
                        {seat.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <Primary full disabled={pick.ids.length === 0} onClick={pick.clear}>
                  {t("confirmTarget")}
                </Primary>
                <Secondary full onClick={pick.clear}>
                  {t("skipWake")}
                </Secondary>
                <Quiet full onClick={pick.clear}>
                  {t("undo")}
                </Quiet>
              </div>
            </article>

            <dl className="mt-3 grid grid-cols-3 divide-x divide-ref-rule rounded-[12px] border border-ref-rule bg-ref-surface">
              {[
                [String(data.living), t("alive")],
                [String(data.threshold), t("threshold")],
                [String(data.total - data.living), t("deadCount")],
              ].map(([value, label]) => (
                <div key={label} className="px-3 py-2.5">
                  <dt className="text-[10px] leading-[14px] tracking-[.06em] uppercase text-ref-dim">
                    {label}
                  </dt>
                  <dd className="m-0 mt-0.5 text-[18px] leading-[22px] font-semibold tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>

        <p className="mt-5 text-[11px] text-ref-dim">
          Пример партии · визуальный прототип · данные не сохраняются
        </p>
      </div>
    </main>
  );
}
