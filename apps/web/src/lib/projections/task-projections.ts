import { QueryClient } from "@tanstack/react-query";
import {
  applyEntityCreate,
  applyEntityUpdate,
  applyEntityDelete,
} from "../cache/entity-cache";
import { getFailureMode } from "../failure-mode";
import { taskKeys } from "../query-keys/task";
import { emitLocalTrace, getTraceContextInfo } from "../trace-client";

// TODO: import your Task entity type once defined
// import type { Task } from "your-types-package";

// FIELD SHAPE LAW: the payload object spread into applyEntity* becomes what
// useQuery returns. Field names in eventFactory.publish() payload MUST match
// the REST API response shape — the same names the UI reads from useQuery data.
// A mismatch (e.g. "creatorId" in WS but "authorId" in REST) causes the WS
// projection to write a field the UI never reads, silently losing the update.
// Cross-check with your API route's select/include shape before adding fields.
type AnyPayload = Record<string, unknown>;

function toEntityPayload(payload: AnyPayload): AnyPayload {
  const { _meta, ...entityPayload } = payload;
  return entityPayload;
}

function buildTraceContext(eventName: string, payload: AnyPayload) {
  return getTraceContextInfo(eventName, payload);
}

function emitProjectionTrace(
  eventName: string,
  payload: AnyPayload,
  detail: string,
): void {
  if (
    eventName === "task.created" &&
    getFailureMode() === "direct-cache-mutation"
  ) {
    return;
  }

  const traceContext = buildTraceContext(eventName, payload);
  emitLocalTrace({
    stage: "projection",
    domain: traceContext.domain,
    eventName,
    correlationId: traceContext.correlationId,
    session: traceContext.session,
    payload: traceContext.payload,
    status: "ok",
    detail,
  });
}

// ── task.created ──────────────────────────────────────────────────────────
export function applyTaskCreated(
  payload: AnyPayload,
  queryClient: QueryClient,
): void {
  const taskId = payload.taskId as string | undefined;
  if (!taskId) return;

  // TODO: derive context — which collection does this entity belong to?
  // context is used by entity-cache to find the correct query key(s) to update
  const context = {
    projectId: payload.projectId as string,
    clientTempId: payload.clientTempId as string | undefined,
    _trace: buildTraceContext("task.created", payload),
  };

  applyEntityCreate(
    "task",
    { id: taskId, ...toEntityPayload(payload) },
    context,
    queryClient,
  );
  emitProjectionTrace(
    "task.created",
    payload,
    `projected to ${JSON.stringify(taskKeys.list({ projectId: payload.projectId as string }))}`,
  );
}

// ── task.updated ──────────────────────────────────────────────────────────
export function applyTaskUpdated(
  payload: AnyPayload,
  queryClient: QueryClient,
): void {
  const taskId = payload.taskId as string | undefined;
  if (!taskId) return;

  // TODO: derive context — which collection does this entity belong to?
  const context = {
    projectId: payload.projectId as string,
    _trace: buildTraceContext("task.updated", payload),
  };

  applyEntityUpdate(
    "task",
    { id: taskId, ...toEntityPayload(payload) },
    context,
    queryClient,
  );
  emitProjectionTrace(
    "task.updated",
    payload,
    `projected to ${JSON.stringify(taskKeys.list({ projectId: payload.projectId as string }))}`,
  );
}

// ── task.deleted ──────────────────────────────────────────────────────────
export function applyTaskDeleted(
  payload: AnyPayload,
  queryClient: QueryClient,
): void {
  const taskId = payload.taskId as string | undefined;
  if (!taskId) return;

  const context = {
    projectId: payload.projectId as string,
    _trace: buildTraceContext("task.deleted", payload),
  };

  applyEntityDelete("task", String(taskId), context, queryClient);
  emitProjectionTrace(
    "task.deleted",
    payload,
    `removed from ${JSON.stringify(taskKeys.list({ projectId: payload.projectId as string }))}`,
  );
}

// ── task.assigned ──────────────────────────────────────────────────────────
export function applyTaskAssigned(
  payload: AnyPayload,
  queryClient: QueryClient,
): void {
  const taskId = payload.taskId as string | undefined;
  if (!taskId) return;

  // TODO: derive context — which collection does this entity belong to?
  const context = {
    projectId: payload.projectId as string,
    _trace: buildTraceContext("task.assigned", payload),
  };

  applyEntityUpdate(
    "task",
    { id: taskId, ...toEntityPayload(payload) },
    context,
    queryClient,
  );
  emitProjectionTrace(
    "task.assigned",
    payload,
    `updated signal on ${JSON.stringify(taskKeys.list({ projectId: payload.projectId as string }))}`,
  );
}

// ── task.priority-changed ──────────────────────────────────────────────────────────
export function applyTaskPriorityChanged(
  payload: AnyPayload,
  queryClient: QueryClient,
): void {
  const taskId = payload.taskId as string | undefined;
  if (!taskId) return;

  // TODO: derive context — which collection does this entity belong to?
  const context = {
    projectId: payload.projectId as string,
    _trace: buildTraceContext("task.priority-changed", payload),
  };

  applyEntityUpdate(
    "task",
    { id: taskId, ...toEntityPayload(payload) },
    context,
    queryClient,
  );
  emitProjectionTrace(
    "task.priority-changed",
    payload,
    `updated signal on ${JSON.stringify(taskKeys.list({ projectId: payload.projectId as string }))}`,
  );
}
