import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { useSessionPane } from "../lib/session-context";
import { taskKeys } from "../lib/query-keys";

// ── useJoinTaskRoom ────────────────────────────────────────────────────────────
// LAW: the server broadcasts task events to a scoped socket.io room.
// The client MUST join that room or it will never receive those events.
// Call this hook on the page/component that owns the task context.
//
// Pattern:
//   const { socket, connected } = useWebSocket();
//   useEffect(() => {
//     if (connected && socket) socket.emit("join:task", projectId);
//   }, [connected, socket, projectId]);
//
// TODO: replace the useEffect above with the correct room variable from your route.
// The room template for this domain is: project:${projectId}

// TODO: import your real Task types once defined
// import type { Task, TaskInput } from "your-types-package";
type TaskVisibility = "PUBLIC" | "PRIVATE";

type Task = {
  id: string;
  taskId?: string;
  title: string;
  projectId: string;
  creatorId?: string;
  visibility: TaskVisibility;
  status: string;
  priority: string;
  assigneeId?: string | null;
  clientTempId?: string | null;
  createdAt?: string;
  _isOptimistic?: boolean;
};

type TaskInput = {
  title: string;
  visibility?: TaskVisibility;
  clientTempId?: string;
};

// ── useTaskList ────────────────────────────────────────────────────────────────
export function useTaskList(
  projectId: string,
  options?: Partial<UseQueryOptions<Task[]>>,
) {
  const { sessionId } = useSessionPane();

  return useQuery<Task[]>({
    queryKey: taskKeys.list({ projectId }),
    queryFn: async () => {
      const query = new URLSearchParams({ projectId });
      const res = await fetch(`/api/tasks?${query.toString()}`, {
        headers: { "x-session-id": sessionId },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<Task[]>;
    },
    ...options,
  });
}

// ── useTask ────────────────────────────────────────────────────────────────────
export function useTask(id: string, options?: Partial<UseQueryOptions<Task>>) {
  const { sessionId } = useSessionPane();

  return useQuery<Task>({
    queryKey: taskKeys.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${id}`, {
        headers: { "x-session-id": sessionId },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<Task>;
    },
    enabled: !!id,
    ...options,
  });
}

// ── useCreateTask ──────────────────────────────────────────────────────────────
export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();
  const { sessionId } = useSessionPane();
  return useMutation({
    mutationFn: async (data: TaskInput) => {
      // LAW: onMutate stamps data.clientTempId before this runs — send data as-is
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({ ...data, projectId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<Task>;
    },
    onMutate: async (data) => {
      // LAW: stamp clientTempId onto data — mutationFn sends data as-is, so the
      // server receives the same ID the ghost uses. Never generate it independently
      // in mutationFn — that produces a divergent ID and the ghost never reconciles.
      if (!data.clientTempId) data.clientTempId = `temp-task-${Date.now()}`;
      const clientTempId = data.clientTempId;
      // Room scope: project:${projectId}
      const listKey = taskKeys.list({ projectId });
      await queryClient.cancelQueries({ queryKey: listKey });
      const prev = queryClient.getQueryData<Task[]>(listKey);
      // Array.isArray guard required — a plain object under a cold cache passes
      // a bare if(prev) truthy check and causes [...prev, ghost] to throw TypeError
      const ghost: Task = {
        id: clientTempId,
        title: data.title,
        projectId,
        visibility: data.visibility ?? "PUBLIC",
        status: "todo",
        priority: "medium",
        clientTempId,
        _isOptimistic: true,
      };
      queryClient.setQueryData<Task[]>(listKey, [
        ...(Array.isArray(prev) ? prev : []),
        ghost,
      ]);
      return { prev, listKey, clientTempId };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev !== undefined) {
        queryClient.setQueryData(context.listKey, context.prev);
      }
    },
    // onSuccess: intentionally omitted — WS projection handles ID reconciliation
  });
}

// ── useUpdateTask ──────────────────────────────────────────────────────────────
export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();
  const { sessionId } = useSessionPane();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<
        Omit<
          Task,
          "id" | "taskId" | "projectId" | "createdAt" | "_isOptimistic"
        >
      >;
    }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<Task>;
    },
    onMutate: async ({ id, data }) => {
      // Room scope: project:${projectId}
      const listKey = taskKeys.list({ projectId });
      await queryClient.cancelQueries({ queryKey: listKey });
      const prev = queryClient.getQueryData<Task[]>(listKey);
      if (Array.isArray(prev)) {
        queryClient.setQueryData<Task[]>(
          listKey,
          prev.map((item) => (item.id === id ? { ...item, ...data } : item)),
        );
      }
      return { prev, listKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev !== undefined) {
        queryClient.setQueryData(context.listKey, context.prev);
      }
    },
    // onSuccess: intentionally omitted — WS projection handles cache convergence
  });
}

// ── useDeleteTask ──────────────────────────────────────────────────────────────
export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();
  const { sessionId } = useSessionPane();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "DELETE",
        headers: { "x-session-id": sessionId },
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onMutate: async (id) => {
      // Room scope: project:${projectId}
      const listKey = taskKeys.list({ projectId });
      await queryClient.cancelQueries({ queryKey: listKey });
      const prev = queryClient.getQueryData<Task[]>(listKey);
      if (Array.isArray(prev)) {
        queryClient.setQueryData<Task[]>(
          listKey,
          prev.filter((item) => item.id !== id),
        );
      }
      return { prev, listKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev !== undefined) {
        queryClient.setQueryData(context.listKey, context.prev);
      }
    },
    // onSuccess: intentionally omitted — WS projection handles cache convergence
  });
}
