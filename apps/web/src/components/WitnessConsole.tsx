import { QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { DemoFailureMode } from "@rivergen-demo/shared/river-trace";
import type { WitnessAssertion } from "@rivergen/witness";

import { useFailureMode } from "../lib/failure-mode";
import { emitLocalTrace, suppressLocalTracesWhile } from "../lib/trace-client";
import { taskWitness } from "../witness/task.witness";
import { Badge } from "./ui/Badge";

type WitnessSections = {
  layer1: WitnessAssertion[];
  layer2: WitnessAssertion[];
  layer3: WitnessAssertion[];
  layer4: WitnessAssertion[];
};

const LAYER_META: Array<{
  key: keyof WitnessSections;
  num: number;
  title: string;
  isKey?: boolean;
}> = [
  { key: "layer1", num: 1, title: "Schema Coverage" },
  { key: "layer2", num: 2, title: "Broadcast Field Coverage" },
  { key: "layer3", num: 3, title: "Projection Proof", isKey: true },
  { key: "layer4", num: 4, title: "Witness File Structure" },
];

function applyFailureOverrides(
  assertions: WitnessAssertion[],
  mode: DemoFailureMode,
): WitnessAssertion[] {
  if (mode === "none") return assertions;

  if (mode === "skip-projection") {
    return assertions.map((a) =>
      a.name === "ghost reconciled — no orphan"
        ? { ...a, ok: false, detail: "expected real task after dispatcher, got orphan optimistic ghost" }
        : a,
    );
  }

  if (mode === "missing-field") {
    return assertions.map((a) => {
      if (a.name === "ghost reconciled — no orphan")
        return { ...a, ok: false, detail: "expected clientTempId-driven reconciliation, got duplicate entity" };
      if (a.name === "clientTempId preserved for reconciliation")
        return { ...a, ok: false, detail: 'expected "temp-task-witness-001", got "undefined"' };
      return a;
    });
  }

  if (mode === "direct-cache-mutation") {
    return [...assertions, { name: "projection authority preserved", ok: false, detail: "direct setQueryData bypassed entity-cache ownership" }];
  }

  return [...assertions, { name: "PRIVATE task not leaked", ok: false, detail: "received by non-owner session after public-room broadcast" }];
}

async function buildWitnessSections(mode: DemoFailureMode): Promise<WitnessSections> {
  const queryClient = new QueryClient();
  const lifecycleAssertions = applyFailureOverrides(
    await taskWitness.lifecycle(queryClient),
    mode,
  );
  const signalAssertions = [
    ...(await taskWitness.signals["task.assigned"](new QueryClient())),
    ...(await taskWitness.signals["task.priority-changed"](new QueryClient())),
  ];

  return {
    layer1: [
      { name: "taskId present in task.created schema", ok: true },
      { name: "clientTempId present in task.created schema", ok: true },
    ],
    layer2: [
      { name: "taskId present in task.created broadcast", ok: true },
      { name: "clientTempId present in task.created broadcast", ok: mode !== "missing-field" },
    ],
    layer3: [...lifecycleAssertions, ...signalAssertions],
    layer4: [
      { name: "requiredFields declared", ok: Object.keys(taskWitness.requiredFields).length > 0 },
      { name: "testPayloads present", ok: Object.keys(taskWitness.testPayloads).length === taskWitness.events.length },
      { name: "lifecycle() implemented", ok: typeof taskWitness.lifecycle === "function" },
      { name: "signals{} non-empty", ok: Object.keys(taskWitness.signals).length > 0 },
    ],
  };
}

function layerPassed(sections: WitnessSections, key: keyof WitnessSections): boolean {
  return sections[key].every((a) => a.ok);
}

export function WitnessConsole() {
  const { mode } = useFailureMode();
  const [running, setRunning] = useState(false);
  const [sections, setSections] = useState<WitnessSections | null>(null);

  const layer3Ok = sections ? sections.layer3.every((a) => a.ok) : null;

  const overallState: "idle" | "pass" | "fail" | "running" = running
    ? "running"
    : sections === null
      ? "idle"
      : layer3Ok
        ? "pass"
        : "fail";

  const statusConfig = {
    idle:    { icon: "◎", label: "Warming up",   sub: "Run witness to verify field continuity" },
    running: { icon: "⟳", label: "Running…",     sub: "Executing witness assertions" },
    pass:    { icon: "✓", label: "All Clear",    sub: "Layer 3 projection proof passing" },
    fail:    { icon: "✗", label: "Break Detected", sub: "Layer 3 projection proof failing" },
  }[overallState];

  const runWitness = async (source: "auto" | "manual") => {
    setRunning(true);
    const nextSections = await suppressLocalTracesWhile(() => buildWitnessSections(mode));
    setSections(nextSections);

    const layer3Passed = nextSections.layer3.every((a) => a.ok);
    emitLocalTrace({
      stage: "witness",
      domain: "task",
      eventName: "task.witness",
      correlationId: `witness-${Date.now()}`,
      status: layer3Passed ? "ok" : "error",
      detail: layer3Passed ? "all witness assertions passed" : "one or more witness assertions failed",
      failureMode: mode === "none" ? undefined : mode,
      source,
    });

    setRunning(false);
  };

  useEffect(() => {
    void runWitness("auto");
  }, [mode]);

  return (
    <section className="witness-panel">
      <header className="panel-header">
        <div className="panel-header-left">
          <p className="panel-eyebrow">Witness Console</p>
          <h2>task domain</h2>
        </div>
        <div className="panel-header-right">
          <button
            type="button"
            className="run-btn"
            onClick={() => void runWitness("manual")}
            disabled={running}
          >
            {running ? "Running…" : "Run"}
          </button>
        </div>
      </header>

      <div className={`witness-status-block is-${overallState === "running" ? "idle" : overallState}`}>
        <span className="witness-status-icon">{statusConfig.icon}</span>
        <div className="witness-status-text">
          <div className="witness-status-label">{statusConfig.label}</div>
          <div className="witness-status-sub">{statusConfig.sub}</div>
        </div>
      </div>

      {sections ? (
        <div className="witness-layers">
          {LAYER_META.map((layer) => {
            const passed = layerPassed(sections, layer.key);
            const items = sections[layer.key];

            return (
              <details
                key={layer.key}
                className={`witness-layer${layer.isKey ? " is-key-layer" : ""}`}
                open={!passed || layer.isKey}
              >
                <summary className="witness-layer-summary">
                  <span className="layer-num">{layer.num}</span>
                  <span className="layer-title">{layer.title}</span>
                  {layer.isKey ? (
                    <span className="key-layer-tag">key layer</span>
                  ) : null}
                  <Badge variant={passed ? "ok" : "error"}>
                    {passed ? "pass" : "fail"}
                  </Badge>
                </summary>

                <div className="witness-assertions">
                  {items.map((assertion) => (
                    <div
                      key={assertion.name}
                      className={`assertion-row${assertion.ok ? "" : " is-failed"}`}
                    >
                      <span className="assertion-dot" />
                      <div>
                        <div className="assertion-name">{assertion.name}</div>
                        {assertion.detail ? (
                          <div className="assertion-detail">{assertion.detail}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
