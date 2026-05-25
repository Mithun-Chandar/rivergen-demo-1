import type {
  DemoFailureMode,
  RiverTraceEvent,
} from "@rivergen-demo/shared/river-trace";
import type { Socket } from "socket.io-client";

export type TaskVisibility = "PUBLIC" | "PRIVATE";

export type Task = {
  id: string;
  taskId?: string;
  title: string;
  projectId: string;
  creatorId?: string;
  visibility: TaskVisibility;
  status: string;
  priority: string;
  assigneeId?: string | null;
  clientTempId?: string | null;
  createdAt?: string;
  _isOptimistic?: boolean;
};

export type TaskInput = {
  title: string;
  visibility?: TaskVisibility;
  clientTempId?: string;
};

export type TaskUpdateInput = Partial<
  Omit<Task, "id" | "taskId" | "projectId" | "createdAt" | "_isOptimistic">
>;

export interface SessionConnectionOptions {
  sessionId: string;
  projectId: string;
  onEvent: (
    eventName: string,
    payload: Record<string, unknown> | null | undefined,
  ) => void;
  onConnectedChange: (connected: boolean) => void;
  onError: (error: string | null) => void;
}

export interface RuntimeSessionConnection {
  socket: Socket | null;
  reconnect: () => void;
  disconnect: () => void;
}

export interface DemoRuntime {
  mode: "server" | "emulator";
  listTasks: (projectId: string, sessionId: string) => Promise<Task[]>;
  getTask: (id: string, sessionId: string) => Promise<Task>;
  createTask: (
    input: TaskInput & { projectId: string },
    sessionId: string,
  ) => Promise<Task>;
  updateTask: (
    id: string,
    data: TaskUpdateInput,
    sessionId: string,
  ) => Promise<Task>;
  deleteTask: (id: string, sessionId: string) => Promise<void>;
  setFailureMode: (mode: DemoFailureMode) => Promise<DemoFailureMode>;
  connectSession: (
    options: SessionConnectionOptions,
  ) => RuntimeSessionConnection;
  subscribeToTraces: (listener: (trace: RiverTraceEvent) => void) => () => void;
}
