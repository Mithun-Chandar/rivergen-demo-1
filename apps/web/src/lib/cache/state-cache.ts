import { QueryClient } from "@tanstack/react-query";
import { domainDispatchers } from "./domain-dispatchers/_index";

type AnyPayload = Record<string, unknown> | null | undefined;

/**
 * Routes a realtime event from WebSocketProvider into the correct domain
 * projection. Domain dispatch maps are in domain-dispatchers/<domain>.ts.
 * This file never needs to be edited — adding a domain adds a slice file
 * and regenerates the barrel.
 */
export function applyRealtimeEventToCache(
  eventName: string,
  payload: AnyPayload,
  queryClient: QueryClient,
): void {
  const handler = domainDispatchers[eventName];
  if (handler) {
    handler(payload, queryClient);
  } else if (process.env.NODE_ENV !== "production") {
    console.warn("[Dispatcher] No handler registered for event:", eventName);
  }
}
