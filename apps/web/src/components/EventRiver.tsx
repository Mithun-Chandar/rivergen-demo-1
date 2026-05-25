import { useEffect, useMemo, useRef, useState } from "react";

import type {
  RiverTraceEvent,
  RiverTraceStage,
} from "@rivergen-demo/shared/river-trace";

import { demoRuntime } from "../lib/runtime";
import { subscribeToLocalTraces } from "../lib/trace-client";
import { Badge } from "./ui/Badge";

const STAGE_META: Record<RiverTraceStage, { num: number; name: string }> = {
  mutation:       { num: 1, name: "mutation" },
  publish:        { num: 2, name: "publish" },
  listener:       { num: 3, name: "listener" },
  broadcast:      { num: 4, name: "broadcast" },
  "ws-delivery":  { num: 5, name: "ws-recv" },
  dispatcher:     { num: 6, name: "dispatch" },
  projection:     { num: 7, name: "project" },
  "cache-write":  { num: 8, name: "cache" },
  witness:        { num: 9, name: "witness" },
};

export function EventRiver() {
  const [traces, setTraces] = useState<RiverTraceEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const appendTrace = (trace: RiverTraceEvent) => {
      if (trace.stage === "witness" && trace.source === "auto") return;
      setTraces((current) => [...current.slice(-49), trace]);
    };

    const unsubscribeRuntime = demoRuntime.subscribeToTraces(appendTrace);
    const unsubscribe = subscribeToLocalTraces(appendTrace);

    return () => {
      unsubscribe();
      unsubscribeRuntime();
    };
  }, []);

  useEffect(() => {
    if (paused || !viewportRef.current) return;
    viewportRef.current.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [paused, traces]);

  const groups = useMemo(() => {
    const grouped = new Map<string, RiverTraceEvent[]>();

    for (const trace of traces) {
      const key = trace.correlationId || trace.id;
      const current = grouped.get(key) ?? [];
      current.push(trace);
      grouped.set(key, current);
    }

    return Array.from(grouped.entries()).map(([correlationId, items]) => ({
      correlationId,
      items: items.sort((a, b) => a.timestamp - b.timestamp),
    }));
  }, [traces]);

  return (
    <section className="river-panel">
      <header className="panel-header">
        <div className="panel-header-left">
          <p className="panel-eyebrow">Event River</p>
          <h2>Correlation groups</h2>
        </div>
        <div className="panel-header-right">
          <Badge variant="default">{traces.length} traces</Badge>
        </div>
      </header>

      <div className="river-status-bar">
        <span className="river-scroll-indicator">
          {paused ? "paused" : "auto-scroll"}
        </span>
        <div className="river-legend">
          <Badge variant="default">server 1–4</Badge>
          <Badge variant="default">client 5–8</Badge>
          <Badge variant="default">witness 9</Badge>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="river-viewport"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {groups.length === 0 ? (
          <div className="river-empty">
            <span className="river-empty-icon">⟳</span>
            <strong>No activity yet</strong>
            <span>Create a task from Alice or Bob</span>
          </div>
        ) : (
          groups.map((group) => {
            const lead = group.items[0];
            const groupStatus = group.items.some((i) => i.status === "error")
              ? "error"
              : group.items.some((i) => i.status === "skipped")
                ? "skipped"
                : "ok";

            return (
              <details
                key={group.correlationId}
                className={`river-group is-${groupStatus}`}
                open
              >
                <summary>
                  <div className="river-summary-left">
                    <span className="river-event-name">{lead.eventName}</span>
                    {lead.session ? (
                      <Badge variant={lead.session === "alice" ? "alice" : "bob"}>
                        {lead.session}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="river-summary-meta">
                    <Badge variant={groupStatus === "ok" ? "default" : groupStatus}>
                      {group.items.length} stages
                    </Badge>
                    <Badge variant="default">
                      {group.correlationId.slice(0, 8)}
                    </Badge>
                  </div>
                </summary>

                <div className="river-group-body">
                  {group.items.map((trace) => {
                    const stage = STAGE_META[trace.stage];
                    return (
                      <div
                        key={trace.id}
                        className={`trace-row is-${trace.status}`}
                      >
                        <div className="trace-stage-dot">
                          <span className="stage-num">{stage.num}</span>
                          <span className="stage-name">{stage.name}</span>
                        </div>
                        <span className="trace-detail">
                          {trace.detail || trace.eventName}
                          {trace.failureMode ? (
                            <>
                              {" "}
                              <Badge variant="error">{trace.failureMode}</Badge>
                            </>
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })
        )}
      </div>
    </section>
  );
}
