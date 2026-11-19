import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ConversationMessage } from "../agent/memory";
import type { TraceRecord } from "../agent/trace";
import { clearTraces, listTraces } from "../storage/db";
import { engine, initServices, knowledgeBase, memory } from "./services";

interface AppState {
  ready: boolean;
  error: string | null;
  messages: ConversationMessage[];
  traces: TraceRecord[];
  running: boolean;
  kbVersion: number;
  ask(question: string): Promise<TraceRecord | null>;
  clearConversation(): Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [running, setRunning] = useState(false);
  const [kbVersion, setKbVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    initServices()
      .then(async () => {
        const [m, t] = await Promise.all([memory.history(), listTraces()]);
        if (!alive) return;
        setMessages(m);
        setTraces(t);
        setReady(true);
      })
      .catch((e: Error) => alive && setError(`Could not open browser storage (IndexedDB): ${e.message}`));
    const unsub = knowledgeBase.subscribe(() => setKbVersion((v) => v + 1));
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || running) return null;
      setRunning(true);
      const optimistic: ConversationMessage = { id: `pending-${Date.now()}`, role: "user", text: q, createdAt: new Date().toISOString() };
      setMessages((m) => [...m, optimistic]);
      try {
        const record = await engine.run(q);
        const [m, t] = await Promise.all([memory.history(), listTraces()]);
        setMessages(m);
        setTraces(t);
        return record;
      } finally {
        setRunning(false);
      }
    },
    [running],
  );

  const clearConversation = useCallback(async () => {
    await memory.clear();
    await clearTraces();
    setMessages([]);
    setTraces([]);
  }, []);

  const value = useMemo(
    () => ({ ready, error, messages, traces, running, kbVersion, ask, clearConversation }),
    [ready, error, messages, traces, running, kbVersion, ask, clearConversation],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState must be used inside AppStateProvider");
  return v;
}
