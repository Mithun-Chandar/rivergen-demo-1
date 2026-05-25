import { randomUUID } from "node:crypto";

import type { RiverTraceEvent } from "@rivergen-demo/shared/river-trace";
import type { Server } from "socket.io";

let ioInstance: Server | null = null;

export function initTracer(io: Server): void {
  ioInstance = io;
}

export function trace(event: Omit<RiverTraceEvent, "id" | "timestamp">): void {
  if (!ioInstance) {
    return;
  }

  ioInstance.to("__rivergen_debug").emit("river:trace", {
    ...event,
    id: randomUUID(),
    timestamp: Date.now(),
  } satisfies RiverTraceEvent);
}
