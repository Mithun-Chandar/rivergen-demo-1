import type { SocketServerLike } from "../../websocket/websocket.service";
import { eventBus } from "../event-bus.service";
import { trace } from "../river-trace";
import { broadcastTaskEvent } from "../../task/task.broadcast";

type AnyPayload = Record<string, unknown>;

function toClientPayload(envelope: {
  payload?: unknown;
  correlationId: string;
  actor: { id: string; type: string };
  context: Record<string, string | undefined>;
  eventVersion: string;
}): AnyPayload {
  return {
    ...((envelope.payload as AnyPayload | undefined) ?? {}),
    _meta: {
      correlationId: envelope.correlationId,
      actor: envelope.actor,
      context: envelope.context,
      eventVersion: envelope.eventVersion,
    },
  };
}

/**
 * Registers all Task domain event listeners on the EventBus.
 * Must be called once during server startup.
 *
 * Covered events:
 *   - task.created
 *   - task.updated
 *   - task.deleted
 *   - task.assigned
 *   - task.priority-changed
 */
export function registerTaskListeners(io: SocketServerLike): void {
  // LAW: every event from EventFactory must flow through here → broadcaster

  eventBus.subscribe("task.created", (envelope) => {
    trace({
      stage: "listener",
      domain: "task",
      eventName: envelope.type,
      correlationId: envelope.correlationId,
      session: envelope.actor.id,
      status: "ok",
      detail: "listener received task.created from EventBus",
    });
    broadcastTaskEvent(io, "task.created", toClientPayload(envelope));
  });

  eventBus.subscribe("task.updated", (envelope) => {
    trace({
      stage: "listener",
      domain: "task",
      eventName: envelope.type,
      correlationId: envelope.correlationId,
      session: envelope.actor.id,
      status: "ok",
      detail: "listener received task.updated from EventBus",
    });
    broadcastTaskEvent(io, "task.updated", toClientPayload(envelope));
  });

  eventBus.subscribe("task.deleted", (envelope) => {
    trace({
      stage: "listener",
      domain: "task",
      eventName: envelope.type,
      correlationId: envelope.correlationId,
      session: envelope.actor.id,
      status: "ok",
      detail: "listener received task.deleted from EventBus",
    });
    broadcastTaskEvent(io, "task.deleted", toClientPayload(envelope));
  });

  eventBus.subscribe("task.assigned", (envelope) => {
    trace({
      stage: "listener",
      domain: "task",
      eventName: envelope.type,
      correlationId: envelope.correlationId,
      session: envelope.actor.id,
      status: "ok",
      detail: "listener received task.assigned from EventBus",
    });
    broadcastTaskEvent(io, "task.assigned", toClientPayload(envelope));
  });

  eventBus.subscribe("task.priority-changed", (envelope) => {
    trace({
      stage: "listener",
      domain: "task",
      eventName: envelope.type,
      correlationId: envelope.correlationId,
      session: envelope.actor.id,
      status: "ok",
      detail: "listener received task.priority-changed from EventBus",
    });
    broadcastTaskEvent(io, "task.priority-changed", toClientPayload(envelope));
  });
}
