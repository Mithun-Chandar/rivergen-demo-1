import {
  createContext,
  useContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

interface SessionPaneContextValue {
  sessionId: string;
  displayName: string;
  accent: "alice" | "bob";
  projectId: string;
  setProjectId: Dispatch<SetStateAction<string>>;
}

const SessionPaneContext = createContext<SessionPaneContextValue | null>(null);

export function SessionPaneContextProvider({
  value,
  children,
}: {
  value: SessionPaneContextValue;
  children: ReactNode;
}) {
  return (
    <SessionPaneContext.Provider value={value}>
      {children}
    </SessionPaneContext.Provider>
  );
}

export function useSessionPane(): SessionPaneContextValue {
  const context = useContext(SessionPaneContext);
  if (!context) {
    throw new Error(
      "useSessionPane must be used inside SessionPaneContextProvider",
    );
  }
  return context;
}
