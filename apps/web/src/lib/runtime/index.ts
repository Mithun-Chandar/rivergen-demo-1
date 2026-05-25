import { emulatorRuntime } from "./emulator";
import { serverRuntime } from "./server";

export type {
  DemoRuntime,
  RuntimeSessionConnection,
  SessionConnectionOptions,
  Task,
  TaskInput,
  TaskUpdateInput,
  TaskVisibility,
} from "./types";

function resolveRuntimeMode(): "server" | "emulator" {
  return import.meta.env.VITE_RUNTIME_MODE === "emulator"
    ? "emulator"
    : "server";
}

export const runtimeMode = resolveRuntimeMode();
export const demoRuntime =
  runtimeMode === "emulator" ? emulatorRuntime : serverRuntime;
