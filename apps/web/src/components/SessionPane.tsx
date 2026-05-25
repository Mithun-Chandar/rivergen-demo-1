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
import { Badge } from "./ui/Badge";

const SESSION_META = {
  alice: { displayName: "Alice", accent: "alice" as const },
  bob: { displayName: "Bob", accent: "bob" as const },
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

  return (
    <section className={`session-panel is-${accent}`}>
      <header className="panel-header">
        <div className="panel-header-left">
          <p className="panel-eyebrow">Session</p>
          <h2>{displayName}</h2>
        </div>
        <div className="panel-header-right">
          <Badge variant={connected ? "live" : "offline"}>
            {connected ? "live" : "offline"}
          </Badge>
          <Badge variant="default">{roomLabel}</Badge>
        </div>
      </header>

      <div className="session-block">
        <p className="session-block-label">Project Room</p>
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
        className="session-block composer-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          createTask.mutate({ title: title.trim(), visibility });
          setTitle("");
          setVisibility("PUBLIC");
        }}
      >
        <p className="session-block-label">Create Task</p>
        <label>
          <span>Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={`${displayName} creates a task…`}
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
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>
        </label>
        <button
          type="submit"
          className="submit-btn"
          disabled={createTask.isPending}
        >
          {createTask.isPending ? "Creating…" : "Create Task"}
        </button>
      </form>

      <div className="session-block">
        <div className="task-list-header">
          <p className="session-block-label">Visible Tasks</p>
          <Badge variant="default">
            {isLoading ? "…" : deferredTasks.length}
          </Badge>
        </div>
        <div className="task-list">
          {isLoading ? (
            <div className="task-empty">Loading…</div>
          ) : deferredTasks.length === 0 ? (
            <div className="task-empty">No tasks in {roomLabel}</div>
          ) : null}

          {deferredTasks.map((task) => (
            <article
              key={task.id}
              className={`task-card${task._isOptimistic ? " is-ghost" : ""}`}
            >
              <div className="task-card-header">
                <span className="task-title">{task.title}</span>
                {task.creatorId === sessionId ? (
                  <button
                    type="button"
                    className="task-delete-btn"
                    onClick={() => deleteTask.mutate(task.id)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
              <div className="task-meta">
                <Badge
                  variant={task.visibility === "PRIVATE" ? "default" : "ok"}
                >
                  {task.visibility.toLowerCase()}
                </Badge>
                <Badge variant="default">{task.status}</Badge>
                {task._isOptimistic ? (
                  <Badge variant="default">syncing…</Badge>
                ) : null}
              </div>
            </article>
          ))}
        </div>
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
          queries: { staleTime: 5_000 },
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
