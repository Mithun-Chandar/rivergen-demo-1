import { useState } from "react";

import type { DemoFailureMode } from "@rivergen-demo/shared/river-trace";

import { useFailureMode } from "../lib/failure-mode";
import { demoRuntime } from "../lib/runtime";
import { Badge } from "./ui/Badge";

const FAILURE_OPTIONS: Array<{
  mode: Exclude<DemoFailureMode, "none">;
  label: string;
  description: string;
}> = [
  {
    mode: "skip-projection",
    label: "Skip Projection",
    description: "Dispatcher fires — projection never runs",
  },
  {
    mode: "broadcast-leak",
    label: "Broadcast Leak",
    description: "PRIVATE task emitted to public room",
  },
  {
    mode: "missing-field",
    label: "Missing Payload Field",
    description: "clientTempId stripped before delivery",
  },
  {
    mode: "direct-cache-mutation",
    label: "Direct Cache Mutation",
    description: "Bypass write hits cache before projection",
  },
];

export function FailureInjector() {
  const { mode, setMode } = useFailureMode();
  const [syncing, setSyncing] = useState(false);

  const statusLabel = syncing ? "syncing" : mode === "none" ? "healthy" : mode;
  const statusVariant = syncing
    ? "default"
    : mode === "none"
      ? "ok"
      : "error";

  const applyMode = async (next: Exclude<DemoFailureMode, "none">) => {
    const resolvedMode: DemoFailureMode = mode === next ? "none" : next;
    setMode(resolvedMode);
    setSyncing(true);

    try {
      await demoRuntime.setFailureMode(resolvedMode);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="failure-panel">
      <header className="panel-header">
        <div className="panel-header-left">
          <p className="panel-eyebrow">Failure Injection</p>
          <h2>Break one guarantee</h2>
        </div>
        <div className="panel-header-right">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
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
              onClick={() => { void applyMode(option.mode); }}
              disabled={syncing}
            >
              <div className="toggle-indicator">
                <span className="toggle-dot" />
                <span className="toggle-label">{option.label}</span>
              </div>
              <span className="toggle-desc">{option.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
