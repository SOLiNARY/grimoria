// The welcome page: a steel catalog of the three official scripts, their team
// mix and the full first-night order, with one blue action per viewport. It
// reads the catalog and the saved game; it never changes the game.
import { useEffect, useState, type ReactNode } from "react";
import { nightSequence } from "../../core/model/rules.ts";
import type { Role } from "../../core/model/types.ts";
import { cx } from "../components/arcane/classes.ts";
import { ArcaneAppBar } from "../components/arcane/index.ts";
import { useShellPorts } from "../ports.ts";
import { useGame } from "../store/use-game.ts";
import { APP_VERSION } from "../version.ts";

const TEAMS = ["townsfolk", "outsider", "minion", "demon"] as const;
type TeamKey = (typeof TEAMS)[number];

const TEAM_BAR: Record<TeamKey, string> = {
  townsfolk: "bg-townsfolk",
  outsider: "bg-outsider",
  minion: "bg-minion",
  demon: "bg-demon",
};

const SCRIPTS = ["tb", "bmr", "snv"] as const;
const SCRIPT_NAME: Record<(typeof SCRIPTS)[number], string> = {
  tb: "sheetScenarioTb",
  bmr: "sheetScenarioBmr",
  snv: "sheetScenarioSnv",
};
const SAMPLE: Record<(typeof SCRIPTS)[number], string[]> = {
  tb: ["washerwoman", "chef", "empath", "imp"],
  bmr: ["grandmother", "gossip", "assassin", "zombuul"],
  snv: ["clockmaker", "savant", "witch", "vortox"],
};

const HOME_ACTION =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] px-4 text-[14px] font-medium leading-none transition-colors focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2";
const HOME_CARD = "rounded-[16px] border border-edge bg-crypt-2";

function RoleDisc({ role, size = 36 }: { role: Role; size?: 28 | 36 }) {
  const ports = useShellPorts();
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center rounded-full bg-label",
        size === 28 ? "size-7" : "size-9",
      )}
      aria-hidden="true"
    >
      <img className="h-[80%] w-[80%] object-contain" src={ports.roles.image(role)} alt="" />
    </span>
  );
}

