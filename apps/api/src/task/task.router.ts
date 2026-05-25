import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { db, type TaskRecord } from "../lib/db";
import { createTask, updateTask, deleteTask } from "./task.mutations";

// TODO: import your auth/permission middleware
// import { requirePermission } from "../lib/auth/permissions";

const taskListQuerySchema = z
  .object({
    projectId: z.string().trim().min(1),
  })
  .strict();

function requireUserId(req: Request): string {
  const headerUserId = req.header("x-session-id")?.trim();
  const sessionUserId = (req as Request & { session?: { userId?: string } })
    .session?.userId;
  const userId = headerUserId || sessionUserId;
  if (!userId) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }
  return userId;
}

function getReadableTask(id: string, userId: string): TaskRecord | undefined {
  return db
    .prepare(
      `SELECT *
       FROM tasks
       WHERE id = ?
         AND (visibility = 'PUBLIC' OR creatorId = ?)`,
    )
    .get(id, userId) as TaskRecord | undefined;
}

export const taskRouter = Router();

// ── GET /:id ──────────────────────────────────────────────────────────────────
taskRouter.get("/:id", async (req: Request, res: Response) => {
  // TODO: requirePermission(req, "task:read")
  const userId = requireUserId(req);
  const task = getReadableTask(String(req.params.id), userId);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(task);
});

// ── GET / (list) ──────────────────────────────────────────────────────────────
taskRouter.get("/", async (req: Request, res: Response) => {
  // TODO: requirePermission(req, "task:read")
  const userId = requireUserId(req);
  const query = taskListQuerySchema.parse({
    projectId: req.query.projectId,
  });
  const tasks = db
    .prepare(
      `SELECT *
       FROM tasks
       WHERE projectId = ?
         AND (visibility = 'PUBLIC' OR creatorId = ?)
       ORDER BY createdAt DESC`,
    )
    .all(query.projectId, userId) as TaskRecord[];
  res.json(tasks);
});

// ── POST / (create) ───────────────────────────────────────────────────────────
taskRouter.post("/", async (req: Request, res: Response) => {
  // TODO: requirePermission(req, "task:create")
  const result = await createTask(req.body, req);
  res.status(201).json(result);
});

// ── PATCH /:id (update) ───────────────────────────────────────────────────────
taskRouter.patch("/:id", async (req: Request, res: Response) => {
  // TODO: requirePermission(req, "task:update")
  const result = await updateTask(String(req.params.id), req.body, req);
  res.json(result);
});
// ── DELETE /:id ───────────────────────────────────────────────────────────────
taskRouter.delete("/:id", async (req: Request, res: Response) => {
  // TODO: requirePermission(req, "task:delete")
  await deleteTask(String(req.params.id), req);
  res.status(204).end();
});
