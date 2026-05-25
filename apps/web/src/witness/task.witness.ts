import type { DomainWitness, WitnessAssertion } from "@rivergen/witness";
// DO NOT import projection functions at the top level here.
// Projection files import React, which cannot load in the Node.js subprocess
// that runs Layer 3. Importing them here will cause Gate #12 Layer 3 to report
// a warning and silently drop all assertions for this witness file.
// Instead, use dynamic import() inside lifecycle() if you need a projection fn,
// or copy the apply* call inline after seeding the query client directly.
//
// import type { QueryClient } from "@tanstack/react-query"; // safe — types only
// import { applyTaskCreated, applyTaskUpdated, applyTaskDeleted } from "../lib/projections/task-projections"; // ← BREAKS Layer 3

// ── Payload type ───────────────────────────────────────────────────────────────
// TODO: Add every field that eventFactory.publish() sends for Task events.
//       Field names here MUST match the REST API response shape exactly — the
//       same names the UI reads from useQuery data. A mismatch means the WS
//       projection writes a field the UI never reads, causing silent data loss.
//
// TYPING RULE: testPayloads must satisfy this full type for every event.
//   Fields present on ALL events  → required  (e.g. taskId: string)
//   Fields present on SOME events → optional  (e.g. clientTempId?: string | null)
//   This lets each testPayload omit fields that particular event doesn't carry.
//   Example: if .deleted only sends taskId, mark title/status/etc as optional here.
export interface TaskPayload {
  taskId: string;
  projectId: string;
  title?: string;
  creatorId?: string;
  visibility?: "PUBLIC" | "PRIVATE";
  status?: string;
  priority?: string;
  clientTempId?: string | null;
  assigneeId?: string | null;
}

