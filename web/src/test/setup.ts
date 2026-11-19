import "fake-indexeddb/auto";
import { AgentEngine } from "../agent/engine";
import { AgentMemory, InMemoryStore } from "../agent/memory";
import { KnowledgeBase } from "../rag/knowledgeBase";
import { createDefaultRegistry } from "../tools";

/** Builds a fully wired engine backed by fake IndexedDB, as the browser app does. */
export async function createTestEngine(kb?: KnowledgeBase) {
  const knowledge = kb ?? new KnowledgeBase();
  await knowledge.init();
  const memory = new AgentMemory(new InMemoryStore());
  await memory.load();
  const engine = new AgentEngine({
    registry: createDefaultRegistry(),
    memory,
    runtime: {
      searchKnowledge: (q, k) => knowledge.search(q, k),
      knowledgeChunkCount: () => knowledge.chunkCount,
    },
  });
  return { engine, memory, kb: knowledge };
}
