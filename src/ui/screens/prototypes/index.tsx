// The comp board: three welcome pages and three consoles side by side in the
// /reference language. A development route for choosing a direction; it never
// touches the saved game.
import { useEffect, useState } from "react";
import { cx } from "../../components/arcane/classes.ts";
import { HomeCatalog, HomeIndex, HomeTonight } from "./home.tsx";
import { useProtoHome, useProtoTable } from "./parts.tsx";
import { TableConsole, TableLedger, TableSheet } from "./table.tsx";

type Screen = "home" | "table";
type Variant = "a" | "b" | "c";

const VARIANTS: Record<Screen, Array<{ id: Variant; name: string; thesis: string }>> = {
  home: [
    { id: "a", name: "Index", thesis: "one document — title, shelf, scripts" },
    { id: "b", name: "Tonight", thesis: "the first night leads the page" },
    { id: "c", name: "Catalog", thesis: "scripts, team mix, full first night" },
  ],
  table: [
    { id: "a", name: "Sheet", thesis: "one sheet — the step and its targets" },
    { id: "b", name: "Console", thesis: "rail, seat tiles, fixed dock" },
    { id: "c", name: "Ledger", thesis: "roster table with an inspector" },
  ],
};

function readChoice(): { screen: Screen; variant: Variant; phone: boolean } {
  const params = new URLSearchParams(window.location.search);
  const variant = params.get("variant");
  return {
    screen: params.get("screen") === "table" ? "table" : "home",
    variant: variant === "b" || variant === "c" ? variant : "a",
    phone: params.get("w") === "390",
  };
}

export function PrototypesScreen() {
  const [choice, setChoice] = useState(readChoice);
  const home = useProtoHome();
  const table = useProtoTable();

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("screen", choice.screen);
    params.set("variant", choice.variant);
    if (choice.phone) params.set("w", "390");
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }, [choice]);

  const set = (patch: Partial<typeof choice>) =>
    setChoice((previous) => ({ ...previous, ...patch }));
  const comp =
    choice.screen === "home"
      ? {
          a: <HomeIndex data={home} />,
          b: <HomeTonight data={home} />,
          c: <HomeCatalog data={home} />,
        }
      : {
          a: <TableSheet data={table} />,
          b: <TableConsole data={table} />,
          c: <TableLedger data={table} />,
        };

  const tab = (active: boolean) =>
    cx(
      "min-h-8 rounded-[4px] px-2.5 transition-colors",
      active ? "bg-[#242424] text-[#f0f0f0]" : "hover:text-[#cfcfcf]",
    );

  return (
    <div className="min-h-dvh bg-ref-page">
      <header className="sticky top-0 z-[60] border-b border-[#2a2a2a] bg-[#0b0b0b] font-case text-[11px] font-medium tracking-[.1em] text-[#8a8a8a] uppercase">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 min-[720px]:flex-nowrap">
          <span className="text-[#e6e6e6]">Prototypes</span>
          <span className="h-4 w-px bg-[#2a2a2a]" aria-hidden="true" />
          <div className="flex items-center gap-0.5" role="group" aria-label="Screen">
            {(["home", "table"] as const).map((screen) => (
              <button
                key={screen}
                type="button"
                className={tab(choice.screen === screen)}
                aria-pressed={choice.screen === screen}
                onClick={() => set({ screen })}
              >
                {screen === "home" ? "Home" : "Table"}
              </button>
            ))}
          </div>
          <span className="h-4 w-px bg-[#2a2a2a]" aria-hidden="true" />
          <div className="flex items-center gap-0.5" role="group" aria-label="Variant">
            {VARIANTS[choice.screen].map((variant) => (
              <button
                key={variant.id}
                type="button"
                className={tab(choice.variant === variant.id)}
                aria-pressed={choice.variant === variant.id}
                onClick={() => set({ variant: variant.id })}
              >
                {variant.id.toUpperCase()} · {variant.name}
              </button>
            ))}
          </div>
          <span className="hidden text-[#6f6f6f] normal-case tracking-normal min-[1100px]:inline">
            {VARIANTS[choice.screen].find((item) => item.id === choice.variant)?.thesis}
          </span>
          <div
            className="ml-auto hidden items-center gap-0.5 min-[720px]:flex"
            role="group"
            aria-label="Width"
          >
            <button
              type="button"
              className={tab(!choice.phone)}
              aria-pressed={!choice.phone}
              onClick={() => set({ phone: false })}
            >
              Desktop
            </button>
            <button
              type="button"
              className={tab(choice.phone)}
              aria-pressed={choice.phone}
              onClick={() => set({ phone: true })}
            >
              390
            </button>
          </div>
        </div>
      </header>
      <div className={choice.phone ? "mx-auto w-[390px] max-w-full border-x border-[#2a2a2a]" : ""}>
        {comp[choice.variant]}
      </div>
    </div>
  );
}
