import type { DemoFailureMode } from "@rivergen-demo/shared/river-trace";

let activeFailureMode: DemoFailureMode = "none";

export function getFailureMode(): DemoFailureMode {
  return activeFailureMode;
}

export function setFailureMode(mode: DemoFailureMode): void {
  activeFailureMode = mode;
}
