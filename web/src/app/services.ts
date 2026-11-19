import { AgentEngine } from "../agent/engine";
import { AgentMemory } from "../agent/memory";
import { KnowledgeBase } from "../rag/knowledgeBase";
import { IndexedDbMemoryStore, saveTrace } from "../storage/db";
import { createDefaultRegistry } from "../tools";

/** Singletons wired together exactly once for the whole app. */
export const knowledgeBase = new KnowledgeBase();
export const memory = new AgentMemory(new IndexedDbMemoryStore());
export const engine = new AgentEngine({
  registry: createDefaultRegistry(),
  memory,
  runtime: {
    searchKnowledge: (q, k) => knowledgeBase.search(q, k),
    knowledgeChunkCount: () => knowledgeBase.chunkCount,
  },
  onTrace: saveTrace,
});

let initPromise: Promise<void> | null = null;
export function initServices(): Promise<void> {
  initPromise ??= Promise.all([knowledgeBase.init(), memory.load()]).then(() => undefined);
  return initPromise;
}

export const SAMPLE_QUESTIONS: { q: string; tag: string }[] = [
  { q: "Which project is most delayed and what is its liquidated damages exposure?", tag: "Multi-step" },
  { q: "Which projects are delayed?", tag: "Projects" },
  { q: "How late is the Cedar Creek bridge and why?", tag: "Tools + RAG" },
  { q: "What does the contract require when a project is more than 14 days behind schedule?", tag: "RAG" },
  { q: "What is the status of the water treatment project?", tag: "Replanning" },
  { q: "What are the cold-weather concreting requirements?", tag: "RAG" },
  { q: "Which projects are in North Carolina?", tag: "Search" },
  { q: "What is the notice deadline for a delay claim?", tag: "RAG" },
];
