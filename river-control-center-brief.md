# River Control Center — Demo Build Brief

> **For a fresh agent.** This document is entirely self-contained. Read it top to bottom before writing any code. Every architectural decision is made here — your job is to implement it faithfully, not redesign it.

---

## 1. What RiverGen Is

RiverGen (`@rivergen/cli`) is a code generator for deterministic realtime architecture on a Node/React stack. Given a JSON spec file describing a domain, it produces 12 files covering the full realtime pipeline:


https://github.com/Mithun-Chandar/rivergen

```
mutation → EventFactory.publish → EventBus → listener → broadcast → socket.io room → WebSocket → dispatcher → projection → TanStack Query cache
```

This pipeline is called **The One River**. Every event flows in one direction, through one path, with one authority at each stage. There is no direct cache mutation from components; no `onSuccess` that competes with WebSocket updates; no ad-hoc socket.on calls.

RiverGen also generates a **witness file** per domain — a typed scaffold with `lifecycle()` and `signals{}` that proves the payload fields survive the full pipeline. Witness assertions are run by `rivergen verify` (the `gate-witness-coverage` gate), which is one of 12 structural gates the CLI runs against a project.

**Install:**
```bash
npm install -g @rivergen/cli
# or in a project:
pnpm add -D @rivergen/cli
```

**Key commands:**
- `rivergen init` — writes the static infrastructure files (once per project)
- `rivergen gen specs/task.json` — generates the 12 domain files
- `rivergen plan specs/task.json` — dry-run, shows what would be generated
- `rivergen verify` — runs all 12 gates against the project

**The generated files for a domain `task`:**

| File | Layer | Purpose |
|---|---|---|
| `apps/api/src/task/task.router.ts` | Backend | Express router |
| `apps/api/src/task/task.mutations.ts` | Backend | Business logic + `eventFactory.publish()` |
| `apps/api/src/task/task.broadcast.ts` | Backend | Resolves room, calls `io.to(room).emit()` |
| `apps/api/src/lib/event-bus-listeners/task.listener.ts` | Backend | Wires EventBus → broadcast |
| `apps/api/src/lib/event-factory/schemas/task.ts` | Backend | Zod `.strict()` schema per event |
| `apps/web/src/lib/projections/task-projections.ts` | Frontend | `applyTaskCreated/Updated/Deleted` |
| `apps/web/src/hooks/use-task.ts` | Frontend | React Query hooks with ghost reconciliation |
| `apps/web/src/lib/cache/domain-dispatchers/task.ts` | Frontend | Event name → projection function map |
| `apps/web/src/providers/ws-bindings/task.ts` | Frontend | `getTaskWsBindings()` |
| `packages/shared/src/entity-projections/task.ts` | Shared | Cache key routing entry |
| `apps/web/src/lib/query-keys/task.ts` | Frontend | `taskKeys.list/detail/all` factories |
| `apps/web/src/witness/task.witness.ts` | Frontend | Field continuity contract |

After generation, files contain `// TODO` stubs you fill in. The generator writes structural wiring and scaffolding; you fill business logic and field names.

---

## 2. What We're Building and Why

### The core problem with realtime demos

Most realtime demos show: "task appeared on another screen." Nobody cares. Realtime itself is commoditised.

What engineers actually struggle with:
- Ghost persistence (optimistic entity never reconciles)
- Stale cache branches (two clients diverge silently)
- Room leakage (event reaches wrong session)
- Projection bypass (component writes cache directly)
- Signal-event inconsistency (non-CRUD event not handled)
- Payload continuity breaks (field present in mutation, stripped by schema, missing in cache)

### What we're building

**River Control Center** — not a project board. An **observability system** with a minimal collaborative app as stimulus.

The mental model is Chrome DevTools or Redux DevTools: the architecture revealing itself in real time.

```
┌─────────────────┬──────────────────────┬─────────────────┐
│  Session A      │    EVENT RIVER        │  Session B      │
│  (Alice)        │                       │  (Bob)          │
│                 │  ① mutation           │                 │
│  [task cards]   │  ② eventFactory       │  [task cards]   │
│                 │  ③ listener           │                 │
│                 │  ④ broadcast          │                 │
│                 │  ⑤ ws-delivery        │                 │
│                 │  ⑥ dispatcher         │                 │
│                 │  ⑦ projection         │                 │
│                 │  ⑧ cache-write        │                 │
│                 │  ⑨ witness            │                 │
├─────────────────┴──────────────────────┴─────────────────┤
│  FAILURE INJECTION                                        │
├───────────────────────────────────────────────────────────┤
│  WITNESS ASSERTIONS  (Layer 1 / 2 / 3 / 4)               │
└───────────────────────────────────────────────────────────┘
```

