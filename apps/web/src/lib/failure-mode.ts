import { useSyncExternalStore } from "react";

import type { DemoFailureMode } from "@rivergen-demo/shared/river-trace";

type FailureModeListener = () => void;

let currentFailureMode: DemoFailureMode = "none";
const listeners = new Set<FailureModeListener>();

export function getFailureMode(): DemoFailureMode {
  return currentFailureMode;
}

export function setFailureMode(mode: DemoFailureMode): void {
  currentFailureMode = mode;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToFailureMode(
  listener: FailureModeListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFailureMode() {
  const mode = useSyncExternalStore(
    subscribeToFailureMode,
    getFailureMode,
    getFailureMode,
  );

  return {
    mode,
    setMode: setFailureMode,
  };
}
