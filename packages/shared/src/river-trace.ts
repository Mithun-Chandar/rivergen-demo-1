export type RiverTraceStage =
  | "mutation"
  | "publish"
  | "listener"
  | "broadcast"
  | "ws-delivery"
  | "dispatcher"
  | "projection"
  | "cache-write"
  | "witness";

export type FailureMode =
  | "skip-projection"
  | "broadcast-leak"
  | "missing-field"
  | "direct-cache-mutation";

export type DemoFailureMode = FailureMode | "none";

export interface RiverTraceEvent {
  id: string;
  correlationId: string;
  stage: RiverTraceStage;
  domain: string;
  eventName: string;
  timestamp: number;
  session?: string;
  room?: string;
  payload?: Record<string, unknown>;
  status: "ok" | "error" | "skipped";
  detail?: string;
  failureMode?: FailureMode;
  source?: "auto" | "manual";
}
