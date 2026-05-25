import { QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { DemoFailureMode } from "@rivergen-demo/shared/river-trace";
import type { WitnessAssertion } from "@rivergen/witness";

import { useFailureMode } from "../lib/failure-mode";
import { emitLocalTrace, suppressLocalTracesWhile } from "../lib/trace-client";
import { taskWitness } from "../witness/task.witness";

type WitnessSections = {
  layer1: WitnessAssertion[];
  layer2: WitnessAssertion[];
  layer3: WitnessAssertion[];
  layer4: WitnessAssertion[];
};

const WITNESS_SECTION_META: Array<{
  key: keyof WitnessSections;
  title: string;
  description: string;
}> = [
  {
    key: "layer1",
    title: "Layer 1 — Schema Coverage",
    description: "Fields required by the client exist at the source.",
  },
  {
    key: "layer2",
    title: "Layer 2 — Broadcast Field Coverage",
    description: "The emitted payload still carries those fields over the wire.",
  },
  {
    key: "layer3",
    title: "Layer 3 — Projection Proof",
    description: "The client can reconcile ghosts and preserve live authority.",
  },
  {
    key: "layer4",
    title: "Layer 4 — Witness File Structure",
    description: "The witness contract itself is complete and runnable.",
  },
];

function applyFailureOverrides(
  assertions: WitnessAssertion[],
  mode: DemoFailureMode,
): WitnessAssertion[] {
  if (mode === "none") {
    return assertions;
  }

  if (mode === "skip-projection") {
    return assertions.map((assertion) =>
      assertion.name === "ghost reconciled — no orphan"
        ? {
            ...assertion,
            ok: false,
            detail:
              "expected real task after dispatcher, got orphan optimistic ghost",
          }
        : assertion,
    );
  }

  if (mode === "missing-field") {
    return assertions.map((assertion) => {
      if (assertion.name === "ghost reconciled — no orphan") {
        return {
          ...assertion,
          ok: false,
          detail:
            "expected clientTempId-driven reconciliation, got duplicate entity",
        };
      }
      if (assertion.name === "clientTempId preserved for reconciliation") {
        return {
          ...assertion,
          ok: false,
          detail: 'expected "temp-task-witness-001", got "undefined"',
        };
      }
      return assertion;
    });
  }

  if (mode === "direct-cache-mutation") {
    return [
      ...assertions,
      {
        name: "projection authority preserved",
        ok: false,
        detail: "direct setQueryData bypassed entity-cache ownership",
      },
    ];
  }

  return [
    ...assertions,
    {
      name: "PRIVATE task not leaked",
      ok: false,
      detail: "received by non-owner session after public-room broadcast",
    },
  ];
}

async function buildWitnessSections(
  mode: DemoFailureMode,
): Promise<WitnessSections> {
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
      {
        name: "clientTempId present in task.created broadcast",
        ok: mode !== "missing-field",
      },
    ],
    layer3: [...lifecycleAssertions, ...signalAssertions],
    layer4: [
      {
        name: "requiredFields declared",
        ok: Object.keys(taskWitness.requiredFields).length > 0,
      },
      {
        name: "testPayloads present",
        ok:
          Object.keys(taskWitness.testPayloads).length ===
          taskWitness.events.length,
      },
      {
        name: "lifecycle() implemented",
        ok: typeof taskWitness.lifecycle === "function",
      },
      {
        name: "signals{} non-empty",
        ok: Object.keys(taskWitness.signals).length > 0,
      },
    ],
  };
}

export function WitnessConsole() {
  const { mode } = useFailureMode();
  const [running, setRunning] = useState(false);
  const [sections, setSections] = useState<WitnessSections | null>(null);
  const layer3Healthy = sections?.layer3.every((assertion) => assertion.ok);
  const witnessState = running
    ? "running"
    : sections
      ? layer3Healthy
        ? "layer 3 healthy"
        : "layer 3 failing"
      : "warming up";

  const runWitness = async (source: "auto" | "manual") => {
    setRunning(true);
    const nextSections = await suppressLocalTracesWhile(() =>
      buildWitnessSections(mode),
    );
    setSections(nextSections);

    const layer3Ok = nextSections.layer3.every((assertion) => assertion.ok);
    emitLocalTrace({
      stage: "witness",
      domain: "task",
      eventName: "task.witness",
      correlationId: `witness-${Date.now()}`,
      status: layer3Ok ? "ok" : "error",
      detail: layer3Ok
        ? "all witness assertions passed"
        : "one or more witness assertions failed",
      failureMode: mode === "none" ? undefined : mode,
      source,
    });

    setRunning(false);
  };

  useEffect(() => {
    void runWitness("auto");
  }, [mode]);

  const renderAssertions = (items: WitnessAssertion[]) => (
    <div className="witness-list">
      {items.map((assertion) => (
        <div
          key={assertion.name}
          className={`witness-line${assertion.ok ? "" : " is-failed"}`}
        >
          <span>{assertion.ok ? "✓" : "✗"}</span>
          <div>
            <p>{assertion.name}</p>
            {assertion.detail ? <small>{assertion.detail}</small> : null}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <section className="witness-panel">
      <header className="panel-header">
        <div>
          <p className="panel-eyebrow">Witness Console</p>
          <h2>task domain</h2>
          <p className="panel-copy">
            Witness verifies field continuity from schema to projection. It
            reruns automatically when failure mode changes, and manual RUN
            stamps a witness result into the river.
          </p>
        </div>
        <div className="panel-header-actions">
          <span className="panel-meta">{witnessState}</span>
          <button
            type="button"
            className="run-button"
            onClick={() => void runWitness("manual")}
            disabled={running}
          >
            {running ? "RUNNING" : "RUN"}
          </button>
        </div>
      </header>

      {sections ? (
        <div className="witness-grid">
          {WITNESS_SECTION_META.map((section) => (
            <section key={section.key}>
              <div className="witness-section-header">
                <h3>{section.title}</h3>
                <p>{section.description}</p>
              </div>
              {renderAssertions(sections[section.key])}
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}
