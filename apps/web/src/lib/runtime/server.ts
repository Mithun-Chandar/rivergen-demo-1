import type {
  DemoFailureMode,
  RiverTraceEvent,
} from "@rivergen-demo/shared/river-trace";
import { io } from "socket.io-client";

import { getAllWsBindings } from "../../providers/ws-bindings/_index";
import type {
  DemoRuntime,
  RuntimeSessionConnection,
  SessionConnectionOptions,
  Task,
  TaskInput,
  TaskUpdateInput,
} from "./types";

function getSocketUrl(): string {
  return import.meta.env.VITE_WS_URL?.trim() || "http://localhost:3001";
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  return readJsonOrThrow<T>(response);
}

function connectSession(
  options: SessionConnectionOptions,
): RuntimeSessionConnection {
  const socket = io(getSocketUrl(), {
    autoConnect: false,
    transports: ["websocket"],
    auth: { sessionId: options.sessionId },
  });

  socket.on("connect", () => {
    options.onConnectedChange(true);
    options.onError(null);
    socket.emit("join:task", options.projectId);
  });

  socket.on("disconnect", () => {
    options.onConnectedChange(false);
  });

  socket.on("connect_error", (socketError: Error) => {
    options.onConnectedChange(false);
    options.onError(socketError.message || "WebSocket connection failed");
  });

  for (const eventName of getAllWsBindings()) {
    socket.on(eventName, (payload: Record<string, unknown> | undefined) => {
      options.onEvent(eventName, payload);
    });
  }

  socket.connect();

  return {
    socket,
    reconnect: () => socket.connect(),
    disconnect: () => {
      socket.off();
      socket.disconnect();
    },
  };
}

function subscribeToTraces(
  listener: (trace: RiverTraceEvent) => void,
): () => void {
  const socket = io(getSocketUrl(), {
    transports: ["websocket"],
    auth: { sessionId: "observer" },
  });

  socket.on("connect", () => {
    socket.emit("join:debug");
  });

  socket.on("river:trace", listener);

  return () => {
    socket.off();
    socket.disconnect();
  };
}

export const serverRuntime: DemoRuntime = {
  mode: "server",
  listTasks: (projectId, sessionId) => {
    const query = new URLSearchParams({ projectId });
    return fetchJson<Task[]>(`/api/tasks?${query.toString()}`, {
      headers: { "x-session-id": sessionId },
    });
  },
  getTask: (id, sessionId) =>
    fetchJson<Task>(`/api/tasks/${id}`, {
      headers: { "x-session-id": sessionId },
    }),
  createTask: (input: TaskInput & { projectId: string }, sessionId) =>
    fetchJson<Task>("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId,
      },
      body: JSON.stringify(input),
    }),
  updateTask: (id: string, data: TaskUpdateInput, sessionId: string) =>
    fetchJson<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId,
      },
      body: JSON.stringify(data),
    }),
  deleteTask: async (id: string, sessionId: string) => {
    const response = await fetch(`/api/tasks/${id}`, {
      method: "DELETE",
      headers: { "x-session-id": sessionId },
    });
    await readJsonOrThrow<void>(response);
  },
  setFailureMode: (mode: DemoFailureMode) =>
    fetchJson<{ mode: DemoFailureMode }>("/api/debug/failure-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    }).then((result) => result.mode),
  connectSession,
  subscribeToTraces,
};
