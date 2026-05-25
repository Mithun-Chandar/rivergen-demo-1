import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { db, type TaskRecord, type TaskVisibility } from "../lib/db";
import { eventFactory } from "../lib/event-factory/event-factory.service";
import { trace } from "../lib/river-trace";

const createTaskSchema = z
  .object({
    title: z.string().trim().min(1),
    projectId: z.string().trim().min(1),
    visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
    clientTempId: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    status: z.enum(["todo", "in-progress", "done"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    assigneeId: z.string().trim().min(1).nullable().optional(),
    visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "No task changes provided",
  });

function requireUserId(req: Request): string {
  const headerUserId = req.header("x-session-id")?.trim();
  const sessionUserId = (req as Request & { session?: { userId?: string } })
    .session?.userId;
  const userId = headerUserId || sessionUserId;
  if (!userId)
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  return userId;
}

function getTaskById(id: string): TaskRecord | undefined {
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as
    | TaskRecord
    | undefined;
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

function getOwnedTask(id: string, userId: string): TaskRecord | undefined {
  return db
    .prepare("SELECT * FROM tasks WHERE id = ? AND creatorId = ?")
    .get(id, userId) as TaskRecord | undefined;
}

function assertTaskOwner(
  task: TaskRecord | undefined,
  message: string,
): TaskRecord {
  if (!task) {
    throw Object.assign(new Error(message), { statusCode: 404 });
  }
  return task;
}

function buildEventContext(task: TaskRecord, userId: string) {
  return {
    realmId: task.projectId,
    projectId: task.projectId,
    userId,
  };
}

function buildCreateOrUpdatePayload(task: TaskRecord) {
  return {
    taskId: task.id,
    title: task.title,
    projectId: task.projectId,
    creatorId: task.creatorId,
    visibility: task.visibility,
    status: task.status,
    priority: task.priority,
    clientTempId: task.clientTempId,
    assigneeId: task.assigneeId,
  };
}

function buildDeletePayload(task: TaskRecord) {
  return {
    taskId: task.id,
    projectId: task.projectId,
    creatorId: task.creatorId,
    visibility: task.visibility,
    status: "deleted",
    priority: task.priority,
  };
}

// ── createTask ─────────────────────────────────────────────────────────────────
export async function createTask(
  data: Record<string, unknown>,
  req: Request,
): Promise<TaskRecord> {
  const userId = requireUserId(req);
  const parsed = createTaskSchema.parse(data);
  const task: TaskRecord = {
    id: randomUUID(),
    title: parsed.title,
    status: "todo",
    priority: "medium",
    assigneeId: null,
    creatorId: userId,
    projectId: parsed.projectId,
    visibility: (parsed.visibility ?? "PUBLIC") as TaskVisibility,
    clientTempId: parsed.clientTempId ?? null,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO tasks (
      id, title, status, priority, assigneeId, creatorId, projectId, visibility, clientTempId, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    task.id,
    task.title,
    task.status,
    task.priority,
    task.assigneeId,
    task.creatorId,
    task.projectId,
    task.visibility,
    task.clientTempId,
    task.createdAt,
  );

  const correlationId = randomUUID();

  trace({
    stage: "mutation",
    domain: "task",
    eventName: "task.created",
    correlationId,
    session: userId,
    room: `project:${task.projectId}`,
    payload: { title: task.title, visibility: task.visibility },
    status: "ok",
    detail: "task persisted before publish",
  });

  // LAW: event emission goes through EventFactory only
  await eventFactory.publish({
    type: "task.created",
    resourceId: task.id,
    actor: { id: userId, type: "user" },
    context: buildEventContext(task, userId),
    correlationId,
    eventVersion: "1.0",
    payload: buildCreateOrUpdatePayload(task),
  });

  return task;
}

// ── updateTask ─────────────────────────────────────────────────────────────────
export async function updateTask(
  id: string,
  data: Record<string, unknown>,
  req: Request,
): Promise<TaskRecord> {
  const userId = requireUserId(req);
  const parsed = updateTaskSchema.parse(data);
  const existing = assertTaskOwner(getOwnedTask(id, userId), "Task not found");
  const assignments: string[] = [];
  const values: unknown[] = [];

  if (parsed.title !== undefined) {
    assignments.push("title = ?");
    values.push(parsed.title);
  }
  if (parsed.status !== undefined) {
    assignments.push("status = ?");
    values.push(parsed.status);
  }
  if (parsed.priority !== undefined) {
    assignments.push("priority = ?");
    values.push(parsed.priority);
  }
  if (parsed.assigneeId !== undefined) {
    assignments.push("assigneeId = ?");
    values.push(parsed.assigneeId);
  }
  if (parsed.visibility !== undefined) {
    assignments.push("visibility = ?");
    values.push(parsed.visibility);
  }

  if (assignments.length > 0) {
    db.prepare(`UPDATE tasks SET ${assignments.join(", ")} WHERE id = ?`).run(
      ...values,
      id,
    );
  }

  const task = assertTaskOwner(
    getReadableTask(id, userId),
    "Task not found after update",
  );
  const correlationId = randomUUID();

  trace({
    stage: "mutation",
    domain: "task",
    eventName: "task.updated",
    correlationId,
    session: userId,
    room:
      task.visibility === "PRIVATE"
        ? `user:${task.creatorId}`
        : `project:${task.projectId}`,
    payload: parsed as Record<string, unknown>,
    status: "ok",
    detail: "task updated in database before publish",
  });

  // LAW: event emission goes through EventFactory only
  await eventFactory.publish({
    type: "task.updated",
    resourceId: id,
    actor: { id: userId, type: "user" },
    context: buildEventContext(task, userId),
    correlationId,
    eventVersion: "1.0",
    payload: buildCreateOrUpdatePayload(task),
  });

  if (existing.assigneeId !== task.assigneeId && task.assigneeId) {
    await eventFactory.publish({
      type: "task.assigned",
      resourceId: id,
      actor: { id: userId, type: "user" },
      context: buildEventContext(task, userId),
      correlationId,
      eventVersion: "1.0",
      payload: {
        taskId: id,
        projectId: task.projectId,
        assigneeId: task.assigneeId,
      },
    });
  }

  if (existing.priority !== task.priority) {
    await eventFactory.publish({
      type: "task.priority-changed",
      resourceId: id,
      actor: { id: userId, type: "user" },
      context: buildEventContext(task, userId),
      correlationId,
      eventVersion: "1.0",
      payload: {
        taskId: id,
        projectId: task.projectId,
        priority: task.priority,
      },
    });
  }

  return task;
}

// ── deleteTask ─────────────────────────────────────────────────────────────────
export async function deleteTask(id: string, req: Request): Promise<void> {
  const userId = requireUserId(req);
  const task = assertTaskOwner(getOwnedTask(id, userId), "Task not found");

  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);

  const correlationId = randomUUID();

  trace({
    stage: "mutation",
    domain: "task",
    eventName: "task.deleted",
    correlationId,
    session: userId,
    room:
      task.visibility === "PRIVATE"
        ? `user:${task.creatorId}`
        : `project:${task.projectId}`,
    payload: { taskId: id },
    status: "ok",
    detail: "task deleted before publish",
  });

  // LAW: event emission goes through EventFactory only
  await eventFactory.publish({
    type: "task.deleted",
    resourceId: id,
    actor: { id: userId, type: "user" },
    context: buildEventContext(task, userId),
    correlationId,
    eventVersion: "1.0",
    payload: buildDeletePayload(task),
  });
}
