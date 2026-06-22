// KerbalMemory.ts — Per-kerbal persistent memory
// Stores conversation summaries and extracted facts for AI prompt injection
// Plain object export (not a class)

import { UserProfile } from './UserProfile';

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

// ── Compaction thresholds ──────────────────────────────────────────────────
// When memory is "about to be full", auto-compact to free up room
const COMPACT_SUMMARIES_THRESHOLD = 8;   // compact at 8/10 summaries
const COMPACT_FACTS_THRESHOLD = 16;      // compact at 16/20 facts
const COMPACT_KEEP_FACT_RATIO = 0.6;     // keep 60% of facts during compaction
const COMPACT_MAX_CHARS = 2048;          // compact if serialized > 2KB

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

  /** Auto-compact if memory is getting full. Returns true if compacted. */
  maybeCompact(memory: AgentMemory): boolean {
    let didCompact = false;

    // ── Compact summaries ────────────────────────────────────────────────
    // When at threshold, merge oldest half into one consolidated entry
    if (memory.summaries.length >= COMPACT_SUMMARIES_THRESHOLD) {
      const splitIdx = Math.floor(memory.summaries.length / 2);
      const oldHalf = memory.summaries.slice(0, splitIdx);
      const newHalf = memory.summaries.slice(splitIdx);
      const consolidated = `[Consolidated] ${oldHalf.join('; ')}`;
      memory.summaries = [consolidated, ...newHalf];
      didCompact = true;
    }

    // ── Compact facts ────────────────────────────────────────────────────
    // When at threshold, keep newest COMPACT_KEEP_FACT_RATIO entries
    const factKeys = Object.keys(memory.facts);
    if (factKeys.length >= COMPACT_FACTS_THRESHOLD) {
      const keepCount = Math.max(3, Math.floor(factKeys.length * COMPACT_KEEP_FACT_RATIO));
      const keepKeys = factKeys.slice(-keepCount); // newest entries (insertion order = newest last)
      const kept: Record<string, string> = {};
      for (const k of keepKeys) {
        kept[k] = memory.facts[k];
      }
      memory.facts = kept;
      didCompact = true;
    }

    // ── Size check ───────────────────────────────────────────────────────
    // If serialized form is still too large, do additional trimming
    if (!didCompact) {
      const size = JSON.stringify(memory).length;
      if (size > COMPACT_MAX_CHARS) {
        // Trim summaries: keep only the last 4 + 1 consolidated for older ones
        if (memory.summaries.length > 5) {
          const splitIdx = memory.summaries.length - 4;
          const oldPart = memory.summaries.slice(0, splitIdx);
          const newPart = memory.summaries.slice(splitIdx);
          memory.summaries = [`[Consolidated] ${oldPart.join('; ')}`, ...newPart];
        }
        // Trim facts: keep only newest 10
        const factKeys2 = Object.keys(memory.facts);
        if (factKeys2.length > 10) {
          const keepKeys2 = factKeys2.slice(-10);
          const kept2: Record<string, string> = {};
          for (const k of keepKeys2) {
            kept2[k] = memory.facts[k];
          }
          memory.facts = kept2;
        }
        didCompact = true;
      }
    }

    // After compaction, re-check serialized size one more time
    if (didCompact) {
      const finalSize = JSON.stringify(memory).length;
      if (finalSize > COMPACT_MAX_CHARS) {
        // Last resort: truncate longest summary and fact strings
        if (memory.summaries.length > 0) {
          const longestIdx = memory.summaries.reduce((maxIdx, s, i, arr) =>
            s.length > arr[maxIdx].length ? i : maxIdx, 0);
          memory.summaries[longestIdx] = memory.summaries[longestIdx].slice(0, 200) + '…';
        }
        const truncKeys = Object.entries(memory.facts);
        for (const [k, v] of truncKeys) {
          if (v.length > 150) {
            memory.facts[k] = v.slice(0, 150) + '…';
          }
        }
      }
    }

    return didCompact;
  },

  /** Append a conversation summary — auto-compacts before saving. */
  addSummary(name: string, summary: string): void {
    const memory = this.load(name);
    memory.summaries.push(summary);
    this.maybeCompact(memory);
    this.save(name, memory);
  },

  /** Store a fact (key-value) — auto-compacts before saving. */
  addFact(name: string, key: string, value: string): void {
    const memory = this.load(name);
    memory.facts[key] = value;
    this.maybeCompact(memory);
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
    const userCtx = UserProfile.buildContext();

    const summaryBlock = memory.summaries.length > 0
      ? `## Previous Conversations\n${memory.summaries.map((s, i) => `- (${i + 1}) ${s}`).join('\n')}`
      : '## Previous Conversations\nNone yet.';

    const factsBlock = Object.keys(memory.facts).length > 0
      ? `## Known Facts about User\n${Object.entries(memory.facts).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
      : '## Known Facts about User\nNothing specific known yet.';

    const parts = [summaryBlock, factsBlock];
    if (userCtx) parts.push(userCtx);

    return {
      summaryBlock,
      factsBlock,
      full: parts.join('\n\n'),
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
