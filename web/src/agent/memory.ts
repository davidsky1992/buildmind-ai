import type { AgentAnswer } from "./composer";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  traceId?: string;
  answer?: AgentAnswer;
}

/** Working memory carried between turns (used to resolve "it", "that project", …). */
export interface MemoryState {
  lastProjectIds: string[];
  lastIntents: string[];
  lastQuery: string | null;
  lastDocNames: string[];
  turns: number;
}

export const EMPTY_MEMORY: MemoryState = { lastProjectIds: [], lastIntents: [], lastQuery: null, lastDocNames: [], turns: 0 };

/** Storage backend so the engine can be tested without IndexedDB. */
export interface MemoryStore {
  loadState(): Promise<MemoryState | undefined>;
  saveState(state: MemoryState): Promise<void>;
  appendMessage(message: ConversationMessage): Promise<void>;
  loadMessages(): Promise<ConversationMessage[]>;
  clear(): Promise<void>;
}

export class InMemoryStore implements MemoryStore {
  private state?: MemoryState;
  private messages: ConversationMessage[] = [];
  async loadState() {
    return this.state;
  }
  async saveState(s: MemoryState) {
    this.state = structuredClone(s);
  }
  async appendMessage(m: ConversationMessage) {
    this.messages.push(m);
  }
  async loadMessages() {
    return [...this.messages];
  }
  async clear() {
    this.state = undefined;
    this.messages = [];
  }
}

/** Agent memory: persisted conversation history + short-term working memory. */
export class AgentMemory {
  private state: MemoryState = structuredClone(EMPTY_MEMORY);

  constructor(private readonly store: MemoryStore) {}

  async load(): Promise<void> {
    this.state = { ...structuredClone(EMPTY_MEMORY), ...((await this.store.loadState()) ?? {}) };
  }

  get snapshot(): Readonly<MemoryState> {
    return this.state;
  }

  async remember(update: Partial<MemoryState>): Promise<void> {
    this.state = { ...this.state, ...update, turns: this.state.turns + 1 };
    await this.store.saveState(this.state);
  }

  appendMessage(m: ConversationMessage): Promise<void> {
    return this.store.appendMessage(m);
  }

  history(): Promise<ConversationMessage[]> {
    return this.store.loadMessages();
  }

  async clear(): Promise<void> {
    this.state = structuredClone(EMPTY_MEMORY);
    await this.store.clear();
  }
}
