import type { RiverTraceEvent } from "@rivergen-demo/shared/river-trace";

export interface TraceContextInfo {
  correlationId: string;
  domain: string;
  eventName: string;
  session?: string;
  payload?: Record<string, unknown>;
}

type TraceListener = (event: RiverTraceEvent) => void;

const listeners = new Set<TraceListener>();
let suppressedLocalTraceDepth = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function makeTraceId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `trace-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function emitLocalTrace(
  event: Omit<RiverTraceEvent, "id" | "timestamp">,
): void {
  if (suppressedLocalTraceDepth > 0) {
    return;
  }

  const fullEvent: RiverTraceEvent = {
    ...event,
    id: makeTraceId(),
    timestamp: Date.now(),
  };

  for (const listener of listeners) {
    listener(fullEvent);
  }
}

export function subscribeToLocalTraces(listener: TraceListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function suppressLocalTracesWhile<T>(
  work: () => Promise<T>,
): Promise<T> {
  suppressedLocalTraceDepth += 1;

  try {
    return await work();
  } finally {
    suppressedLocalTraceDepth -= 1;
  }
}

export function getTraceContextInfo(
  eventName: string,
  payload: Record<string, unknown> | null | undefined,
): TraceContextInfo {
  const domain = eventName.split(".")[0] ?? "unknown";
  const meta = isRecord(payload?._meta) ? payload?._meta : undefined;
  const actor = meta && isRecord(meta.actor) ? meta.actor : undefined;

  return {
    correlationId:
      typeof meta?.correlationId === "string"
        ? meta.correlationId
        : `${eventName}-${Date.now()}`,
    domain,
    eventName,
    session: typeof actor?.id === "string" ? actor.id : undefined,
    payload: payload ?? undefined,
  };
}