As a user creates a task, every stage in the center column lights up sequentially in real time. Both session panels update. The witness assertions turn green. Then the user flips a failure toggle — and sees exactly which stage breaks, which witness layer fails, and why.

**The tagline:** *Realtime that proves itself.*

---

## 3. Repo Structure

```
rivergen-demo/
├── apps/
│   ├── api/              # Express 5 + socket.io 4 + better-sqlite3
│   └── web/              # React + Vite + TanStack Query v5
├── packages/
│   └── shared/           # entity-projections + query-keys
├── specs/
│   └── task.json         # RiverGen domain spec
├── pnpm-workspace.yaml
├── package.json          # root (scripts only)
└── README.md
```

### `pnpm-workspace.yaml`
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Root `package.json` scripts
```json
{
  "scripts": {
    "dev": "concurrently \"pnpm --filter api dev\" \"pnpm --filter web dev\"",
    "verify": "rivergen verify"
  }
}
```

### `apps/api/package.json` dependencies
```json
{
  "name": "api",
  "dependencies": {
    "express": "^5.0.0",
    "socket.io": "^4.7.0",
    "better-sqlite3": "^9.0.0",
    "zod": "^3.22.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "tsx": "^4.0.0"
  }
}
```

### `apps/web/package.json` dependencies
```json
{
  "name": "web",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@tanstack/react-query": "^5.0.0",
    "socket.io-client": "^4.7.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^5.0.0"
  }
}
```

### `packages/shared/package.json`
```json
{
  "name": "@rivergen-demo/shared",
  "exports": {
    ".": "./src/entity-projections/_index.ts"
  }
}
```

---

## 4. Using RiverGen to Generate the Domain

### Step 1: Run `rivergen init` in `apps/web`

From the `apps/web` directory (or from repo root with `--root apps/web`):

```bash
cd apps/web
npx rivergen init
```

This writes the static infrastructure: `WebSocketProvider.tsx`, `state-cache.ts`, `entity-cache.ts`, `EventFactory`, `EventBus`, barrel stubs, and agent rules files.

**Important:** `rivergen init` expects the following project structure already present:
- `apps/api/package.json` with `express`, `socket.io`, `zod` in dependencies
- `apps/web/package.json` with `@tanstack/react-query`, `socket.io-client` in dependencies
- `packages/shared` workspace package

Run init from the **repo root**, not from within a subdirectory. The generator uses the config to resolve paths.

### Step 2: Configure `rivergen.config.ts`

Create `rivergen.config.ts` at the repo root:

```typescript
import type { RiverGenConfig } from "@rivergen/cli";

const config: RiverGenConfig = {
  api: {
    srcRoot: "apps/api/src",
  },
  web: {
    srcRoot: "apps/web/src",
  },
  shared: {
    package: "@rivergen-demo/shared",
    srcRoot: "packages/shared/src",
  },
};

export default config;
```

### Step 3: Write the spec

Create `specs/task.json`:

```json
{
  "version": 2,
  "domain": { "key": "task", "displayName": "Task" },
  "entity": { "key": "task", "eventPrefix": "task" },
  "events": [
    "task.created",
    "task.updated",
    "task.deleted",
    "task.assigned",
    "task.priority-changed"
  ],
  "room": {
    "template": "project:${projectId}",
    "visibilityField": "visibility",
    "privateRoomTemplate": "user:${creatorId}"
  }
}
```

