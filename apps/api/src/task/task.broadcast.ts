import type { SocketServerLike } from "../websocket/websocket.service";
import { getFailureMode } from "../lib/failure-mode";
import { trace } from "../lib/river-trace";

type AnyPayload = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCorrelationId(payload: AnyPayload): string {
  const meta = payload._meta;
  if (isRecord(meta) && typeof meta.correlationId === "string") {
    return meta.correlationId;
  }
  return `corr-missing-${Date.now()}`;
}

/**
 * Central broadcast helper for all Task domain events.
 * All socket.emit() calls for this domain funnel through here.
 *
 * Called by: task.listener.ts
 */
export function broadcastTaskEvent(
  io: SocketServerLike,
  eventName: string,
  payload: AnyPayload,
): void {
  const activeFailureMode = getFailureMode();

  // PRIVATE entity — room is scoped by visibility
  // NEVER emit PRIVATE data to the workspace-wide room
  const projectId = payload.projectId as string | undefined;
  if (!projectId) {
    console.warn(
      `[broadcast:task] ${eventName} dropped — no projectId in payload`,
    );
    return;
  }
  const creatorId = payload.creatorId as string | undefined;
  const isPrivate = payload.visibility === "PRIVATE";
  let room = isPrivate ? `user:${creatorId}` : `project:${projectId}`;
  let outgoingPayload = payload;
  let status: "ok" | "error" = "ok";
  let detail = `broadcast to ${room}`;
  let failureMode:
    | import("@rivergen-demo/shared/river-trace").FailureMode
    | undefined;

  if (activeFailureMode === "broadcast-leak" && isPrivate) {
    room = `project:${projectId}`;
    status = "error";
    detail = `PRIVATE task leaked to ${room}`;
    failureMode = "broadcast-leak";
  }

  if (activeFailureMode === "missing-field" && eventName === "task.created") {
    const { clientTempId, ...rest } = payload;
    outgoingPayload = rest;
    status = "error";
    detail = "clientTempId stripped before broadcast";
    failureMode = "missing-field";
  }

  trace({
    stage: "broadcast",
    domain: "task",
    eventName,
    correlationId: getCorrelationId(payload),
    session: creatorId,
    room,
    payload: outgoingPayload,
    status,
    detail,
    failureMode,
  });

  console.log(`[broadcast:task] ${eventName} → ${room}`);
  io.to(room).emit(eventName, outgoingPayload);
}

export function broadcastTaskCreated(
  io: SocketServerLike,
  payload: AnyPayload,
): void {
  broadcastTaskEvent(io, "task.created", payload);
}

export function broadcastTaskUpdated(
  io: SocketServerLike,
  payload: AnyPayload,
): void {
  broadcastTaskEvent(io, "task.updated", payload);
}

export function broadcastTaskDeleted(
  io: SocketServerLike,
  payload: AnyPayload,
): void {
  broadcastTaskEvent(io, "task.deleted", payload);
}

export function broadcastTaskAssigned(
  io: SocketServerLike,
  payload: AnyPayload,
): void {
  broadcastTaskEvent(io, "task.assigned", payload);
}

export function broadcastTaskPriorityChanged(
  io: SocketServerLike,
  payload: AnyPayload,
): void {
  broadcastTaskEvent(io, "task.priority-changed", payload);
}
