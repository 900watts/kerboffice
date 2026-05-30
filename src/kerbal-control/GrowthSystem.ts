// GrowthSystem.ts — Kerbal personality evolution
// Tracks courage/stupidity adjustments over time as kerbals interact
// Auto-reflects every 5 conversations; data persisted to localStorage

// ── Types ───────────────────────────────────────────────────────────────────

export type GrowthTrigger =
  | 'successful_chat'
  | 'error_response'
  | 'user_praise'
  | 'user_frustration'
  | 'learned_something'
  | 'idle_banter'
  | 'risky_choice';

export interface GrowthData {
  courage: number;          // cumulative courage delta from base
  stupidity: number;        // cumulative stupidity delta from base
  effectiveCourage: number; // base + courage (clamped 0-100)
  effectiveStupidity: number; // base + stupidity (clamped 0-100)
  baseCourage: number;
  baseStupidity: number;
  totalConversations: number;
  lastReflect: number;       // timestamp
}

const STORAGE_PREFIX = 'kerbal-growth:';
const REFLECT_THRESHOLD = 5;  // auto-reflect every N conversations
const MAX_DELTA = 20;         // max adjustment from base (either direction)

// ── Trigger adjustments ─────────────────────────────────────────────────────

const COURAGE_ADJUST: Record<GrowthTrigger, number> = {
  successful_chat: 0.5,
  error_response: -1.0,
  user_praise: 1.5,
  user_frustration: -2.0,
  learned_something: 1.0,
  idle_banter: 0.2,
  risky_choice: 2.0,
};

const STUPIDITY_ADJUST: Record<GrowthTrigger, number> = {
  successful_chat: -0.3,
  error_response: 1.5,
  user_praise: -0.5,
  user_frustration: 1.0,
  learned_something: -1.5,
  idle_banter: 0.5,
  risky_choice: 2.0,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── GrowthSystem object ─────────────────────────────────────────────────────

export const growthSystem = {
  // ── Read ────────────────────────────────────────────────────────────────

  /** Load a kerbal's growth data. */
  get(name: string): GrowthData | undefined {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${name}`);
      if (!raw) return undefined;
      return JSON.parse(raw) as GrowthData;
    } catch {
      return undefined;
    }
  },

  /** Initialize growth data for a kerbal with given base stats. */
  init(name: string, baseCourage: number, baseStupidity: number): GrowthData {
    const data: GrowthData = {
      courage: 0,
      stupidity: 0,
      effectiveCourage: baseCourage,
      effectiveStupidity: baseStupidity,
      baseCourage,
      baseStupidity,
      totalConversations: 0,
      lastReflect: Date.now(),
    };
    this.save(name, data);
    return data;
  },

  // ── Write ───────────────────────────────────────────────────────────────

  /** Persist growth data. */
  save(name: string, data: GrowthData): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${name}`, JSON.stringify(data));
    } catch {
      // localStorage full — silent
    }
  },

  /** Apply a growth trigger, adjusting courage/stupidity. */
  tick(name: string, trigger: GrowthTrigger): GrowthData {
    let data = this.get(name);
    if (!data) {
      // Can't grow without initialisation — return a stub
      return {
        courage: 0,
        stupidity: 0,
        effectiveCourage: 50,
        effectiveStupidity: 50,
        baseCourage: 50,
        baseStupidity: 50,
        totalConversations: 0,
        lastReflect: Date.now(),
      };
    }

    data.courage += COURAGE_ADJUST[trigger];
    data.stupidity += STUPIDITY_ADJUST[trigger];
    data.totalConversations += 1;

    // Apply delta cap
    data.courage = clamp(data.courage, -MAX_DELTA, MAX_DELTA);
    data.stupidity = clamp(data.stupidity, -MAX_DELTA, MAX_DELTA);

    // Recalculate effective stats
    data.effectiveCourage = clamp(data.baseCourage + data.courage, 0, 100);
    data.effectiveStupidity = clamp(data.baseStupidity + data.stupidity, 0, 100);

    this.save(name, data);

    // Auto-reflect if threshold reached
    if (data.totalConversations % REFLECT_THRESHOLD === 0) {
      this.reflect(name);
    }

    return { ...data };
  },

  /** Reflect on growth — log current stats and update lastReflect. */
  reflect(name: string): void {
    const data = this.get(name);
    if (!data) return;

    console.log(
      `[GrowthSystem] ${name} reflecting: courage=${data.effectiveCourage} (` +
      `${data.courage > 0 ? '+' : ''}${data.courage} from base), ` +
      `stupidity=${data.effectiveStupidity} (` +
      `${data.stupidity > 0 ? '+' : ''}${data.stupidity} from base)`
    );

    data.lastReflect = Date.now();
    this.save(name, data);
  },

  /** Get effective stats with growth applied. */
  getEffectiveStats(name: string): { courage: number; stupidity: number } | null {
    const data = this.get(name);
    if (!data) return null;
    return {
      courage: data.effectiveCourage,
      stupidity: data.effectiveStupidity,
    };
  },

  // ── Context ─────────────────────────────────────────────────────────────

  /** Build growth context for AI prompt injection. */
  buildGrowthContext(name: string): string {
    const data = this.get(name);
    if (!data) {
      return `${name} has no growth data yet.`;
    }

    const lines: string[] = [
      `## Growth & Evolution for ${name}`,
      `- Total Conversations: ${data.totalConversations}`,
      `- Base Courage: ${data.baseCourage} → Effective: ${data.effectiveCourage} (${data.courage > 0 ? '+' : ''}${data.courage})`,
      `- Base Stupidity: ${data.baseStupidity} → Effective: ${data.effectiveStupidity} (${data.stupidity > 0 ? '+' : ''}${data.stupidity})`,
      `- Last Reflection: ${new Date(data.lastReflect).toLocaleString()}`,
    ];

    return lines.join('\n');
  },

  // ── Reset ───────────────────────────────────────────────────────────────

  /** Clear all growth data for a kerbal. */
  clear(name: string): void {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${name}`);
    } catch {
      // silent
    }
  },
};