function HomePrimary({
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
        HOME_ACTION,
        "bg-amber font-semibold text-white hover:bg-amber-2 active:bg-amber-active",
        full && "w-full",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function HomeSecondary({
  children,
  full,
  onClick,
}: {
  children: ReactNode;
  full?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={cx(
        HOME_ACTION,
        "border border-edge bg-crypt-3 text-text hover:border-accent-text",
        full && "w-full",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function HomeScreen() {
  const ports = useShellPorts();
  const snapshot = useGame(ports.game);
  const state = snapshot.state;
  const t = ports.strings.t;
  const live = state.phase !== "setup";
  const go = (route: string) => ports.router.go(route);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const all = ports.roles
    .all()
    .filter(
      (role) =>
        role.team !== "traveller" &&
        (role.edition === "tb" || role.edition === "bmr" || role.edition === "snv"),
    );

  const editions = SCRIPTS.map((id) => {
    const roles = all.filter((role) => role.edition === id);
    const teams: Record<TeamKey, number> = {
      townsfolk: roles.filter((role) => role.team === "townsfolk").length,
      outsider: roles.filter((role) => role.team === "outsider").length,
      minion: roles.filter((role) => role.team === "minion").length,
      demon: roles.filter((role) => role.team === "demon").length,
    };
    return {
      id,
      name: t(SCRIPT_NAME[id]),
      count: roles.length,
      teams,
      sample: SAMPLE[id]
        .map((roleId) => ports.roles.byId(roleId))
        .filter((role): role is Role => role !== null),
    };
  });

  const order = nightSequence(1, "tb")
    .map((id) => ports.roles.byId(id))
    .filter((role): role is Role => role !== null);

  return (
    <>
      <ArcaneAppBar current="home" />
      <main className="min-h-[calc(100dvh-3.5rem)] bg-crypt px-4 pt-8 pb-14 text-text min-[900px]:px-8 min-[900px]:pt-10">
        <div className="mx-auto w-full max-w-[1240px]">
          <header className="border-b border-edge pb-6 min-[900px]:flex min-[900px]:items-end min-[900px]:justify-between min-[900px]:gap-12">
            <h1 className="max-w-[13ch] text-[clamp(40px,6.2vw,78px)] leading-[0.94] font-semibold tracking-[-0.035em] text-balance">
              {t("homeTitle")}
            </h1>
            <div className="mt-6 min-w-0 min-[900px]:mt-0 min-[900px]:w-[330px] min-[900px]:shrink-0">
              <p className="text-[15px] leading-[24px] text-muted">{t("homeLead")}</p>
              <div className="mt-5 flex flex-col gap-2 min-[420px]:flex-row min-[900px]:flex-col">
                <HomePrimary full onClick={() => go("/bag")}>
                  {t("homeStart")}
                </HomePrimary>
                {live ? (
                  <HomeSecondary full onClick={() => go("/table")}>
                    {t("homeContinueCase")}
                  </HomeSecondary>
                ) : (
                  <HomeSecondary full onClick={() => go("/demo")}>
                    {t("homeRunDemo")}
                  </HomeSecondary>
                )}
              </div>
            </div>
          </header>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-muted">
            <span>
              <b className="font-medium tabular-nums text-text">{all.length}</b> {t("roles")}
            </span>
            <span>5–15 {t("players")}</span>
            <span>RU EN AZ</span>
          </div>

          <h2 className="mt-8 text-[16px] leading-[24px] font-semibold">{t("scriptOfficial")}</h2>

          <section className="mt-3 grid gap-3 min-[760px]:grid-cols-3">
            {editions.map((edition, index) => {
              const scale = edition.count || 1;
              return (
                <article
                  key={edition.id}
                  className={cx(HOME_CARD, "flex min-h-[248px] flex-col p-4")}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[11px] font-semibold tracking-[.12em] uppercase text-muted">
                      {edition.id}
                    </span>
                    <span className="text-[12px] tabular-nums text-muted">
                      {edition.count} {t("roles")}
                    </span>
                  </div>
                  <h3 className="mt-2 text-[22px] leading-[26px] font-semibold tracking-[-0.02em]">
                    {edition.name}
                  </h3>

                  <div className="mt-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-crypt" aria-hidden="true">
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
                          <dt className="flex min-w-0 items-center gap-1.5 text-muted">
                            <span
                              className={cx(
                                "inline-block size-1.5 shrink-0 rounded-full",
                                TEAM_BAR[team],
                              )}
                              aria-hidden="true"
                            />
                            <span className="truncate">{t(team)}</span>
                          </dt>
                          <dd className="m-0 tabular-nums text-text">{edition.teams[team]}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    {edition.sample.map((role) => (
                      <RoleDisc key={role.id} role={role} />
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-end border-t border-edge pt-3">
                    <a
                      className="text-[13px] text-muted transition-colors hover:text-text"
                      href={ports.router.path("sheet")}
                    >
                      {t("roleList")} →
                    </a>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="mt-9 border-t border-edge pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-[16px] leading-[24px] font-semibold">{t("firstNightList")}</h2>
                <span className="text-[12px] text-muted">
                  {t("sheetScenarioTb")} · {t("night")} 1
                </span>
              </div>
              <span className="text-[12px] tabular-nums text-muted">
                01–{String(order.length).padStart(2, "0")}
              </span>
            </div>
            <ol className="mt-4 grid list-none grid-cols-2 gap-x-5 gap-y-2.5 p-0 min-[560px]:grid-cols-3 min-[760px]:grid-cols-4 min-[1000px]:grid-cols-7">
              {order.map((role, index) => (
                <li key={role.id} className="flex min-w-0 items-center gap-2">
                  <span className="w-4 shrink-0 text-[10px] tabular-nums text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <RoleDisc role={role} size={28} />
                  <span className="truncate text-[12px] leading-[16px]">{role.name}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className={cx(HOME_CARD, "mt-9 px-4 py-5 min-[760px]:px-6 min-[760px]:py-6")}>
            <div className="grid gap-6 min-[760px]:grid-cols-[1.1fr_1fr_auto] min-[760px]:items-center">
              <div className="min-w-0">
                <h2 className="text-[16px] leading-[24px] font-semibold">{t("homeHow")}</h2>
                <p className="mt-1 max-w-[44ch] text-[13px] leading-[20px] text-muted">
                  {t("homeSupportLead")}
                </p>
              </div>
              <div className="min-w-0">
                <h2 className="text-[16px] leading-[24px] font-semibold">{t("homeOffline")}</h2>
                <p className="mt-1 max-w-[44ch] text-[13px] leading-[20px] text-muted">
                  {t("homeOfflineLead")}
                </p>
              </div>
              <div className="min-w-0 min-[760px]:shrink-0">
                <HomePrimary className="w-full min-[760px]:w-auto" onClick={() => go("/bag")}>
                  {t("homeStart")}
                </HomePrimary>
              </div>
            </div>
          </section>

          <p className="mt-6 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <span className="tabular-nums">Grimoria v{APP_VERSION}</span>
            <span aria-hidden="true">·</span>
            <a className="transition-colors hover:text-text" href={ports.router.path("changelog")}>
              {t("changelog")}
            </a>
          </p>
        </div>
      </main>
    </>
  );
}
