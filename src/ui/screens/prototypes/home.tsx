// Three welcome-page comps in the /reference language: a document, a
// briefing and a catalog. All content comes from the catalog; the shelf is
// labelled as an example.
import { useEffect, useState, type ReactNode } from "react";
import { cx } from "../../components/arcane/classes.ts";
import { useShellPorts } from "../../ports.ts";
import { CARD, PAGE, Primary, Secondary, TeamDot, Token } from "./parts.tsx";
import type { ProtoHome, ProtoTeam } from "./parts.tsx";

export function HomeIndex({ data }: { data: ProtoHome }) {
  const ports = useShellPorts();
  const t = ports.strings.t;
  const teamText = ports.strings.teamText;
  return (
    <main className={cx(PAGE, "px-3 py-6 min-[560px]:px-5 min-[560px]:py-10")}>
      <article
        className={cx(
          CARD,
          "mx-auto w-full max-w-[792px] px-4 py-5 min-[560px]:px-6 min-[560px]:py-7",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-ref-divider pb-4">
          <span className="text-[11px] font-semibold tracking-[.14em] uppercase text-ref-dim">
            Grimoria · {t("caseFile")}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-[.1em] uppercase text-ref-dim">
            <span className="size-1.5 rounded-full bg-[#67c188]" aria-hidden="true" />
            {t("homeOffline")}
          </span>
        </div>

        <h1 className="mt-6 max-w-[15ch] text-[clamp(34px,4.4vw,46px)] leading-[1.02] font-semibold tracking-[-0.03em] text-balance">
          {t("homeTitle")}
        </h1>
        <p className="mt-4 max-w-[52ch] text-[15px] leading-[25px] text-ref-muted">
          {t("homeLead")}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Primary>{t("homeStart")}</Primary>
          <Secondary>{t("homeRunDemo")}</Secondary>
        </div>
        <p className="mt-3 text-[12px] leading-[18px] text-ref-muted">{t("homeMemberLead")}</p>

        <section className="mt-7 border-t border-ref-divider pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[16px] leading-[24px] font-semibold">{t("firstNightList")}</h2>
            <span className="text-[12px] text-ref-dim">{t("homeSampleNight")}</span>
          </div>
          <ul className="mt-2 grid list-none grid-cols-1 gap-x-6 p-0 min-[560px]:grid-cols-2">
            {data.firstNight.map((role, index) => (
              <li key={role.id} className="flex items-center gap-3 border-b border-ref-rule py-2.5">
                <span className="w-5 shrink-0 text-[11px] tabular-nums text-ref-dim">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Token role={role} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] leading-[19px] font-medium">
                    {role.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-[16px] text-ref-muted">
                    <TeamDot team={role.team} />
                    {teamText(role.team)}
                  </span>
                </span>
              </li>
            ))}
            {data.deadRole && (
              <li className="flex items-center gap-3 border-b border-ref-rule py-2.5">
                <span className="w-5 shrink-0 text-[11px] tabular-nums text-ref-dim">—</span>
                <span className="opacity-45 grayscale">
                  <Token role={data.deadRole} size={32} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] leading-[19px] font-medium line-through">
                    {data.deadRole.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-[16px] text-ref-muted">
                    <TeamDot team={data.deadRole.team} />
                    {teamText(data.deadRole.team)}
                  </span>
                </span>
              </li>
            )}
          </ul>
          <p className="mt-3 text-[12px] leading-[18px] text-ref-muted">{t("homeSynthetic")}</p>
        </section>

        <section className="mt-6 border-t border-ref-divider pt-6">
          <h2 className="text-[16px] leading-[24px] font-semibold">{t("scriptOfficial")}</h2>
          <ul className="mt-1 list-none p-0">
            {data.editions.map((edition) => (
              <li key={edition.id} className="flex items-baseline gap-3 py-3">
                <span className="text-[15px] leading-[22px] font-medium">{edition.name}</span>
                <span
                  className="min-w-6 flex-1 -translate-y-[3px] border-b border-dotted border-ref-edge"
                  aria-hidden="true"
                />
                <span className="text-[13px] tabular-nums text-ref-muted">
                  {edition.count} {t("roles")}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 grid gap-5 border-t border-ref-divider pt-6 min-[560px]:grid-cols-2">
          <div>
            <h2 className="text-[15px] leading-[22px] font-semibold">{t("homeHow")}</h2>
            <p className="mt-1 text-[13px] leading-[20px] text-ref-muted">{t("homeSupportLead")}</p>
          </div>
          <div>
            <h2 className="text-[15px] leading-[22px] font-semibold">{t("homeOffline")}</h2>
            <p className="mt-1 text-[13px] leading-[20px] text-ref-muted">{t("homeOfflineLead")}</p>
          </div>
        </section>

        <section className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ref-divider pt-5">
          <p className="m-0 max-w-[44ch] text-[13px] leading-[20px] text-ref-muted">
            {t("homeFormLead")}
          </p>
          <Primary>{t("homeStart")}</Primary>
        </section>
      </article>
    </main>
  );
}

export function HomeTonight({ data }: { data: ProtoHome }) {
  const ports = useShellPorts();
  const t = ports.strings.t;
  const teamText = ports.strings.teamText;
  return (
    <main className={cx(PAGE, "px-4 py-7 min-[900px]:px-6 min-[900px]:py-12")}>
      <div className="mx-auto grid w-full max-w-[1120px] gap-8 min-[960px]:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] min-[960px]:gap-12">
        <div className="min-w-0 self-start min-[960px]:sticky min-[960px]:top-16">
          <div className="flex items-center justify-between gap-3 border-b border-ref-divider pb-3 text-[11px] font-semibold tracking-[.14em] uppercase text-ref-dim">
            <span>Grimoria</span>
            <span>{t("night")} 1</span>
          </div>
          <h1 className="mt-8 text-[clamp(40px,5vw,58px)] leading-[0.98] font-semibold tracking-[-0.035em] text-balance">
            {t("homeTitle")}
          </h1>
          <p className="mt-5 max-w-[40ch] text-[16px] leading-[26px] text-ref-muted">
            {t("homeLead")}
          </p>
          <div className="mt-7 flex flex-col gap-2 min-[420px]:flex-row">
            <Primary>{t("homeStart")}</Primary>
            <Secondary>{t("homeRunDemo")}</Secondary>
          </div>
          <p className="mt-6 border-t border-ref-rule pt-4 text-[12px] leading-[18px] text-ref-dim">
            {t("homeMemberTitle")} · {t("homeOffline")} · RU EN AZ
          </p>
        </div>

        <article className={cx(CARD, "min-w-0 self-start p-4 min-[560px]:p-5")}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[17px] leading-[24px] font-semibold">{t("firstNightList")}</h2>
            <span className="text-[12px] tabular-nums text-ref-dim">{t("night")} 1</span>
          </div>
          <ol className="mt-2 list-none p-0">
            {data.firstNight.map((role, index) => (
              <li key={role.id} className="flex items-center gap-3 border-b border-ref-rule py-3">
                <span className="w-5 shrink-0 text-[11px] tabular-nums text-ref-dim">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Token role={role} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] leading-[20px] font-medium">
                    {role.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ref-muted">
                    <TeamDot team={role.team} />
                    {teamText(role.team)}
                  </span>
                </span>
              </li>
            ))}
            {data.deadRole && (
              <li className="flex items-center gap-3 py-3">
                <span className="w-5 shrink-0 text-[11px] tabular-nums text-ref-dim">—</span>
                <span className="opacity-45 grayscale">
                  <Token role={data.deadRole} size={40} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] leading-[20px] font-medium line-through">
                    {data.deadRole.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ref-muted">
                    <TeamDot team={data.deadRole.team} />
                    {teamText(data.deadRole.team)}
                  </span>
                </span>
              </li>
            )}
          </ol>
          <p className="mt-2 text-[12px] leading-[18px] text-ref-muted">{t("homeSynthetic")}</p>
        </article>
      </div>

      <section className="mx-auto mt-10 w-full max-w-[1120px] border-t border-ref-divider pt-6">
        <h2 className="text-[16px] leading-[24px] font-semibold">{t("scriptOfficial")}</h2>
        <ul className="mt-3 grid list-none gap-x-8 gap-y-4 p-0 min-[760px]:grid-cols-3">
          {data.editions.map((edition) => (
            <li key={edition.id} className="border-t border-ref-rule pt-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[16px] leading-[22px] font-medium">{edition.name}</h3>
                <span className="text-[12px] tabular-nums text-ref-dim">
                  {edition.count} {t("roles")}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                {edition.sample.map((role) => (
                  <Token key={role.id} role={role} size={28} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section
        className={cx(
          CARD,
          "mx-auto mt-10 w-full max-w-[1120px] px-4 py-5 min-[760px]:flex min-[760px]:items-center min-[760px]:justify-between min-[760px]:gap-8 min-[760px]:px-6",
        )}
      >
        <div className="min-w-0">
          <h2 className="text-[18px] leading-[26px] font-semibold">{t("homeHow")}</h2>
          <p className="mt-1 max-w-[56ch] text-[13px] leading-[20px] text-ref-muted">
            {t("homeSupportLead")}
          </p>
        </div>
        <div className="mt-4 shrink-0 min-[760px]:mt-0">
          <Primary>{t("homeStart")}</Primary>
        </div>
      </section>
    </main>
  );
}

const CATALOG_ACTION =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] px-4 text-[14px] font-medium leading-none transition-colors focus-visible:outline-2 focus-visible:outline-steel-ring focus-visible:outline-offset-2";
const CATALOG_CARD = "rounded-[16px] border border-steel-edge bg-steel-surface";
const TEAMS: ProtoTeam[] = ["townsfolk", "outsider", "minion", "demon"];
const TEAM_BAR: Record<ProtoTeam, string> = {
  townsfolk: "bg-townsfolk",
  outsider: "bg-outsider",
  minion: "bg-minion",
  demon: "bg-demon",
};

function CatalogPrimary({
  children,
  full,
  className,
}: {
  children: ReactNode;
  full?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cx(
        CATALOG_ACTION,
        "bg-steel-primary font-semibold text-white hover:bg-steel-primary-hover active:bg-steel-primary-active",
        full && "w-full",
        className,
      )}
    >
      {children}
    </button>
  );
}

function CatalogSecondary({ children, full }: { children: ReactNode; full?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        CATALOG_ACTION,
        "border border-steel-edge bg-steel-raised text-steel-text hover:border-steel-ring",
        full && "w-full",
      )}
    >
      {children}
    </button>
  );
}

export function HomeCatalog({ data }: { data: ProtoHome }) {
  const ports = useShellPorts();
  const t = ports.strings.t;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <main className="min-h-[calc(100dvh-49px)] bg-steel-bg px-4 py-6 text-steel-text min-[900px]:px-8 min-[900px]:py-8">
      <div className="mx-auto w-full max-w-[1240px]">
        <header className="border-b border-steel-edge pb-6 min-[900px]:flex min-[900px]:items-end min-[900px]:justify-between min-[900px]:gap-12">
          <div className="min-w-0">
            <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[.14em] uppercase text-steel-muted">
              <span>Grimoria</span>
              <span className="h-px w-6 bg-steel-edge" aria-hidden="true" />
              <span>{t("caseFile")}</span>
            </div>
            <h1 className="mt-5 max-w-[13ch] text-[clamp(42px,6.4vw,80px)] leading-[0.94] font-semibold tracking-[-0.035em] text-balance">
              {t("homeTitle")}
            </h1>
          </div>
          <div className="mt-6 min-w-0 min-[900px]:mt-0 min-[900px]:w-[330px] min-[900px]:shrink-0">
            <p className="text-[15px] leading-[24px] text-steel-muted">{t("homeLead")}</p>
            <div className="mt-5 flex flex-col gap-2 min-[420px]:flex-row min-[900px]:flex-col">
              <CatalogPrimary full>{t("homeStart")}</CatalogPrimary>
              <CatalogSecondary full>{t("homeRunDemo")}</CatalogSecondary>
            </div>
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-steel-muted">
          <span>
            <b className="font-medium tabular-nums text-steel-text">{data.total}</b> {t("roles")}
          </span>
          <span>5–15 {t("players")}</span>
          <span>RU EN AZ</span>
        </div>

        <h2 className="mt-8 text-[16px] leading-[24px] font-semibold">{t("scriptOfficial")}</h2>

        <section className="mt-3 grid gap-3 min-[760px]:grid-cols-3">
          {data.editions.map((edition, index) => {
            const scale = edition.count || 1;
            return (
              <article
                key={edition.id}
                className={cx(CATALOG_CARD, "flex min-h-[248px] flex-col p-4")}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] font-semibold tracking-[.12em] uppercase text-steel-muted">
                    {edition.id}
                  </span>
                  <span className="text-[12px] tabular-nums text-steel-muted">
                    {edition.count} {t("roles")}
                  </span>
                </div>
                <h2 className="mt-2 text-[22px] leading-[26px] font-semibold tracking-[-0.02em]">
                  {edition.name}
                </h2>

                <div className="mt-4">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-steel-bg"
                    aria-hidden="true"
                  >
                    <div
                      className={cx(
                        "flex h-full origin-left transition-transform duration-700 ease-out",
                        ready ? "scale-x-100" : "scale-x-0",
                      )}
                      style={{ transitionDelay: `${index * 110}ms` }}
                    >
                      {TEAMS.map((team) => (
                        <span
                          key={team}
                          className={cx("h-full shrink-0", TEAM_BAR[team])}
                          style={{ width: `${(edition.teams[team] / scale) * 100}%` }}
                        />
                      ))}
                    </div>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] leading-[15px]">
                    {TEAMS.map((team) => (
                      <div key={team} className="flex items-center justify-between gap-2">
                        <dt className="flex min-w-0 items-center gap-1.5 text-steel-muted">
                          <TeamDot team={team} />
                          <span className="truncate">{t(team)}</span>
                        </dt>
                        <dd className="m-0 tabular-nums text-steel-text">{edition.teams[team]}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  {edition.sample.map((role) => (
                    <Token key={role.id} role={role} size={36} disc="bg-steel-role" />
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-end border-t border-steel-edge pt-3">
                  <span className="text-[13px] text-steel-muted">{t("roleList")} →</span>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-9 border-t border-steel-edge pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-[16px] leading-[24px] font-semibold">{t("firstNightList")}</h2>
              <span className="text-[12px] text-steel-muted">
                {data.editions[0]?.name} · {t("night")} 1
              </span>
            </div>
            <span className="text-[12px] tabular-nums text-steel-muted">
              01–{String(data.firstNightOrder.length).padStart(2, "0")}
            </span>
          </div>
          <ol className="mt-4 grid list-none grid-cols-2 gap-x-5 gap-y-2.5 p-0 min-[560px]:grid-cols-3 min-[760px]:grid-cols-4 min-[1000px]:grid-cols-7">
            {data.firstNightOrder.map((role, index) => (
              <li key={role.id} className="flex min-w-0 items-center gap-2">
                <span className="w-4 shrink-0 text-[10px] tabular-nums text-steel-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Token role={role} size={28} disc="bg-steel-role" />
                <span className="truncate text-[12px] leading-[16px]">{role.name}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={cx(CATALOG_CARD, "mt-9 px-4 py-5 min-[760px]:px-6 min-[760px]:py-6")}>
          <div className="grid gap-6 min-[760px]:grid-cols-[1.1fr_1fr_auto] min-[760px]:items-center">
            <div className="min-w-0">
              <h2 className="text-[16px] leading-[24px] font-semibold">{t("homeHow")}</h2>
              <p className="mt-1 max-w-[44ch] text-[13px] leading-[20px] text-steel-muted">
                {t("homeSupportLead")}
              </p>
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] leading-[24px] font-semibold">{t("homeOffline")}</h2>
              <p className="mt-1 max-w-[44ch] text-[13px] leading-[20px] text-steel-muted">
                {t("homeOfflineLead")}
              </p>
            </div>
            <div className="shrink-0">
              <CatalogPrimary className="w-full min-[760px]:w-auto">
                {t("homeStart")}
              </CatalogPrimary>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
