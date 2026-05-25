import { EventRiver } from "./components/EventRiver";
import { FailureInjector } from "./components/FailureInjector";
import { SessionPane } from "./components/SessionPane";
import { WitnessConsole } from "./components/WitnessConsole";

export function App() {
  return (
    <main className="rcc-app-shell">
      <header className="rcc-topbar">
        <div className="topbar-wordmark">
          <div className="topbar-dot" />
          <strong>River Control Center</strong>
          <span>One River · realtime demo</span>
        </div>
        <div className="topbar-right" />
      </header>

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
