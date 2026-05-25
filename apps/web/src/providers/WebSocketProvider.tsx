"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";

import { getFailureMode } from "../lib/failure-mode";
import { emitLocalTrace, getTraceContextInfo } from "../lib/trace-client";
import { applyRealtimeEventToCache } from "../lib/cache/state-cache";
import { getAllWsBindings } from "./ws-bindings/_index";

interface WebSocketContextValue {
  socket: Socket | null;
  connected: boolean;
  enabled: boolean;
  error: string | null;
  reconnect: () => void;
}

export const WebSocketContext = createContext<WebSocketContextValue | null>(
  null,
);

function getSocketUrl(): string {
  return import.meta.env.VITE_WS_URL?.trim() || "http://localhost:3001";
}

export function WebSocketProvider({
  children,
  sessionId,
  projectId,
}: {
  children: ReactNode;
  sessionId: string;
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const previousProjectIdRef = useRef(projectId);

  const reconnect = useCallback(() => {
    socketRef.current?.connect();
  }, []);

  useEffect(() => {
    const socketUrl = getSocketUrl();

    setEnabled(true);

    const socket = io(socketUrl, {
      autoConnect: false,
      transports: ["websocket"],
      auth: { sessionId },
    });

    const routeEvent = (eventName: string) => (payload: unknown) => {
      const traceContext = getTraceContextInfo(
        eventName,
        payload as Record<string, unknown> | null | undefined,
      );
      const activeFailureMode = getFailureMode();
      const payloadRecord = payload as
        | Record<string, unknown>
        | null
        | undefined;
      let status: "ok" | "error" = "ok";
      let detail = `received in ${sessionId}`;
      let failureMode:
        | import("@rivergen-demo/shared/river-trace").FailureMode
        | undefined;

      if (
        activeFailureMode === "missing-field" &&
        eventName === "task.created" &&
        payloadRecord &&
        payloadRecord.clientTempId === undefined
      ) {
        status = "error";
        detail = "clientTempId: undefined";
        failureMode = "missing-field";
      }

      if (
        activeFailureMode === "broadcast-leak" &&
        payloadRecord?.visibility === "PRIVATE" &&
        payloadRecord.creatorId !== sessionId
      ) {
        status = "error";
        detail = "PRIVATE event delivered to non-owner session";
        failureMode = "broadcast-leak";
      }

      emitLocalTrace({
        stage: "ws-delivery",
        domain: traceContext.domain,
        eventName,
        correlationId: traceContext.correlationId,
        session: sessionId,
        room: `project:${projectId}`,
        payload: traceContext.payload,
        status,
        detail,
        failureMode,
      });

      applyRealtimeEventToCache(eventName, payloadRecord, queryClient);
    };

    // Lifecycle handlers
    socket.on("connect", () => {
      setConnected(true);
      setError(null);
      socket.emit("join:task", projectId);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("connect_error", (socketError: Error) => {
      setConnected(false);
      setError(socketError.message || "WebSocket connection failed");
    });

    // Register all domain event bindings from ws-bindings slices
    for (const event of getAllWsBindings()) {
      socket.on(event, routeEvent(event));
    }

    socket.connect();
    socketRef.current = socket;
    previousProjectIdRef.current = projectId;

    return () => {
      socket.off();
      socket.disconnect();
      socketRef.current = null;
      setEnabled(false);
      setConnected(false);
    };
  }, [projectId, queryClient, sessionId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !connected) {
      return;
    }

    const previousProjectId = previousProjectIdRef.current;
    if (previousProjectId !== projectId) {
      socket.emit("leave:task", previousProjectId);
      socket.emit("join:task", projectId);
      previousProjectIdRef.current = projectId;
    }
  }, [connected, projectId]);

  const value = useMemo<WebSocketContextValue>(
    () => ({
      socket: socketRef.current,
      connected,
      enabled,
      error,
      reconnect,
    }),
    [connected, enabled, error, reconnect],
  );

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used inside WebSocketProvider");
  }
  return context;
}
