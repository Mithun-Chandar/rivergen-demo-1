import { EventRiver } from "./components/EventRiver";
import { FailureInjector } from "./components/FailureInjector";
import { SessionPane } from "./components/SessionPane";
import { WitnessConsole } from "./components/WitnessConsole";

export function App() {
  return (
    <main className="rcc-app-shell">
      <header className="rcc-hero">
        <div className="hero-copy">
          <p className="panel-eyebrow">River Control Center</p>
          <h1>See one task travel the full One River path.</h1>
          <p>
            Create from Alice or Bob, read the center river as a single
            correlation story, then inject one failure and let witness prove
            exactly where the contract broke.
          </p>
        </div>

        <div className="hero-guide">
          <article className="guide-card">
            <span className="guide-step">1</span>
            <div>
              <strong>Act from a session</strong>
              <p>Choose a project and create a PUBLIC or PRIVATE task.</p>
            </div>
          </article>
          <article className="guide-card">
            <span className="guide-step">2</span>
            <div>
              <strong>Read the Event River</strong>
              <p>Each group is one correlation id moving server to client.</p>
            </div>
          </article>
          <article className="guide-card">
            <span className="guide-step">3</span>
            <div>
              <strong>Break and verify</strong>
              <p>Use one failure mode, then let witness confirm what failed.</p>
            </div>
          </article>
        </div>
      </header>

      <section className="rcc-orientation-grid">
        <article className="orientation-card is-action">
          <p className="panel-eyebrow">Where To Act</p>
          <h3>Alice and Bob are the controls</h3>
          <p>
            The side panels are the only places where new mutations start.
            Project switching changes room scope. PRIVATE tasks should stay
            owner-only.
          </p>
        </article>
        <article className="orientation-card is-observe">
          <p className="panel-eyebrow">Where To Observe</p>
          <h3>The center river is the story</h3>
          <p>
            The middle lane groups all stages for a single mutation. A clean
            first load should stay quiet until you deliberately do work.
          </p>
        </article>
        <article className="orientation-card is-verify">
          <p className="panel-eyebrow">Where To Prove</p>
          <h3>Diagnosis lives below the fold</h3>
          <p>
            Failure injection and witness are secondary tools. Use them after
            the happy path is readable so the break is obvious.
          </p>
        </article>
      </section>

      <section className="section-header">
        <div>
          <p className="panel-eyebrow">Live Demo</p>
          <h2>Operate from both sessions</h2>
        </div>
        <p>
          Alice and Bob share project rooms but keep private visibility
          boundaries. The center river should mirror every mutation you trigger
          from either side.
        </p>
      </section>

      <section className="rcc-main-grid">
        <SessionPane sessionId="alice" />
        <EventRiver />
        <SessionPane sessionId="bob" />
      </section>

      <section className="section-header">
        <div>
          <p className="panel-eyebrow">Diagnosis Lab</p>
          <h2>Break a guarantee, then prove the break</h2>
        </div>
        <p>
          Use failure injection only after the healthy path makes sense.
          Witness should stay quiet until you intentionally run it or change
          modes.
        </p>
      </section>

      <section className="rcc-lab-grid">
        <FailureInjector />
        <WitnessConsole />
      </section>
    </main>
  );
}
