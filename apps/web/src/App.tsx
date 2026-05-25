import { EventRiver } from "./components/EventRiver";
import { FailureInjector } from "./components/FailureInjector";
import { SessionPane } from "./components/SessionPane";
import { WitnessConsole } from "./components/WitnessConsole";
import { runtimeMode } from "./lib/runtime";

export function App() {
  const isShowcaseMode = runtimeMode === "emulator";

  return (
    <main className="rcc-app-shell">
      <header className="rcc-topbar">
        <div className="topbar-wordmark">
          <div className="topbar-dot" />
          <strong>River Control Center</strong>
          <span>One River · realtime demo</span>
        </div>
        <div className="topbar-right">
          <span className={`badge ${isShowcaseMode ? "is-showcase" : "is-ok"}`}>
            {isShowcaseMode ? "showcase emulator" : "full-stack runtime"}
          </span>
        </div>
      </header>

      {isShowcaseMode ? (
        <section className="runtime-notice" aria-label="Showcase runtime notice">
          <strong>Hosted showcase mode</strong>
          <span>
            This public deployment emulates the backend in the browser for
            low-cost hosting. Clone the repository and run <code>pnpm dev</code>
            to use the full RiverGen app with the real API, WebSocket server,
            and verification path.
          </span>
        </section>
      ) : null}

      <section className="rcc-main-grid">
        <SessionPane sessionId="alice" />
        <EventRiver />
        <SessionPane sessionId="bob" />
      </section>

      <section className="rcc-lab-grid">
        <FailureInjector />
        <WitnessConsole />
      </section>
    </main>
  );
}
