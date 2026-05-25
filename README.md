# RiverGen Demo — River Control Center

> Realtime that proves itself.

RiverGen is deterministic realtime architecture tooling. This demo makes every
step of the realtime pipeline visible, testable, and provably correct,
including what happens when something breaks.

## One Repo, Two Runtimes

This repository intentionally carries two runtime modes on the same branch:

- Canonical full-stack mode: the real RiverGen demo with both `apps/api` and
  `apps/web`, SQLite persistence, Socket.IO rooms, and full local verification.
- Showcase mode: a deployment-only browser emulator used for cheap static
  hosting on Vercel so people can see the demo without paying to host the full
  backend.

The source of truth remains the full-stack app. Showcase mode is only a runtime
adapter layered on top of the same demo source so the public deployment stays
portable while cloned local runs stay real.

## Repository links

- Demo repository: https://github.com/Mithun-Chandar/rivergen-demo-1
- Main RiverGen repository: https://github.com/Mithun-Chandar/rivergen

This repository is the demo application for RiverGen. If you want the generator,
CLI, architecture rules, and the main project source, use the RiverGen
repository above. If you want the end-to-end demo implementation shown here,
use this demo repository.

## What you're looking at

- Two sessions, Alice and Bob, sharing a live task board in one browser page
- Event River in the center, tracing mutation to publish to listener to
  broadcast to websocket delivery to dispatcher to projection to cache to witness
- Failure injection, with four toggles that each break one architectural guarantee
- Witness Console, showing field continuity and projection assertions live
- A RiverGen-generated task domain that still passes the One River gates

## Relationship to RiverGen

- This demo uses `@rivergen/cli` to scaffold and verify the task domain.
- The RiverGen architectural rules enforced here come from the main RiverGen
  repository.
- Demo-specific UI, API runtime wiring, and observability surfaces live in this
  repository.

## Run locally

```bash
pnpm install
pnpm dev
```

Open the Vite URL printed in the terminal. On a clean machine it should be
`http://localhost:5173`; if that port is occupied Vite will choose the next
available port automatically.

This is the canonical way to run the project. It starts the real API and the
real web app together.

## Showcase deployment

For static hosting such as Vercel, deploy the web app in showcase mode:

```bash
pnpm build:showcase
```

From the monorepo root, the web build output is written to `apps/web/dist`,
not root `dist`. The included `vercel.json` already points Vercel at the
correct output directory.

If you configure the project manually in the Vercel dashboard, use:

- Build Command: `pnpm build:showcase`
- Output Directory: `apps/web/dist`

For a local browser-only preview of the hosted slice, use:

```bash
pnpm dev:showcase
```

In emulator mode, the showcase runs entirely in the browser, keeps the same UI,
and emulates the server-side mutation, publish, listener, and broadcast stages
for the Event River. The full-stack API app remains in this repository for
local development, cloning, and real RiverGen verification.

Hosted showcase users are seeing a browser emulator of the backend path.
Developers who clone the repository still get the complete RiverGen demo source
and should use `pnpm dev` for the proper full-stack run.

## Verify the architecture

```bash
pnpm exec rivergen verify

RiverGen — Running gate verification...

RiverGen — Gate Verification Report
Project: E:\RiverGen-Demos\rivergenDemo-1

✓ Gate #1: Mutation → EventFactory.publish
✓ Gate #2: Event → Listener → Broadcaster → socket.emit
✓ Gate #3: WS socket.on → Dispatcher → Projection call
✓ Gate #4: Projection → entity-cache helpers
✓ Gate #5: Broadcast Room Scoping (PRIVATE entities → scoped rooms)
✓ Gate #6: EventFactory Schema Coverage
✓ Gate #7: Schema .strict() Enforcement
✓ Gate #8: WebSocketProvider Entity-Cache Isolation
✓ Gate #9: No Cache Writes in onSuccess
✓ Gate #10: Optimistic UI Coverage (onMutate + onError)
○ Gate #11: Event Audit Coverage (skipped, no audit artifacts present)
✓ Gate #12: Witness — Field Continuity Coverage

✓ ALL GATES PASSED (11/11, 1 skipped)
```

## The spec that generated this

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