// ── Witness ────────────────────────────────────────────────────────────────────
export const taskWitness: DomainWitness<TaskPayload> = {
  domain: "task",
  events: [
    "task.created",
    "task.updated",
    "task.deleted",
    "task.assigned",
    "task.priority-changed",
  ],

  // TODO: For each event, list every field the projection reads from the payload.
  //       These are validated against the Zod schema (Layer 1) and broadcast
  //       helper (Layer 2) — any missing hop makes Gate #12 fail.
  requiredFields: {
    "task.created": [
      "taskId",
      "title",
      "projectId",
      "creatorId",
      "visibility",
      "status",
      "priority",
      "clientTempId",
    ],
    "task.updated": [
      "taskId",
      "title",
      "projectId",
      "creatorId",
      "visibility",
      "status",
      "priority",
    ],
    "task.deleted": [
      "taskId",
      "projectId",
      "creatorId",
      "visibility",
      "status",
      "priority",
    ],
    "task.assigned": ["taskId", "projectId", "assigneeId"],
    "task.priority-changed": ["taskId", "projectId", "priority"],
  },

  // TODO: One realistic test payload per event.
  //       Use fixed IDs and timestamps — no randomUUID() or new Date().
  //       Each payload must include all requiredFields for that event.
  testPayloads: {
    "task.created": {
      taskId: "task-witness-001",
      title: "Witness Test Task",
      projectId: "project-witness",
      creatorId: "user-alice",
      visibility: "PUBLIC",
      status: "todo",
      priority: "medium",
      clientTempId: "temp-task-witness-001",
      assigneeId: null,
      _meta: {
        resourceId: "task-witness-001",
        actor: { id: "user-alice", type: "user" },
        context: { realmId: "project-witness", projectId: "project-witness" },
        correlationId: "corr-task-created-01",
        eventVersion: "1.0",
      },
    },
    "task.updated": {
      taskId: "task-witness-001",
      title: "Updated Witness Task",
      projectId: "project-witness",
      creatorId: "user-alice",
      visibility: "PUBLIC",
      status: "in-progress",
      priority: "high",
      assigneeId: null,
      _meta: {
        resourceId: "task-witness-001",
        actor: { id: "user-alice", type: "user" },
        context: { realmId: "project-witness", projectId: "project-witness" },
        correlationId: "corr-task-updated-01",
        eventVersion: "1.0",
      },
    },
    "task.deleted": {
      taskId: "task-witness-001",
      projectId: "project-witness",
      creatorId: "user-alice",
      visibility: "PUBLIC",
      status: "deleted",
      priority: "high",
      _meta: {
        resourceId: "task-witness-001",
        actor: { id: "user-alice", type: "user" },
        context: { realmId: "project-witness", projectId: "project-witness" },
        correlationId: "corr-task-deleted-01",
        eventVersion: "1.0",
      },
    },
    "task.assigned": {
      taskId: "task-witness-001",
      projectId: "project-witness",
      assigneeId: "user-bob",
      _meta: {
        resourceId: "task-witness-001",
        actor: { id: "user-alice", type: "user" },
        context: { realmId: "project-witness", projectId: "project-witness" },
        correlationId: "corr-task-assigned-01",
        eventVersion: "1.0",
      },
    },
    "task.priority-changed": {
      taskId: "task-witness-001",
      projectId: "project-witness",
      priority: "urgent",
      _meta: {
        resourceId: "task-witness-001",
        actor: { id: "user-alice", type: "user" },
        context: { realmId: "project-witness", projectId: "project-witness" },
        correlationId: "corr-task-priority-changed-01",
        eventVersion: "1.0",
      },
    },
  },

  async lifecycle(queryClient): Promise<WitnessAssertion[]> {
    const { applyTaskCreated, applyTaskUpdated, applyTaskDeleted } =
      await import("../lib/projections/task-projections");

    const qc = queryClient as import("@tanstack/react-query").QueryClient;
    const listKey = ["tasks", "list", "project-witness"] as const;
    const assertions: WitnessAssertion[] = [];
    const ghostId = "temp-task-witness-001";
    const createdPayload = taskWitness.testPayloads["task.created"]!;
    const updatedPayload = taskWitness.testPayloads["task.updated"]!;
    const deletedPayload = taskWitness.testPayloads["task.deleted"]!;

    qc.setQueryData(listKey, [
      {
        id: ghostId,
        title: "Witness Test Task",
        projectId: "project-witness",
        visibility: "PUBLIC",
        status: "todo",
        priority: "medium",
        _isOptimistic: true,
      },
    ]);

    const seededGhost = (
      qc.getQueryData<Record<string, unknown>[]>(listKey) ?? []
    ).find((task) => task.id === ghostId);

    assertions.push({
      name: "ghost inserted before create",
      ok: seededGhost !== undefined,
      detail: `ghost present: ${seededGhost !== undefined}`,
    });

    applyTaskCreated(createdPayload as Record<string, unknown>, qc);

    const afterCreate =
      qc.getQueryData<Array<Record<string, unknown>>>(listKey) ?? [];
    const created = afterCreate.find((task) => task.id === "task-witness-001");
    const orphanGhost = afterCreate.find((task) => task.id === ghostId);

    assertions.push({
      name: "task.created lands in list",
      ok: created !== undefined,
      detail: `list size: ${afterCreate.length}`,
    });
    assertions.push({
      name: "ghost reconciled — no orphan",
      ok: orphanGhost === undefined && created !== undefined,
      detail: `ghost removed: ${orphanGhost === undefined}, real present: ${created !== undefined}`,
    });
    assertions.push({
      name: "title in cache after create",
      ok: created?.title === "Witness Test Task",
      detail: `got \"${String(created?.title ?? "")}\"`,
    });
    assertions.push({
      name: "projectId in cache after create",
      ok: created?.projectId === "project-witness",
      detail: `got \"${String(created?.projectId ?? "")}\"`,
    });
    assertions.push({
      name: "clientTempId preserved for reconciliation",
      ok: created?.clientTempId === ghostId,
      detail: `got \"${String(created?.clientTempId ?? "")}\"`,
    });

    applyTaskUpdated(updatedPayload as Record<string, unknown>, qc);

    const afterUpdate =
      qc.getQueryData<Array<Record<string, unknown>>>(listKey) ?? [];
    const updated = afterUpdate.find((task) => task.id === "task-witness-001");

    assertions.push({
      name: "status updated after task.updated",
      ok: updated?.status === "in-progress",
      detail: `got \"${String(updated?.status ?? "")}\"`,
    });
    assertions.push({
      name: "priority updated after task.updated",
      ok: updated?.priority === "high",
      detail: `got \"${String(updated?.priority ?? "")}\"`,
    });
    assertions.push({
      name: "title updated after task.updated",
      ok: updated?.title === "Updated Witness Task",
      detail: `got \"${String(updated?.title ?? "")}\"`,
    });

    applyTaskDeleted(deletedPayload as Record<string, unknown>, qc);

    const afterDelete =
      qc.getQueryData<Array<Record<string, unknown>>>(listKey) ?? [];
    const stillPresent = afterDelete.find(
      (task) => task.id === "task-witness-001",
    );

    assertions.push({
      name: "entity removed after task.deleted",
      ok: stillPresent === undefined,
      detail: stillPresent
        ? `still present: ${JSON.stringify(stillPresent)}`
        : "correctly absent",
    });

    return assertions;
  },

  signals: {
    "task.assigned": async (queryClient) => {
      const { applyTaskAssigned } =
        await import("../lib/projections/task-projections");
      const qc = queryClient as import("@tanstack/react-query").QueryClient;
      const listKey = ["tasks", "list", "project-witness"] as const;

      qc.setQueryData(listKey, [
        {
          id: "task-witness-001",
          title: "Test",
          projectId: "project-witness",
          visibility: "PUBLIC",
          status: "todo",
          priority: "medium",
          assigneeId: null,
        },
      ]);

      applyTaskAssigned(
        taskWitness.testPayloads["task.assigned"]! as Record<string, unknown>,
        qc,
      );

      const list =
        qc.getQueryData<Array<Record<string, unknown>>>(listKey) ?? [];
      const task = list.find((item) => item.id === "task-witness-001");

      return [
        {
          name: "assigneeId updated in cache",
          ok: task?.assigneeId === "user-bob",
          detail: `got \"${String(task?.assigneeId ?? "")}\"`,
        },
      ];
    },
    "task.priority-changed": async (queryClient) => {
      const { applyTaskPriorityChanged } =
        await import("../lib/projections/task-projections");
      const qc = queryClient as import("@tanstack/react-query").QueryClient;
      const listKey = ["tasks", "list", "project-witness"] as const;

      qc.setQueryData(listKey, [
        {
          id: "task-witness-001",
          title: "Test",
          projectId: "project-witness",
          visibility: "PUBLIC",
          status: "todo",
          priority: "medium",
        },
      ]);

      applyTaskPriorityChanged(
        taskWitness.testPayloads["task.priority-changed"]! as Record<
          string,
          unknown
        >,
        qc,
      );

      const list =
        qc.getQueryData<Array<Record<string, unknown>>>(listKey) ?? [];
      const task = list.find((item) => item.id === "task-witness-001");

      return [
        {
          name: "priority updated in cache",
          ok: task?.priority === "urgent",
          detail: `got \"${String(task?.priority ?? "")}\"`,
        },
      ];
    },
  },
};
