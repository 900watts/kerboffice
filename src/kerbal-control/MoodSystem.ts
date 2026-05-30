// MoodSystem.ts — Kerbal emotional state machine
// 7 mood levels with trigger-based transitions and time decay
// Singleton pattern: import { moodSystem } from './MoodSystem'

// ── Types ───────────────────────────────────────────────────────────────────

export type MoodLevel =
  | 'ecstatic'
  | 'excited'
  | 'normal'
  | 'tired'
  | 'annoyed'
  | 'groggy'
  | 'anxious';

export type MoodTrigger =
  | 'time_passing'
  | 'user_interaction'
  | 'kerbal_interaction'
  | 'error_occurred'
  | 'shift_change'
  | 'user_praise'
  | 'user_ignore'
  | 'break_start'
  | 'break_end';

export interface MoodState {
  level: MoodLevel;
  intensity: number;   // 0.0 – 1.0
  updatedAt: number;   // timestamp
}

// ── Transition rules ────────────────────────────────────────────────────────
// Each trigger has candidate next moods. 40% shift chance per tick.

const MOOD_TRANSITIONS: Record<MoodTrigger, { from: MoodLevel[]; to: MoodLevel[] }> = {
  time_passing: {
    from: ['ecstatic', 'excited', 'tired', 'annoyed', 'groggy', 'anxious'],
    to: ['normal'],
  },
  user_interaction: {
    from: ['normal', 'tired', 'annoyed', 'groggy'],
    to: ['normal', 'excited'],
  },
  kerbal_interaction: {
    from: ['normal', 'tired', 'annoyed', 'groggy'],
    to: ['normal', 'excited', 'annoyed'],
  },
  error_occurred: {
    from: ['normal', 'excited'],
    to: ['annoyed', 'anxious'],
  },
  shift_change: {
    from: ['normal', 'tired', 'groggy'],
    to: ['normal', 'groggy', 'tired'],
  },
  user_praise: {
    from: ['normal', 'tired', 'annoyed'],
    to: ['excited', 'ecstatic'],
  },
  user_ignore: {
    from: ['normal', 'excited'],
    to: ['tired', 'annoyed'],
  },
  break_start: {
    from: ['tired', 'annoyed', 'groggy', 'anxious'],
    to: ['normal', 'excited'],
  },
  break_end: {
    from: ['normal', 'excited', 'ecstatic'],
    to: ['normal', 'tired', 'groggy'],
  },
};

// ── MoodSystem class ────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'kerbal-mood:';
const DECAY_INTERVAL_MS = 5 * 60 * 1000;  // 5 min
const SHIFT_CHANCE = 0.4;                   // 40%

class MoodSystem {
  private moods: Map<string, MoodState> = new Map();
  private decayTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startDecayTimer();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Get a kerbal's current mood, loading from localStorage if needed. */
  get(name: string): MoodState {
    let mood = this.moods.get(name);
    if (!mood) {
      mood = this.load(name) ?? this.createDefault(name);
      this.moods.set(name, mood);
    }
    return { ...mood };
  }

  /** Apply a trigger and potentially change the kerbal's mood. */
  tickMood(name: string, trigger: MoodTrigger): MoodState {
    const current = this.get(name);
    const rule = MOOD_TRANSITIONS[trigger];

    if (!rule || !rule.from.includes(current.level)) {
      // Trigger doesn't apply in current state — just decay and save
      this.save(name, current);
      return { ...current };
    }

    // Roll for shift
    if (Math.random() < SHIFT_CHANCE) {
      const nextLevel = rule.to[Math.floor(Math.random() * rule.to.length)];
      const newMood: MoodState = {
        level: nextLevel,
        intensity: nextLevel === 'normal' ? 0.5 : Math.min(1, current.intensity + 0.2),
        updatedAt: Date.now(),
      };
      this.moods.set(name, newMood);
      this.save(name, newMood);
      return { ...newMood };
    }

    // No shift — save and return current
    this.save(name, current);
    return { ...current };
  }

