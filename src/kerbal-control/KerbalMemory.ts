// KerbalMemory.ts — Per-kerbal persistent memory
// Stores conversation summaries and extracted facts for AI prompt injection
// Plain object export (not a class)

// ── Types ───────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  type: 'summary' | 'fact';
  content: string;
  timestamp: number;
}

export interface AgentMemory {
  summaries: string[];      // last N conversation summaries
  facts: Record<string, string>;  // key-value facts (learned traits)
}

export interface BuiltMemoryContext {
  summaryBlock: string;
  factsBlock: string;
  full: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'kerbal-memory:';
const MAX_SUMMARIES = 10;
const MAX_FACTS = 20;

// ── Fact extraction patterns ────────────────────────────────────────────────

const FACT_PATTERNS: Record<string, RegExp> = {
  userName: /(?:my name is|call me|I'm|I am)\s+(\w+)/i,
  likes: /(?:I like|I love|I enjoy|I'm into)\s+(\w+(?:\s+\w+){0,4})/i,
  dislikes: /(?:I don't like|I hate|I dislike|I'm not into)\s+(\w+(?:\s+\w+){0,4})/i,
  kspVersion: /(?:KSP|Kerbal|version)\s*(?:v)?(\d+\.\d+(?:\.\d+)?)/i,
  modCount: /(?:mods?|mods installed)\s*(?::|is|are|have)?\s*(\d+)/i,
  skillLevel: /(?:skill|level|experience|beginner|intermediate|expert|pro)/i,
  currentActivity: /(?:working on|building|designing|testing|flying|launching)\s+(\w+(?:\s+\w+){0,4})/i,
  problems: /(?:issue|problem|bug|stuck|can't|cannot|broken|not working)\s*:?\s*(.+?)(?:\.|!|\n|$)/i,
};

// ── Memory object ───────────────────────────────────────────────────────────

export const KerbalMemory = {
  // ── Read ────────────────────────────────────────────────────────────────

  /** Load a kerbal's persisted memory. */
  load(name: string): AgentMemory {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${name}`);
      if (!raw) return { summaries: [], facts: {} };
      const parsed = JSON.parse(raw);
      return {
        summaries: Array.isArray(parsed.summaries) ? parsed.summaries : [],
        facts: parsed.facts && typeof parsed.facts === 'object' ? parsed.facts : {},
      };
    } catch {
      return { summaries: [], facts: {} };
    }
  },

  /** Get a specific fact value. */
  getFact(name: string, key: string): string | undefined {
    const memory = this.load(name);
    return memory.facts[key];
  },

  /** Get all summaries for a kerbal. */
  getSummaries(name: string): string[] {
    return this.load(name).summaries;
  },

  // ── Write ───────────────────────────────────────────────────────────────

  /** Save a kerbal's full memory. */
  save(name: string, memory: AgentMemory): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${name}`, JSON.stringify(memory));
    } catch {
      // localStorage full — silently fail
    }
  },

  /** Append a conversation summary (capped at MAX_SUMMARIES). */
  addSummary(name: string, summary: string): void {
    const memory = this.load(name);
    memory.summaries.push(summary);
    if (memory.summaries.length > MAX_SUMMARIES) {
      memory.summaries = memory.summaries.slice(-MAX_SUMMARIES);
    }
    this.save(name, memory);
  },

  /** Store a fact (key-value, capped at MAX_FACTS). */
  addFact(name: string, key: string, value: string): void {
    const memory = this.load(name);
    memory.facts[key] = value;
    // Evict oldest key if over limit
    const keys = Object.keys(memory.facts);
    if (keys.length > MAX_FACTS) {
      const oldestKey = keys[0];
      delete memory.facts[oldestKey];
    }
    this.save(name, memory);
  },

  // ── Extraction ──────────────────────────────────────────────────────────

  /** Extract facts from a user message and store them. */
  extractAndStore(name: string, message: string): void {
    for (const [key, pattern] of Object.entries(FACT_PATTERNS)) {
      const match = message.match(pattern);
      if (match) {
        this.addFact(name, key, match[1].trim());
      }
    }
  },

  // ── Context building ────────────────────────────────────────────────────

  /** Build a full markdown memory context for AI prompt injection. */
  buildMemoryContext(name: string): BuiltMemoryContext {
    const memory = this.load(name);

    const summaryBlock = memory.summaries.length > 0
      ? `## Previous Conversations\n${memory.summaries.map((s, i) => `- (${i + 1}) ${s}`).join('\n')}`
      : '## Previous Conversations\nNone yet.';

    const factsBlock = Object.keys(memory.facts).length > 0
      ? `## Known Facts about User\n${Object.entries(memory.facts).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
      : '## Known Facts about User\nNothing specific known yet.';

    return {
      summaryBlock,
      factsBlock,
      full: `${summaryBlock}\n\n${factsBlock}`,
    };
  },

  /** Clear all memory for a kerbal. */
  clear(name: string): void {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${name}`);
    } catch {
      // silent
    }
  },
};