**Why this spec:**
- 3 CRUD events → exercises ghost reconciliation, optimistic update, delete
- 2 signal events (`task.assigned`, `task.priority-changed`) → exercises signal projection stubs and `signals{}` in witness
- `visibilityField` + `privateRoomTemplate` → exercises PRIVATE routing (Failure Mode #2: broadcast leak)

### Step 4: Generate

```bash
npx rivergen gen specs/task.json
```

### Step 5: Fill the TODOs

Fill in this exact order (each file depends on decisions made in the previous):

**a. `apps/api/src/task/task.mutations.ts`**

The DB schema for tasks:
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigneeId TEXT,
  creatorId TEXT NOT NULL,
  projectId TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'PUBLIC',
  clientTempId TEXT,
  createdAt TEXT NOT NULL
);
```

Fill `createTask`:
```typescript
const task = db.prepare(`
  INSERT INTO tasks (id, title, status, priority, assigneeId, creatorId, projectId, visibility, clientTempId, createdAt)
  VALUES (?, ?, 'todo', 'medium', null, ?, ?, ?, ?, ?)
`).run(randomUUID(), data.title, data.creatorId, data.projectId, data.visibility ?? 'PUBLIC', data.clientTempId ?? null, new Date().toISOString());

await eventFactory.publish({
  type: "task.created",
  resourceId: task.lastInsertRowid as string,
  actor: { id: data.creatorId, type: "user" },
  context: { realmId: data.projectId },
  correlationId: randomUUID(),
  eventVersion: "1.0",
  payload: {
    taskId: /* id from insert */,
    title: data.title,
    projectId: data.projectId,
    creatorId: data.creatorId,
    visibility: data.visibility ?? 'PUBLIC',
    status: 'todo',
    priority: 'medium',
    clientTempId: data.clientTempId ?? null,
  },
});
```

**b. `apps/api/src/lib/event-factory/schemas/task.ts`**

Add all fields before using them in publish:
```typescript
"task.created": z.object({
  taskId: z.string(),
  title: z.string(),
  projectId: z.string(),
  creatorId: z.string(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  status: z.string(),
  priority: z.string(),
  clientTempId: z.string().nullable(),
}).strict(),

"task.assigned": z.object({
  taskId: z.string(),
  projectId: z.string(),
  assigneeId: z.string(),
}).strict(),

"task.priority-changed": z.object({
  taskId: z.string(),
  projectId: z.string(),
  priority: z.string(),
}).strict(),
```

**c. `apps/web/src/lib/projections/task-projections.ts`**

Fill context in each function:
```typescript
export function applyTaskCreated(payload: AnyPayload, queryClient: QueryClient): void {
  const taskId = payload.taskId as string | undefined;
  if (!taskId) return;
  const context = {
    projectId: payload.projectId as string,
    clientTempId: payload.clientTempId as string | undefined,
  };
  applyEntityCreate("task", { id: taskId, ...payload }, context, queryClient);
}
```

**d. `apps/web/src/hooks/use-task.ts`**

The generated hook already has room params — call sites pass `projectId`. Only fill the API call URLs:
```typescript
const res = await fetch("/api/tasks", { method: "POST", ... });
```

**e. `apps/web/src/witness/task.witness.ts`**

Fill completely — see Section 8 below for the exact witness spec.

### Step 6: Verify

```bash
npx rivergen verify
```

All 12 gates must pass. The README includes the full terminal output of this run.

---

## 5. The RiverTraceEvent Schema — The Backbone

This is the most important architectural decision. Define this before writing any UI code.

Every stage of the pipeline emits a trace event on a separate `__rivergen_debug` socket.io room. The frontend subscribes to this room and renders the Event River.

```typescript
// packages/shared/src/river-trace.ts

export type RiverTraceStage =
  | "mutation"
  | "publish"
  | "listener"
  | "broadcast"
  | "ws-delivery"
  | "dispatcher"
  | "projection"
  | "cache-write"
  | "witness";

export interface RiverTraceEvent {
  id: string;                    // nanoid — unique per trace event
  correlationId: string;         // ties all stages of one mutation together
  stage: RiverTraceStage;
  domain: string;                // "task"
  eventName: string;             // "task.created"
  timestamp: number;             // Date.now()
  session?: string;              // "alice" | "bob" — which session triggered/received
  room?: string;                 // "project:alpha"
  payload?: Record<string, unknown>;
  status: "ok" | "error" | "skipped";
  detail?: string;               // human-readable note (e.g. "projected to ['tasks','list','alpha']")
  failureMode?: FailureMode;     // set when a failure toggle caused this
}

export type FailureMode =
  | "skip-projection"
  | "broadcast-leak"
  | "missing-field"
  | "direct-cache-mutation";
```

**How it flows:**

1. `task.mutations.ts` emits `{ stage: "mutation" }` before calling `eventFactory.publish()`
2. `EventFactory` emits `{ stage: "publish" }` after schema validation
3. `task.listener.ts` emits `{ stage: "listener" }` when EventBus fires
4. `task.broadcast.ts` emits `{ stage: "broadcast", room }` before `io.to(room).emit()`
5. A socket.io middleware on the frontend emits `{ stage: "ws-delivery", session }` when the event arrives
6. `domain-dispatchers/task.ts` wraps each handler and emits `{ stage: "dispatcher" }`
7. `task-projections.ts` emits `{ stage: "projection" }` after `applyEntityCreate/Update/Delete`
8. `entity-cache.ts` emits `{ stage: "cache-write", detail: "['tasks','list','alpha']" }` after `setQueriesData`
9. After a mutation, the witness `lifecycle()` runs and emits `{ stage: "witness", status: "ok"|"error" }`

**How to emit from the backend:**

Add a helper module `apps/api/src/lib/river-trace.ts`:
```typescript
import type { Server } from "socket.io";
import { nanoid } from "nanoid";
import type { RiverTraceEvent } from "@rivergen-demo/shared/river-trace";

let _io: Server | null = null;

export function initTracer(io: Server) { _io = io; }

export function trace(event: Omit<RiverTraceEvent, "id" | "timestamp">) {
  if (!_io) return;
  const full: RiverTraceEvent = { ...event, id: nanoid(), timestamp: Date.now() };
  _io.to("__rivergen_debug").emit("river:trace", full);
}
```

Call `initTracer(io)` in your server setup. Then call `trace({...})` at each instrumentation point.

**How to emit from the frontend:**

The frontend cannot directly call the trace helper. Instead:
- `ws-delivery`: intercept in the `WebSocketProvider` before routing to `applyRealtimeEventToCache`
- `dispatcher`, `projection`, `cache-write`, `witness`: wrap each generated function with a thin tracing shim

The frontend also joins the `__rivergen_debug` room on socket connect:
```typescript
socket.emit("join:debug");
// server: socket.on("join:debug", () => socket.join("__rivergen_debug"))
```

---

## 6. Backend Instrumentation Points

Instrument these exact locations. Do not modify the generated files themselves — wrap them from outside or add trace calls to the fill-in TODOs.

### `task.mutations.ts`
```typescript
// At the top of createTask, before eventFactory.publish:
const correlationId = randomUUID();
trace({ stage: "mutation", domain: "task", eventName: "task.created",
  correlationId, room: `project:${data.projectId}`,
  payload: { title: data.title }, status: "ok" });

// Pass correlationId into eventFactory.publish()
```

### `task.listener.ts`
```typescript
// The listener is pure wiring — wrap the handler:
eventBus.subscribe("task.*", (envelope) => {
  trace({ stage: "listener", domain: "task", eventName: envelope.type,
    correlationId: envelope.correlationId, status: "ok" });
  broadcastTaskEvent(io, envelope.type, envelope.payload);
});
```

### `task.broadcast.ts`
```typescript
// Before io.to(room).emit:
trace({ stage: "broadcast", domain: "task", eventName,
  correlationId: payload.correlationId as string,
  room, status: "ok" });
io.to(room).emit(eventName, payload);
```

---

## 7. Frontend Architecture

### App entry — two sessions, one page

The demo runs in a **single browser tab** with two side-by-side React trees, each with its own `QueryClient`, its own socket connection, and its own session identity. This makes the multi-session demo reproducible without opening two browser windows.

```tsx
// apps/web/src/App.tsx
import { SessionPane } from "./components/SessionPane";
import { EventRiver } from "./components/EventRiver";
import { FailureInjector } from "./components/FailureInjector";
import { WitnessConsole } from "./components/WitnessConsole";

export function App() {
  return (
    <div className="rcc-layout">
      <div className="rcc-sessions">
        <SessionPane sessionId="alice" projectId="alpha" />
        <EventRiver />
        <SessionPane sessionId="bob" projectId="alpha" />
      </div>
      <FailureInjector />
      <WitnessConsole />
    </div>
  );
}
```

Each `SessionPane` wraps its own `QueryClientProvider` + `WebSocketProvider` with a `sessionId` prop. The `sessionId` is sent as a socket handshake auth header and included in trace events.

### Room isolation demo

Add a project selector at the top of each `SessionPane` — a toggle between "Project Alpha" and "Project Beta". When Alice is in Alpha and Bob is in Beta, events do not cross. Switching Bob to Alpha makes him receive Alice's events. This is the room scoping demonstration.

### `FailureContext`

A React context that holds the current active failure mode:

```typescript
type FailureMode = "none" | "skip-projection" | "broadcast-leak" | "missing-field" | "direct-cache-mutation";

const FailureContext = createContext<{
  mode: FailureMode;
  setMode: (m: FailureMode) => void;
}>({ mode: "none", setMode: () => {} });
```

When `mode !== "none"`, the relevant instrumented wrapper intercepts the normal flow and emits a trace event with `status: "error"` and `failureMode` set.

---

## 8. UI Components in Detail

### `EventRiver`

The center column. Subscribes to the `__rivergen_debug` room and renders a scrolling timeline of `RiverTraceEvent` entries.

**Visual rules:**
- Each stage has a fixed colour: mutation=blue, publish=indigo, listener=violet, broadcast=orange, ws-delivery=yellow, dispatcher=green, projection=teal, cache-write=emerald, witness=white
- `status: "ok"` → stage row glows its colour for 800ms then dims
- `status: "error"` → row glows red, stays red, shows `detail` as error text
- `status: "skipped"` → row shown in grey with strikethrough (used by failure modes)
- Events with the same `correlationId` are grouped — clicking a group expands payload detail
- The river auto-scrolls but pauses on hover

```typescript
interface EventRiverProps {}

// Internal state:
// traces: RiverTraceEvent[]  — last 50, newest at bottom
// Subscribe to socket "river:trace" event and append to traces
```

### `SessionPane`

Left and right panels. Contains:
- Session identity badge (Alice / Bob + coloured avatar)
- Project room badge (`project:alpha` / `project:beta`)
- Task list from `useTaskList(projectId)` for this session's `QueryClient`
- Task creation input
- Ghost task cards: semi-transparent with spinner, `id` shown as `temp-xxx`
- Real task cards: fully opaque, `id` shown as real UUID

The ghost → real transition should be animated (300ms fade from semi-transparent to opaque, `temp-xxx` ID morphs to real UUID). This is the ghost reconciliation cinematic moment.

### `FailureInjector`

Bottom panel — four toggles, exactly these four, no more:

```
[ ] Skip Projection      — event arrives at cache layer, projection function is never called
[ ] Broadcast Leak       — PRIVATE task emitted to public room (Charlie receives it)
[ ] Missing Payload Field  — clientTempId stripped from payload before broadcast
[ ] Direct Cache Mutation  — component calls setQueryData instead of applyEntityCreate
```

Each toggle shows a one-line description of what breaks and which witness layer catches it.

When a toggle is active, the toggle button glows red. The Event River shows the failure stage in red. The Witness Console shows the failing assertion in red.

**Implementation approach:** Each failure mode is implemented as an interception shim, not by actually breaking the architecture. The shims are thin middleware layers around the relevant functions that, when the toggle is active, either:
- Skip calling the real function (skip-projection, skip broadcast)
- Modify the payload before passing it (missing-field)
- Call `queryClient.setQueryData` directly before the real projection runs (direct-cache-mutation)

This means the real generated code is never changed — the failure modes demonstrate what goes wrong when someone violates the architecture.

### `WitnessConsole`

Bottom panel (below FailureInjector). Shows the witness assertions for the task domain as they run.

**Display format:**

```
WITNESS — task domain                            [RUN]

Layer 1 — Schema Coverage
  ✓  taskId present in task.created schema
  ✓  clientTempId present in task.created schema

Layer 2 — Broadcast Field Coverage
  ✓  taskId present in task.created broadcast
  ✓  clientTempId present in task.created broadcast

Layer 3 — Projection Proof
  ✓  Ghost inserted into cache (temp-task-1748...)
  ✓  WS event received
  ✓  Ghost reconciled → real ID (task-uuid-...)
  ✓  No orphan optimistic entities

  Signals:
  ✓  task.assigned: assigneeId updated in cache
  ✓  task.priority-changed: priority updated in cache

Layer 4 — Witness File Structure
  ✓  requiredFields declared
  ✓  testPayloads present
  ✓  lifecycle() implemented
  ✓  signals{} non-empty
```

The `[RUN]` button calls the witness `lifecycle()` function programmatically using a fresh `QueryClient` (no backend needed for layers 1, 2, 4 — layer 3 runs against the live cache after a real mutation). Each assertion line updates live as assertions complete.

When a failure toggle is active, the failing assertion shows in red with the expected vs received values.

---

## 9. The Four Failure Modes in Detail

### Mode 1: Skip Projection

**What it does:** The `task.created` WS event is received by the dispatcher but the projection function is never called. The cache is never updated.

**What the user sees:**
- Alice creates a task
- Event River: mutation → publish → listener → broadcast → ws-delivery → dispatcher → **[projection: SKIPPED, red]**
- Bob's session: task never appears
- Alice's ghost: never reconciles, stays as `temp-xxx` permanently
- Witness Layer 3: `✗ Ghost reconciled → real ID — expected task-uuid-xxx, got undefined`

**Implementation:** Wrap `applyTaskCreated` in the dispatcher with a shim that checks `FailureContext`. When mode is `skip-projection`, log the trace event with `status: "skipped"` and return without calling the real function.

---

### Mode 2: Broadcast Leak

**What it does:** A PRIVATE task (visibility: "PRIVATE") is broadcast to the public project room instead of the creator's private room. Bob receives Alice's private task.

**What the user sees:**
- Alice creates a task with visibility PRIVATE
- Event River: broadcast stage shows `room: project:alpha` in red (should be `user:alice`)
- Bob's session: Alice's private task appears (it should not)
- Room scoping visualizer shows "Delivered to: Alice ✓, Bob ✗ → ⚠ LEAKED"
- Witness Layer 3: `✗ PRIVATE task not leaked — received by non-owner session`

**Implementation:** In the broadcast shim, when mode is `broadcast-leak`, always use the public room template regardless of `isPrivate`.

---

### Mode 3: Missing Payload Field

**What it does:** `clientTempId` is stripped from the payload before broadcast. The WS event arrives without `clientTempId`, so `applyEntityCreate` cannot find the ghost to reconcile.

**What the user sees:**
- Alice creates a task
- Ghost appears immediately
- WS event arrives (ws-delivery shows `clientTempId: undefined` in red)
- Ghost is not removed — a duplicate appears (real entity inserted alongside the ghost)
- Witness Layer 3: `✗ Ghost reconciled → real ID — expected clientTempId "temp-task-xxx", got null`

**Implementation:** In the broadcast shim, when mode is `missing-field`, delete `payload.clientTempId` before `io.to(room).emit()`.

---

### Mode 4: Direct Cache Mutation

**What it does:** Instead of using `applyEntityCreate` (which goes through the entity-projection registry), a component calls `queryClient.setQueryData(["tasks","list","alpha"], ...)` directly. This bypasses the projection authority.

**What the user sees:**
- Alice creates a task
- Event River: projection stage shows `BYPASS DETECTED` in red, cache-write shows `direct setQueryData` in red
- Bob's session: task appears BUT with a slightly different shape (the direct write doesn't clean up ghost properly — duplicate or malformed entry)
- Witness Layer 3: `✗ Projection authority preserved — direct cache mutation detected`
- The Witness Console shows the architectural violation message

**Implementation:** A shim that, when mode is `direct-cache-mutation`, calls `queryClient.setQueryData(["tasks","list",projectId], updatedList)` directly before the real `applyEntityCreate` runs. Because both run, the result is a malformed/duplicate entry — visually demonstrating why projection authority matters.

---

## 10. The Witness File — Complete Spec

This is the centrepiece of the demo's technical credibility. Fill it completely. Do not leave any `// TODO` stubs.

```typescript
// apps/web/src/witness/task.witness.ts

import type { DomainWitness } from "@rivergen/witness";

export interface TaskPayload {
  taskId: string;
  title: string;
  projectId: string;
  creatorId: string;
  visibility: "PUBLIC" | "PRIVATE";
  status: string;
  priority: string;
  clientTempId?: string | null;  // optional — not present on all events
  assigneeId?: string;           // optional — only on task.assigned
}

export const taskWitness: DomainWitness<TaskPayload> = {
  domain: "task",

  requiredFields: [
    "taskId",
    "title",
    "projectId",
    "creatorId",
    "visibility",
    "status",
    "priority",
  ],

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
    },
    "task.updated": {
      taskId: "task-witness-001",
      title: "Updated Witness Task",
      projectId: "project-witness",
      creatorId: "user-alice",
      visibility: "PUBLIC",
      status: "in-progress",
      priority: "high",
    },
    "task.deleted": {
      taskId: "task-witness-001",
      projectId: "project-witness",
      creatorId: "user-alice",
      visibility: "PUBLIC",
      status: "deleted",
      priority: "medium",
    },
    "task.assigned": {
      taskId: "task-witness-001",
      projectId: "project-witness",
      assigneeId: "user-bob",
    },
    "task.priority-changed": {
      taskId: "task-witness-001",
      projectId: "project-witness",
      priority: "urgent",
    },
  },

  async lifecycle(queryClient: unknown) {
    const { applyTaskCreated, applyTaskUpdated, applyTaskDeleted } =
      await import("../lib/projections/task-projections");
    const qc = queryClient as import("@tanstack/react-query").QueryClient;
    const listKey = ["tasks", "list", "project-witness"];

    // Seed ghost
    qc.setQueryData(listKey, [
      { id: "temp-task-witness-001", title: "Witness Test Task", _isOptimistic: true },
    ]);

    // Apply create — should reconcile ghost
    applyTaskCreated(
      {
        taskId: "task-witness-001",
        title: "Witness Test Task",
        projectId: "project-witness",
        creatorId: "user-alice",
        visibility: "PUBLIC",
        status: "todo",
        priority: "medium",
        clientTempId: "temp-task-witness-001",
      },
      qc,
    );

    const afterCreate = qc.getQueryData<TaskPayload[]>(listKey) ?? [];
    const created = afterCreate.find((t) => t.taskId === "task-witness-001" || t.id === "task-witness-001");
    const ghost = afterCreate.find((t) => t.id === "temp-task-witness-001");

    // Apply update
    applyTaskUpdated(
      { taskId: "task-witness-001", projectId: "project-witness", status: "in-progress", priority: "high",
        title: "Updated Witness Task", creatorId: "user-alice", visibility: "PUBLIC" },
      qc,
    );
    const afterUpdate = qc.getQueryData<TaskPayload[]>(listKey) ?? [];
    const updated = afterUpdate.find((t) => t.id === "task-witness-001");

    // Apply delete
    applyTaskDeleted({ taskId: "task-witness-001", projectId: "project-witness",
      creatorId: "user-alice", visibility: "PUBLIC", status: "deleted", priority: "high" }, qc);
    const afterDelete = qc.getQueryData<TaskPayload[]>(listKey) ?? [];
    const stillPresent = afterDelete.find((t) => t.id === "task-witness-001");

    return [
      { name: "ghost inserted before create", ok: ghost !== undefined || created !== undefined,
        detail: `ghost: ${ghost?.id}, real: ${created?.id}` },
      { name: "ghost reconciled — no orphan", ok: ghost === undefined && created !== undefined,
        detail: `ghost removed: ${ghost === undefined}, real present: ${created !== undefined}` },
      { name: "title in cache after create", ok: created?.title === "Witness Test Task",
        detail: `got "${created?.title}"` },
      { name: "status updated after task.updated", ok: updated?.status === "in-progress",
        detail: `got "${updated?.status}"` },
      { name: "entity removed after task.deleted", ok: stillPresent === undefined,
        detail: stillPresent ? `still present: ${JSON.stringify(stillPresent)}` : "correctly absent" },
    ];
  },

  signals: {
    "task.assigned": async (queryClient: unknown) => {
      const { applyTaskAssigned } = await import("../lib/projections/task-projections");
      const qc = queryClient as import("@tanstack/react-query").QueryClient;
      const listKey = ["tasks", "list", "project-witness"];

      qc.setQueryData(listKey, [
        { id: "task-witness-001", title: "Test", assigneeId: null, projectId: "project-witness" },
      ]);

      applyTaskAssigned({ taskId: "task-witness-001", projectId: "project-witness", assigneeId: "user-bob" }, qc);

      const list = qc.getQueryData<TaskPayload[]>(listKey) ?? [];
      const task = list.find((t) => t.id === "task-witness-001");

      return [
        { name: "assigneeId updated in cache", ok: task?.assigneeId === "user-bob",
          detail: `got "${task?.assigneeId}"` },
      ];
    },

    "task.priority-changed": async (queryClient: unknown) => {
      const { applyTaskPriorityChanged } = await import("../lib/projections/task-projections");
      const qc = queryClient as import("@tanstack/react-query").QueryClient;
      const listKey = ["tasks", "list", "project-witness"];

      qc.setQueryData(listKey, [
        { id: "task-witness-001", title: "Test", priority: "medium", projectId: "project-witness" },
      ]);

      applyTaskPriorityChanged({ taskId: "task-witness-001", projectId: "project-witness", priority: "urgent" }, qc);

      const list = qc.getQueryData<TaskPayload[]>(listKey) ?? [];
      const task = list.find((t) => t.id === "task-witness-001");

      return [
        { name: "priority updated in cache", ok: task?.priority === "urgent",
          detail: `got "${task?.priority}"` },
      ];
    },
  },
};
```

---

## 11. v1 Scope — What NOT to Build

These are explicitly out of scope for v1. Do not build them even if they seem easy:

| Out of scope | Why |
|---|---|
| Timeline replay / pause | Scope trap — adds weeks, not needed to prove the argument |
| Topology graph | Same — a diagram in the README covers this just as well |
| Session C | Two sessions prove the point; three add complexity with no new argument |
| Authentication / user accounts | Hardcoded Alice/Bob is enough — auth distracts from architecture |
| Multiple domains | One domain done right is more powerful than two done halfway |
| Production deployment | Local SQLite, local server — clone and run is the target |
| Polished product UI | Minimal, readable, functional — not beautiful |
| Advanced animations | The ghost reconcile animation is the one animation worth spending time on |

---

## 12. Success Criteria

The demo is done when ALL of the following are true:

1. `pnpm install && pnpm dev` starts both server and web with no errors
2. `npx rivergen verify` runs from the repo root and outputs 12/12 gates passing — include this transcript in `README.md`
3. Alice creates a task → Event River shows all 9 stages lighting up sequentially
4. Bob (same project) sees the task appear in real time
5. Ghost reconciliation is visible: ghost card appears, then morphs to real entity with real ID
6. Alice switches to Project Beta, Bob stays in Alpha → Alice's tasks no longer appear for Bob (room isolation)
7. All 4 failure toggles work: each breaks the correct stage, each shows the correct witness failure
8. `[RUN]` button in Witness Console runs `lifecycle()` and all assertions pass (green)
9. Flipping failure toggles makes the corresponding witness assertion fail (red) and recover when toggled off
10. The README explains the demo in 5 bullets and includes the `rivergen verify` transcript

---

## 13. README Structure

```markdown
# RiverGen Demo — River Control Center

> Realtime that proves itself.

RiverGen is deterministic realtime architecture tooling. This demo makes
every step of the realtime pipeline visible, testable, and provably correct —
including what happens when something breaks.

## What you're looking at

- **Two sessions** (Alice + Bob) sharing a live task board
- **Event River** (center) — every mutation traces through mutation → eventFactory
  → listener → broadcast → WebSocket → dispatcher → projection → cache → witness
- **Failure injection** — flip a toggle to break a specific architectural guarantee
  and watch the system show you exactly where and why
- **Witness Console** — runtime assertions proving the payload survived the full
  pipeline, layer by layer

## Run locally

pnpm install
pnpm dev
# open http://localhost:5173

## Verify the architecture

npx rivergen verify

[PASTE FULL 12/12 GATE TRANSCRIPT HERE]

## The spec that generated this

[PASTE specs/task.json]
```

---

## Appendix: File Creation Order

Build in this order to avoid circular dependency problems:

1. Repo scaffold (pnpm workspace, package.json files)
2. `rivergen init` (generates static infra)
3. `rivergen gen specs/task.json` (generates domain files)
4. Fill TODOs: mutations → schemas → projections → hooks → witness
5. `rivergen verify` — confirm 12/12 before adding observability layer
6. `RiverTraceEvent` schema in `packages/shared/src/river-trace.ts`
7. Backend trace instrumentation (`river-trace.ts` helper + instrument mutations/listener/broadcast)
8. Frontend: `FailureContext` + socket debug room join
9. Frontend: `EventRiver` component
10. Frontend: `SessionPane` with ghost reconciliation animation
11. Frontend: `FailureInjector` toggles + shims
12. Frontend: `WitnessConsole` with live `lifecycle()` runner
13. CSS layout (grid: sessions | river | sessions, failure panel, witness panel)
14. Confirm all 10 success criteria pass
15. Capture `rivergen verify` transcript, write README
