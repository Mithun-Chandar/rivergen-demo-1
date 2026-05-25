import { createServer } from "node:http";

import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { z } from "zod";

import { registerTaskListeners } from "./lib/event-bus-listeners/task.listener";
import { getFailureMode, setFailureMode } from "./lib/failure-mode";
import { initTracer } from "./lib/river-trace";
import { taskRouter } from "./task/task.router";

const failureModeSchema = z
  .object({
    mode: z.enum([
      "none",
      "skip-projection",
      "broadcast-leak",
      "missing-field",
      "direct-cache-mutation",
    ]),
  })
  .strict();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

initTracer(io);
registerTaskListeners(io);

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    allowedHeaders: ["Content-Type", "x-session-id"],
  }),
);
app.use(express.json());

app.use((req, _res, next) => {
  const headerUserId = req.header("x-session-id")?.trim();
  const queryUserId =
    typeof req.query.sessionId === "string"
      ? req.query.sessionId.trim()
      : undefined;
  (req as express.Request & { session?: { userId?: string } }).session = {
    userId: headerUserId || queryUserId || "alice",
  };
  next();
});

app.use("/api/tasks", taskRouter);

app.get("/api/debug/failure-mode", (_req, res) => {
  res.json({ mode: getFailureMode() });
});

app.post("/api/debug/failure-mode", (req, res) => {
  const parsed = failureModeSchema.parse(req.body ?? {});
  setFailureMode(parsed.mode);
  res.json({ mode: getFailureMode() });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

io.on("connection", (socket) => {
  const authSessionId =
    typeof socket.handshake.auth.sessionId === "string"
      ? socket.handshake.auth.sessionId.trim()
      : undefined;
  const querySessionId =
    typeof socket.handshake.query.sessionId === "string"
      ? socket.handshake.query.sessionId.trim()
      : undefined;
  const sessionId = authSessionId || querySessionId || "alice";

  socket.join(`user:${sessionId}`);

  socket.on("join:task", (projectId: string) => {
    if (typeof projectId === "string" && projectId.trim()) {
      socket.join(`project:${projectId.trim()}`);
    }
  });

  socket.on("leave:task", (projectId: string) => {
    if (typeof projectId === "string" && projectId.trim()) {
      socket.leave(`project:${projectId.trim()}`);
    }
  });

  socket.on("join:debug", () => {
    socket.join("__rivergen_debug");
  });

  socket.emit("server:ready", { ok: true, sessionId });
});

app.use(
  (
    error: Error & { statusCode?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const statusCode = error.statusCode ?? 500;
    res
      .status(statusCode)
      .json({ error: error.message || "Internal Server Error" });
  },
);

const port = Number(process.env.PORT ?? 3001);

httpServer.listen(port, () => {
  console.log(`api listening on http://localhost:${port}`);
});
