import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";

import { useCreateTask, useDeleteTask, useTaskList } from "../hooks/use-task";
import {
  SessionPaneContextProvider,
  useSessionPane,
} from "../lib/session-context";
import {
  WebSocketProvider,
  useWebSocket,
} from "../providers/WebSocketProvider";

const SESSION_META = {
  alice: { displayName: "Alice", accent: "blue" as const },
  bob: { displayName: "Bob", accent: "amber" as const },
};

const PROJECT_OPTIONS = [
  { id: "alpha", label: "Project Alpha" },
  { id: "beta", label: "Project Beta" },
];

type TaskCard = {
  id: string;
  taskId?: string;
  title: string;
  visibility: "PUBLIC" | "PRIVATE";
  status: string;
  priority: string;
  projectId: string;
  creatorId?: string;
  _isOptimistic?: boolean;
};

function SessionPaneInner() {
  const { sessionId, displayName, accent, projectId, setProjectId } =
    useSessionPane();
  const { connected } = useWebSocket();
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const { data = [], isLoading } = useTaskList(projectId);
  const createTask = useCreateTask(projectId);
  const deleteTask = useDeleteTask(projectId);
  const deferredTasks = useDeferredValue(data as TaskCard[]);

  const roomLabel = useMemo(() => `project:${projectId}`, [projectId]);
  const activeProject =
    PROJECT_OPTIONS.find((project) => project.id === projectId) ??
    PROJECT_OPTIONS[0];
  const visibilityLabel =
    visibility === "PRIVATE" ? "owner only" : "shared room";

  return (
    <section className={`session-panel is-${accent}`}>
      <header className="panel-header session-header">
        <div>
          <p className="panel-eyebrow">Session</p>
          <h2>{displayName}</h2>
          <p className="panel-copy">
            {displayName} can publish into {activeProject.label} and immediately
            show what shared rooms expose versus what PRIVATE tasks keep local.
          </p>
        </div>
        <div className="session-meta-cluster">
          <span className={`session-pill is-${connected ? "live" : "offline"}`}>
            {connected ? "live" : "offline"}
          </span>
          <span className="session-pill">{roomLabel}</span>
          <span className="session-pill">{sessionId}</span>
        </div>
      </header>

      <div className="project-toggle-row">
        <div className="session-block-header">
          <div>
            <p className="panel-label">Project Room</p>
            <strong>{activeProject.label}</strong>
          </div>
          <span className="session-chip">switch shared scope</span>
        </div>
        <div className="project-toggle-grid">
          {PROJECT_OPTIONS.map((project) => (
            <button
              key={project.id}
              type="button"
              className={`project-toggle${projectId === project.id ? " is-active" : ""}`}
              onClick={() => setProjectId(project.id)}
            >
              {project.label}
            </button>
          ))}
        </div>
      </div>

      <form
        className="composer-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) {
            return;
          }

          createTask.mutate({ title: title.trim(), visibility });
          setTitle("");
          setVisibility("PUBLIC");
        }}
      >
        <div className="session-block-header">
          <div>
            <p className="panel-label">Create Task</p>
            <strong>Publish a new mutation</strong>
          </div>
          <span className="session-chip">{visibilityLabel}</span>
        </div>
        <label>
          <span>Task title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={`${displayName} creates a task...`}
          />
        </label>
        <label>
          <span>Visibility</span>
          <select
            value={visibility}
            onChange={(event) =>
              setVisibility(event.target.value as "PUBLIC" | "PRIVATE")
            }
          >
            <option value="PUBLIC">PUBLIC</option>
            <option value="PRIVATE">PRIVATE</option>
          </select>
        </label>
        <button
          type="submit"
          className="submit-button"
          disabled={createTask.isPending}
        >
          {createTask.isPending ? "Creating" : "Create task"}
        </button>
      </form>

      <div className="task-stack">
        <div className="session-block-header">
          <div>
            <p className="panel-label">Visible Tasks</p>
            <strong>
              {isLoading
                ? "Loading room state"
                : `${deferredTasks.length} task${deferredTasks.length === 1 ? "" : "s"} in view`}
            </strong>
          </div>
          <span className="session-chip">{roomLabel}</span>
        </div>
        {isLoading ? <div className="task-empty">Loading tasks…</div> : null}
        {!isLoading && deferredTasks.length === 0 ? (
          <div className="task-empty">No tasks in {roomLabel}.</div>
        ) : null}

        {deferredTasks.map((task) => (
          <article
            key={task.id}
            className={`task-card${task._isOptimistic ? " is-ghost" : ""}`}
          >
            <header>
              <div>
                <strong>{task.title}</strong>
                <span>{task.visibility}</span>
              </div>
              {task.creatorId === sessionId ? (
                <button
                  type="button"
                  onClick={() => deleteTask.mutate(task.id)}
                >
                  Delete
                </button>
              ) : null}
            </header>
            <div className="task-card-meta">
              <span>{task.id}</span>
              <span>{task.status}</span>
              <span>{task.priority}</span>
              {task._isOptimistic ? (
                <span className="task-spinner">syncing</span>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SessionPane({
  sessionId,
  initialProjectId = "alpha",
}: {
  sessionId: keyof typeof SESSION_META;
  initialProjectId?: string;
}) {
  const [projectId, setProjectId] = useState(initialProjectId);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionPaneContextProvider
        value={{
          sessionId,
          displayName: SESSION_META[sessionId].displayName,
          accent: SESSION_META[sessionId].accent,
          projectId,
          setProjectId,
        }}
      >
        <WebSocketProvider sessionId={sessionId} projectId={projectId}>
          <SessionPaneInner />
        </WebSocketProvider>
      </SessionPaneContextProvider>
    </QueryClientProvider>
  );
}
