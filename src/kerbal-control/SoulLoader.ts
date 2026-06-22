// SoulLoader.ts — Kerbal personality engine
// Parses .md soul files into structured KerbalSoul objects
// Maps courage/stupidity to LLM API params (temperature/topP)

import { growthSystem, type GrowthData } from './GrowthSystem';

// In Electron EXE, the renderer can't fetch('/kerbal-souls/foo.md') from a
// file:// origin — the path resolves to nothing. The preload bridge exposes
// a readKerbalSoul(name) IPC that reads the bundled .md from the asar instead.
interface ElectronSoulAPI {
  readKerbalSoul: (name: string) => Promise<string | null>;
}

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface KerbalSoul {
  name: string;
  role: string;
  courage: number;      // 0-100
  stupidity: number;    // 0-100
  badS: boolean;        // BadS flag (KSP term — "badass")
  personality: string;
  knowledge: string[];
  speechStyle: string;
  catchphrases: string[];
  rawMarkdown: string;   // Full original .md content for LLM prompt
}

export interface SoulApiParams {
  temperature: number;  // 0.1-1.0 mapped from courage
  topP: number;         // 0.5-1.0 mapped from stupidity
  maxTokens: number;
}

// ── API param mapping ───────────────────────────────────────────────────────

export function statsToApiParams(soul: KerbalSoul): SoulApiParams {
  // Courage → temperature: low courage = low temp (conservative), high courage = high temp (creative)
  const temperature = soul.badS
    ? 0.9
    : 0.1 + (soul.courage / 100) * 0.9;

  // Stupidity → topP: low stupidity = focused, high stupidity = diverse
  const topP = soul.badS
    ? 0.95
    : 0.5 + (soul.stupidity / 100) * 0.5;

  return {
    temperature: parseFloat(temperature.toFixed(3)),
    topP: parseFloat(topP.toFixed(3)),
    maxTokens: 512,
  };
}

// ── Section parsers ─────────────────────────────────────────────────────────

function parseSection(content: string, section: string, defaultValue = ''): string {
  const regex = new RegExp(`${section}\\s*:\\s*(.+?)(?:\\n|$)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : defaultValue;
}

function parseNumericSection(content: string, section: string, defaultValue = 50): number {
  const raw = parseSection(content, section);
  const num = parseInt(raw, 10);
  return isNaN(num) ? defaultValue : Math.max(0, Math.min(100, num));
}

function parseBooleanSection(content: string, section: string, defaultValue = false): boolean {
  const raw = parseSection(content, section).toLowerCase();
  if (raw === 'true' || raw === 'yes' || raw === '1') return true;
  if (raw === 'false' || raw === 'no' || raw === '0') return false;
  return defaultValue;
}

function parseListSection(content: string, section: string): string[] {
  const raw = parseSection(content, section, '');
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── Canonical kerbal names ──────────────────────────────────────────────────

const KERBAL_NAMES = [
  'Gene',
  'Valentina',
  'Bill',
  'Bob',
  'Jebediah',
  'Wernher',
  'Linus',
  'Walt',
  'Mortimer',
] as const;

// ── SoulLoader ──────────────────────────────────────────────────────────────

export class SoulLoader {
  /**
   * Fetch and parse a single kerbal soul from its .md file.
   * Soul files are served from `/kerbal-souls/{name}.md`.
   */
  static async load(name: string): Promise<KerbalSoul> {
    let rawMarkdown: string;
    // Soul filenames on disk are lowercase (gene.md, linus.md, ...) but
    // kerbalStore returns names with capital first letter (Gene, Linus, ...).
    // Normalize so the IPC lookup matches the bundled file.
    const slug = name.toLowerCase();
    const electronSoulApi = (window as unknown as { electronAPI?: ElectronSoulAPI }).electronAPI;
    if (electronSoulApi?.readKerbalSoul) {
      // Packaged Electron EXE — read via IPC bridge
      const content = await electronSoulApi.readKerbalSoul(slug);
      if (content == null) {
        throw new Error(`SoulLoader: failed to load soul for "${name}" via IPC`);
      }
      rawMarkdown = content;
    } else {
      // Vite dev server (or browser) — fetch the relative URL
      const response = await fetch(`/kerbal-souls/${encodeURIComponent(slug)}.md`);
      if (!response.ok) {
        throw new Error(`SoulLoader: failed to load soul for "${name}" (HTTP ${response.status})`);
      }
      rawMarkdown = await response.text();
    }

    const soul: KerbalSoul = {
      name,
      role: parseSection(rawMarkdown, 'Role', 'Kerbal'),
      courage: parseNumericSection(rawMarkdown, 'Courage', 50),
      stupidity: parseNumericSection(rawMarkdown, 'Stupidity', 50),
      badS: parseBooleanSection(rawMarkdown, 'BadS', false),
      personality: parseSection(rawMarkdown, 'Personality', 'Neutral'),
      knowledge: parseListSection(rawMarkdown, 'Knowledge'),
      speechStyle: parseSection(rawMarkdown, 'Speech Style', 'Normal'),
      catchphrases: parseListSection(rawMarkdown, 'Catchphrases'),
      rawMarkdown,
    };

    return soul;
  }

  /**
   * Build a system prompt for a kerbal from their soul data.
   * Returns the full raw markdown for maximum personality fidelity.
   */
  static getSystemPrompt(soul: KerbalSoul): string {
    return soul.rawMarkdown;
  }

  /**
   * Load a soul and merge growth-system adjustments.
   * Growth overrides courage/stupidity with effective values.
   */
  static async loadWithGrowth(name: string): Promise<KerbalSoul> {
    const soul = await SoulLoader.load(name);
    const growth: GrowthData | undefined = growthSystem.get(name);

    if (growth) {
      return {
        ...soul,
        courage: growth.effectiveCourage,
        stupidity: growth.effectiveStupidity,
      };
    }

    return soul;
  }

  /**
   * Return the canonical list of all kerbal names.
   */
  static getAllNames(): string[] {
    return [...KERBAL_NAMES];
  }
}
