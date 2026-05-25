import { useState } from "react";

import type { DemoFailureMode } from "@rivergen-demo/shared/river-trace";

import { useFailureMode } from "../lib/failure-mode";

const FAILURE_OPTIONS: Array<{
  mode: Exclude<DemoFailureMode, "none">;
  label: string;
  description: string;
  witnessCatch: string;
}> = [
  {
    mode: "skip-projection",
    label: "Skip Projection",
    description:
      "The event arrives, the dispatcher fires, and the projection never runs.",
    witnessCatch: "Layer 3 catches the orphan ghost.",
  },
  {
    mode: "broadcast-leak",
    label: "Broadcast Leak",
    description: "A PRIVATE task is emitted to the public project room.",
    witnessCatch: "Layer 3 catches the non-owner delivery leak.",
  },
  {
    mode: "missing-field",
    label: "Missing Payload Field",
    description:
      "clientTempId is stripped before the task.created event is delivered.",
    witnessCatch: "Layer 3 catches broken ghost reconciliation.",
  },
  {
    mode: "direct-cache-mutation",
    label: "Direct Cache Mutation",
    description:
      "A bypass write hits setQueryData before the projection authority converges.",
    witnessCatch: "Layer 3 catches projection-authority violation.",
  },
];

export function FailureInjector() {
  const { mode, setMode } = useFailureMode();
  const [syncing, setSyncing] = useState(false);
  const modeLabel = syncing
    ? "syncing"
    : mode === "none"
      ? "healthy path"
      : mode;

  const applyMode = async (next: Exclude<DemoFailureMode, "none">) => {
    const resolvedMode: DemoFailureMode = mode === next ? "none" : next;
    setMode(resolvedMode);
    setSyncing(true);

    try {
      await fetch("/api/debug/failure-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: resolvedMode }),
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="failure-panel">
      <header className="panel-header">
        <div>
          <p className="panel-eyebrow">Failure Injection</p>
          <h2>Break one guarantee at a time</h2>
          <p className="panel-copy">
            Click once to activate a failure. Click the same card again to
            return to the healthy path before testing the next break.
          </p>
        </div>
        <div className="panel-header-actions">
          <span className="panel-meta">{modeLabel}</span>
        </div>
      </header>

      <div className="failure-grid">
        {FAILURE_OPTIONS.map((option) => {
          const active = mode === option.mode;
          return (
            <button
              key={option.mode}
              type="button"
              className={`failure-toggle${active ? " is-active" : ""}`}
              onClick={() => {
                void applyMode(option.mode);
              }}
              disabled={syncing}
            >
              <span className="toggle-mark">{active ? "[x]" : "[ ]"}</span>
              <strong>{option.label}</strong>
              <span>{option.description}</span>
              <span className="toggle-footnote">{option.witnessCatch}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
