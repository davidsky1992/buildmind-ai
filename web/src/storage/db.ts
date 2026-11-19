import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { DocumentChunk, KnowledgeDocument } from "../rag/types";
import type { ConversationMessage, MemoryState, MemoryStore } from "../agent/memory";
import type { TraceRecord } from "../agent/trace";

interface BuildMindDB extends DBSchema {
  documents: { key: string; value: KnowledgeDocument };
  chunks: { key: string; value: DocumentChunk; indexes: { byDoc: string } };
  messages: { key: string; value: ConversationMessage; indexes: { byTime: string } };
  traces: { key: string; value: TraceRecord; indexes: { byTime: string } };
  kv: { key: string; value: unknown };
}

export const DB_NAME = "buildmind-ai";
let dbPromise: Promise<IDBPDatabase<BuildMindDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<BuildMindDB>> {
  dbPromise ??= openDB<BuildMindDB>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore("documents", { keyPath: "id" });
      db.createObjectStore("chunks", { keyPath: "id" }).createIndex("byDoc", "docId");
      db.createObjectStore("messages", { keyPath: "id" }).createIndex("byTime", "createdAt");
      db.createObjectStore("traces", { keyPath: "id" }).createIndex("byTime", "startedAt");
      db.createObjectStore("kv");
    },
  });
  return dbPromise;
}

/** Test helper: forget the cached connection. */
export function resetDbConnection(): void {
  dbPromise = null;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await (await getDb()).get("kv", key)) as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await getDb()).put("kv", value, key);
}

// ------------------------------------------------------------- memory store

export class IndexedDbMemoryStore implements MemoryStore {
  async loadState() {
    return kvGet<MemoryState>("agent-memory");
  }
  async saveState(state: MemoryState) {
    await kvSet("agent-memory", state);
  }
  async appendMessage(m: ConversationMessage) {
    await (await getDb()).put("messages", m);
  }
  async loadMessages() {
    return (await getDb()).getAllFromIndex("messages", "byTime");
  }
  async clear() {
    const db = await getDb();
    await db.clear("messages");
    await db.delete("kv", "agent-memory");
  }
}

// ------------------------------------------------------------- traces

const MAX_TRACES = 50;

export async function saveTrace(t: TraceRecord): Promise<void> {
  const db = await getDb();
  await db.put("traces", structuredClone(t));
  const keys = await db.getAllKeysFromIndex("traces", "byTime");
  if (keys.length > MAX_TRACES) {
    const tx = db.transaction("traces", "readwrite");
    await Promise.all(keys.slice(0, keys.length - MAX_TRACES).map((k) => tx.store.delete(k)));
    await tx.done;
  }
}

export async function listTraces(): Promise<TraceRecord[]> {
  return (await (await getDb()).getAllFromIndex("traces", "byTime")).reverse();
}

export async function clearTraces(): Promise<void> {
  await (await getDb()).clear("traces");
}