  /** Get a CSS-compatible colour for a mood level. */
  getMoodColor(level: MoodLevel): string {
    const palette: Record<MoodLevel, string> = {
      ecstatic: '#FFD700',
      excited: '#FF8C00',
      normal: '#4CAF50',
      tired: '#9E9E9E',
      annoyed: '#F44336',
      groggy: '#607D8B',
      anxious: '#9C27B0',
    };
    return palette[level] ?? palette.normal;
  }

  /** Get a mood emoji. */
  getMoodEmoji(level: MoodLevel): string {
    const map: Record<MoodLevel, string> = {
      ecstatic: '🌟',
      excited: '🔥',
      normal: '😊',
      tired: '😴',
      annoyed: '😤',
      groggy: '🥴',
      anxious: '😰',
    };
    return map[level] ?? '😊';
  }

  /** Get a short label for the mood. */
  getMoodLabel(level: MoodLevel): string {
    const map: Record<MoodLevel, string> = {
      ecstatic: 'Over the Mun!',
      excited: 'Ready to Launch',
      normal: 'Steady as She Goes',
      tired: 'Need Some Rest',
      annoyed: 'Kraken Take It!',
      groggy: 'Just Woke Up',
      anxious: 'Nervous Wobbles',
    };
    return map[level] ?? 'Steady as She Goes';
  }

  /** Format mood context for AI prompt injection. */
  buildMoodContext(name: string): string {
    const mood = this.get(name);
    return [
      `[Current Mood: ${mood.level}]`,
      `[Intensity: ${(mood.intensity * 100).toFixed(0)}%]`,
      `[Label: ${this.getMoodLabel(mood.level)}]`,
    ].join('\n');
  }

  /** Alias for buildMoodContext — used by ChatBar and SmartphoneModal. */
  buildMoodPrompt(name: string): string {
    return this.buildMoodContext(name);
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  private storageKey(name: string): string {
    return `${STORAGE_PREFIX}${name}`;
  }

  private load(name: string): MoodState | null {
    try {
      const raw = localStorage.getItem(this.storageKey(name));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as MoodState;
      // Basic validation
      if (!parsed.level || typeof parsed.intensity !== 'number') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private save(name: string, mood: MoodState): void {
    try {
      localStorage.setItem(this.storageKey(name), JSON.stringify(mood));
    } catch {
      // localStorage full — silently fail
    }
  }

  private createDefault(name: string): MoodState {
    return {
      level: 'normal',
      intensity: 0.5,
      updatedAt: Date.now(),
    };
  }

  // ── Decay ───────────────────────────────────────────────────────────────

  /** Decay mood toward normal over time. */
  private decayMood(name: string): void {
    const mood = this.get(name);
    const elapsed = Date.now() - mood.updatedAt;

    // Only decay non-normal moods that have been around a while
    if (mood.level === 'normal') return;
    if (elapsed < DECAY_INTERVAL_MS) return;

    const newIntensity = Math.max(0, mood.intensity - 0.15);

    if (newIntensity < 0.3 && elapsed > DECAY_INTERVAL_MS * 2) {
      // Reset to normal
      const reset: MoodState = {
        level: 'normal',
        intensity: 0.5,
        updatedAt: Date.now(),
      };
      this.moods.set(name, reset);
      this.save(name, reset);
    } else {
      const decayed: MoodState = {
        ...mood,
        intensity: newIntensity,
        updatedAt: Date.now(),
      };
      this.moods.set(name, decayed);
      this.save(name, decayed);
    }
  }

  private startDecayTimer(): void {
    if (this.decayTimer) return;
    this.decayTimer = setInterval(() => {
      for (const name of this.moods.keys()) {
        this.decayMood(name);
      }
    }, DECAY_INTERVAL_MS);
  }
}

// ── Singleton export ────────────────────────────────────────────────────────

export const moodSystem = new MoodSystem();
