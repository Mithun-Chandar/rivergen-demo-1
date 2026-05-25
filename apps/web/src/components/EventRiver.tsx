import { useEffect, useMemo, useRef, useState } from "react";

import type {
  RiverTraceEvent,
  RiverTraceStage,
} from "@rivergen-demo/shared/river-trace";
import { io } from "socket.io-client";

import { subscribeToLocalTraces } from "../lib/trace-client";

const STAGE_LABELS: Record<RiverTraceStage, string> = {
  mutation: "01 mutation",
  publish: "02 publish",
  listener: "03 listener",
  broadcast: "04 broadcast",
  "ws-delivery": "05 ws-delivery",
  dispatcher: "06 dispatcher",
  projection: "07 projection",
  "cache-write": "08 cache-write",
  witness: "09 witness",
};

function getSocketUrl(): string {
  return import.meta.env.VITE_WS_URL?.trim() || "http://localhost:3001";
}

export function EventRiver() {
  const [traces, setTraces] = useState<RiverTraceEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const appendTrace = (trace: RiverTraceEvent) => {
      if (trace.stage === "witness" && trace.source === "auto") {
        return;
      }

      setTraces((current) => [...current.slice(-49), trace]);
    };

    const socket = io(getSocketUrl(), {
      transports: ["websocket"],
      auth: { sessionId: "observer" },
    });

    socket.on("connect", () => {
      socket.emit("join:debug");
    });
    socket.on("river:trace", appendTrace);

    const unsubscribe = subscribeToLocalTraces(appendTrace);

    return () => {
      unsubscribe();
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (paused || !viewportRef.current) {
      return;
    }

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
      items: items.sort((left, right) => left.timestamp - right.timestamp),
    }));
  }, [traces]);

  return (
    <section className="river-panel">
      <header className="panel-header">
        <div>
          <p className="panel-eyebrow">Event River</p>
          <h2>Correlation groups in flight</h2>
          <p className="panel-copy">
            Read one mutation from server publish to client projection. The
            center lane should stay quiet on load and only fill when you
            deliberately trigger work.
          </p>
        </div>
        <div className="panel-header-actions">
          <span className="panel-meta">{paused ? "paused" : "auto-scroll"}</span>
          <span className="panel-meta">{traces.length} traces</span>
        </div>
      </header>

      <div className="river-intro">
        <div className="river-legend">
          <span>Server path 01 → 04</span>
          <span>Client path 05 → 08</span>
          <span>Manual witness 09</span>
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
            <strong>No live activity yet</strong>
            <span>
              Create a task from Alice or Bob. Each river group is one
              correlation id moving through the full One River path.
            </span>
          </div>
        ) : (
          groups.map((group) => {
            const lead = group.items[0];
            const groupStatus = group.items.some(
              (item) => item.status === "error",
            )
              ? "error"
              : group.items.some((item) => item.status === "skipped")
                ? "skipped"
                : "ok";

            return (
              <details
                key={group.correlationId}
                className={`river-group is-${groupStatus}`}
                open
              >
                <summary>
                  <div className="river-summary-copy">
                    <strong>{lead.eventName}</strong>
                    <small>
                      {group.items.length} stages
                      {lead.session ? ` · ${lead.session}` : ""}
                      {lead.room ? ` · ${lead.room}` : ""}
                    </small>
                  </div>
                  <span className="panel-meta">
                    {group.correlationId.slice(0, 8)}
                  </span>
                </summary>
                <div className="river-group-body">
                  {group.items.map((trace) => (
                    <article
                      key={trace.id}
                      className={`trace-row is-${trace.status}`}
                      data-stage={trace.stage}
                    >
                      <div className="trace-stage">
                        {STAGE_LABELS[trace.stage]}
                      </div>
                      <div className="trace-body">
                        <p>
                          {trace.detail || trace.eventName}
                          {trace.session ? ` · ${trace.session}` : ""}
                          {trace.room ? ` · ${trace.room}` : ""}
                        </p>
                        {trace.failureMode ? (
                          <span className="trace-pill">
                            {trace.failureMode}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </details>
            );
          })
        )}
      </div>
    </section>
  );
}
