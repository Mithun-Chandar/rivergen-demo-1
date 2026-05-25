import type { DemoFailureMode } from "@rivergen-demo/shared/river-trace";

import { getFailureMode, setFailureMode } from "../failure-mode";
import { emitLocalTrace } from "../trace-client";
import type {
  DemoRuntime,
  RuntimeSessionConnection,
  SessionConnectionOptions,
  Task,
  TaskInput,
  TaskUpdateInput,
} from "./types";

type StoredTask = Required<
  Omit<Task, "taskId" | "_isOptimistic" | "creatorId" | "createdAt">
> & {
  creatorId: string;
  createdAt: string;
};

type SessionSubscriber = {
  id: string;
  sessionId: string;
  projectId: string;
  onEvent: SessionConnectionOptions["onEvent"];
};

const STORAGE_KEY = "rivergen-demo:showcase-state:v1";
const subscribers = new Map<string, SessionSubscriber>();

let state: { tasks: StoredTask[] } | null = null;

function makeId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}`;
}

function cloneTask(task: StoredTask): Task {
  return { ...task };
}

function getStoredState(): { tasks: StoredTask[] } {
  if (state) {
    return state;
  }

  if (typeof window === "undefined") {
    state = { tasks: [] };
    return state;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state = { tasks: [] };
    return state;
  }

  try {
    const parsed = JSON.parse(raw) as { tasks?: StoredTask[] };
    state = { tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] };
  } catch {
    state = { tasks: [] };
  }

  return state;
}

function persistState(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(getStoredState()));
}

function sortTasks(tasks: StoredTask[]): StoredTask[] {
  return [...tasks].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

function listVisibleTasks(projectId: string, sessionId: string): StoredTask[] {
  return sortTasks(getStoredState().tasks).filter(
    (task) =>
      task.projectId === projectId &&
      (task.visibility === "PUBLIC" || task.creatorId === sessionId),
  );
}

function findReadableTask(
  id: string,
  sessionId: string,
): StoredTask | undefined {
  return getStoredState().tasks.find(
    (task) =>
      task.id === id &&
      (task.visibility === "PUBLIC" || task.creatorId === sessionId),
  );
}

function findOwnedTask(id: string, sessionId: string): StoredTask | undefined {
  return getStoredState().tasks.find(
    (task) => task.id === id && task.creatorId === sessionId,
  );
}

function toContext(projectId: string, sessionId: string) {
  return {
    realmId: projectId,
    projectId,
    userId: sessionId,
  };
}

function buildMeta(
  projectId: string,
  sessionId: string,
  correlationId: string,
) {
  return {
    correlationId,
    actor: { id: sessionId, type: "user" },
    context: toContext(projectId, sessionId),
    eventVersion: "1.0",
  };
}

function buildTaskPayload(
  task: StoredTask,
  correlationId: string,
): Record<string, unknown> {
  return {
    taskId: task.id,
    title: task.title,
    projectId: task.projectId,
    creatorId: task.creatorId,
    visibility: task.visibility,
    status: task.status,
    priority: task.priority,
    clientTempId: task.clientTempId,
    assigneeId: task.assigneeId,
    _meta: buildMeta(task.projectId, task.creatorId, correlationId),
  };
}

function buildDeletePayload(
  task: StoredTask,
  correlationId: string,
): Record<string, unknown> {
  return {
    taskId: task.id,
    projectId: task.projectId,
    creatorId: task.creatorId,
    visibility: task.visibility,
    status: "deleted",
    priority: task.priority,
    _meta: buildMeta(task.projectId, task.creatorId, correlationId),
  };
}

function emitServerTrace(args: {
  stage: "mutation" | "publish" | "listener" | "broadcast";
  eventName: string;
  correlationId: string;
  sessionId: string;
  room?: string;
  payload?: Record<string, unknown>;
  status: "ok" | "error";
  detail: string;
  failureMode?: "broadcast-leak" | "missing-field";
}) {
  emitLocalTrace({
    stage: args.stage,
    domain: "task",
    eventName: args.eventName,
    correlationId: args.correlationId,
    session: args.sessionId,
    room: args.room,
    payload: args.payload,
    status: args.status,
    detail: args.detail,
    failureMode: args.failureMode,
  });
}

function queueDelivery(
  eventName: string,
  payload: Record<string, unknown>,
  room: string,
): void {
  queueMicrotask(() => {
    for (const subscriber of subscribers.values()) {
      const receivesEvent = room.startsWith("user:")
        ? room === `user:${subscriber.sessionId}`
        : room === `project:${subscriber.projectId}`;

      if (receivesEvent) {
        subscriber.onEvent(eventName, { ...payload });
      }
    }
  });
}

function publishEvent(
  eventName: string,
  payload: Record<string, unknown>,
  sessionId: string,
): void {
  const meta = payload._meta as { correlationId: string };
  const correlationId = meta.correlationId;

  emitServerTrace({
    stage: "publish",
    eventName,
    correlationId,
    sessionId,
    payload,
    status: "ok",
    detail: "emulator publish queued event",
  });

  emitServerTrace({
    stage: "listener",
    eventName,
    correlationId,
    sessionId,
    payload,
    status: "ok",
    detail: `emulator listener received ${eventName}`,
  });

  const activeFailureMode = getFailureMode();
  const projectId = String(payload.projectId ?? "");
  const creatorId = String(payload.creatorId ?? sessionId);
  const isPrivate = payload.visibility === "PRIVATE";
  let room = isPrivate ? `user:${creatorId}` : `project:${projectId}`;
  let outgoingPayload = payload;
  let status: "ok" | "error" = "ok";
  let detail = `emulator broadcast to ${room}`;
  let failureMode: "broadcast-leak" | "missing-field" | undefined;

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
    detail = "clientTempId stripped before emulator broadcast";
    failureMode = "missing-field";
  }

  emitServerTrace({
    stage: "broadcast",
    eventName,
    correlationId,
    sessionId: creatorId,
    room,
    payload: outgoingPayload,
    status,
    detail,
    failureMode,
  });

  queueDelivery(eventName, outgoingPayload, room);
}

function connectSession(
  options: SessionConnectionOptions,
): RuntimeSessionConnection {
  const subscriberId = makeId("subscriber");
  let connected = false;

  const attach = () => {
    subscribers.set(subscriberId, {
      id: subscriberId,
      sessionId: options.sessionId,
      projectId: options.projectId,
      onEvent: options.onEvent,
    });
    connected = true;
    options.onConnectedChange(true);
    options.onError(null);
  };

  const detach = () => {
    subscribers.delete(subscriberId);
    if (connected) {
      connected = false;
      options.onConnectedChange(false);
    }
  };

  attach();

  return {
    socket: null,
    reconnect: () => {
      if (!subscribers.has(subscriberId)) {
        attach();
      }
    },
    disconnect: detach,
  };
}

export const emulatorRuntime: DemoRuntime = {
  mode: "emulator",
  listTasks: async (projectId: string, sessionId: string) =>
    listVisibleTasks(projectId, sessionId).map(cloneTask),
  getTask: async (id: string, sessionId: string) => {
    const task = findReadableTask(id, sessionId);
    if (!task) {
      throw new Error("Task not found");
    }

    return cloneTask(task);
  },
  createTask: async (
    input: TaskInput & { projectId: string },
    sessionId: string,
  ) => {
    const task: StoredTask = {
      id: makeId("task"),
      title: input.title,
      projectId: input.projectId,
      creatorId: sessionId,
      visibility: input.visibility ?? "PUBLIC",
      status: "todo",
      priority: "medium",
      assigneeId: null,
      clientTempId: input.clientTempId ?? null,
      createdAt: new Date().toISOString(),
    };

    getStoredState().tasks.push(task);
    persistState();

    const correlationId = makeId("corr");
    const room =
      task.visibility === "PRIVATE"
        ? `user:${task.creatorId}`
        : `project:${task.projectId}`;
    const payload = buildTaskPayload(task, correlationId);

    emitServerTrace({
      stage: "mutation",
      eventName: "task.created",
      correlationId,
      sessionId,
      room,
      payload: { title: task.title, visibility: task.visibility },
      status: "ok",
      detail: "emulator mutation persisted before publish",
    });

    publishEvent("task.created", payload, sessionId);
    return cloneTask(task);
  },
  updateTask: async (id: string, data: TaskUpdateInput, sessionId: string) => {
    const task = findOwnedTask(id, sessionId);
    if (!task) {
      throw new Error("Task not found");
    }

    const previousAssigneeId = task.assigneeId;
    const previousPriority = task.priority;

    if (data.title !== undefined) {
      task.title = data.title;
    }
    if (data.status !== undefined) {
      task.status = data.status;
    }
    if (data.priority !== undefined) {
      task.priority = data.priority;
    }
    if (data.assigneeId !== undefined) {
      task.assigneeId = data.assigneeId;
    }
    if (data.visibility !== undefined) {
      task.visibility = data.visibility;
    }

    persistState();

    const correlationId = makeId("corr");
    const room =
      task.visibility === "PRIVATE"
        ? `user:${task.creatorId}`
        : `project:${task.projectId}`;
    const payload = buildTaskPayload(task, correlationId);

    emitServerTrace({
      stage: "mutation",
      eventName: "task.updated",
      correlationId,
      sessionId,
      room,
      payload: data as Record<string, unknown>,
      status: "ok",
      detail: "emulator mutation updated task before publish",
    });

    publishEvent("task.updated", payload, sessionId);

    if (previousAssigneeId !== task.assigneeId && task.assigneeId) {
      publishEvent(
        "task.assigned",
        {
          taskId: task.id,
          projectId: task.projectId,
          assigneeId: task.assigneeId,
          _meta: buildMeta(task.projectId, sessionId, correlationId),
        },
        sessionId,
      );
    }

    if (previousPriority !== task.priority) {
      publishEvent(
        "task.priority-changed",
        {
          taskId: task.id,
          projectId: task.projectId,
          priority: task.priority,
          _meta: buildMeta(task.projectId, sessionId, correlationId),
        },
        sessionId,
      );
    }

    return cloneTask(task);
  },
  deleteTask: async (id: string, sessionId: string) => {
    const tasks = getStoredState().tasks;
    const taskIndex = tasks.findIndex(
      (task) => task.id === id && task.creatorId === sessionId,
    );

    if (taskIndex === -1) {
      throw new Error("Task not found");
    }

    const [task] = tasks.splice(taskIndex, 1);
    persistState();

    const correlationId = makeId("corr");
    const room =
      task.visibility === "PRIVATE"
        ? `user:${task.creatorId}`
        : `project:${task.projectId}`;

    emitServerTrace({
      stage: "mutation",
      eventName: "task.deleted",
      correlationId,
      sessionId,
      room,
      payload: { taskId: task.id },
      status: "ok",
      detail: "emulator mutation deleted task before publish",
    });

    publishEvent(
      "task.deleted",
      buildDeletePayload(task, correlationId),
      sessionId,
    );
  },
  setFailureMode: async (mode: DemoFailureMode) => {
    setFailureMode(mode);
    return mode;
  },
  connectSession,
  subscribeToTraces: () => () => undefined,
};
