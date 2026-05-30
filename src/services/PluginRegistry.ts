/**
 * PluginRegistry — localStorage-backed custom API provider plugin system.
 *
 * Users can register any OpenAI-compatible API endpoint as a plugin provider.
 * Plugin providers appear alongside the built-in ones in the phone app.
 *
 * Storage: localStorage with `ksc_ai_plugin_` prefix.
 * Structure: each plugin is a `PluginProviderEntry` keyed by a unique ID.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PluginModelEntry {
  id: string;
  label: string;
}

export interface PluginProviderEntry {
  /** Unique auto-generated ID (e.g. "plug_xxxxxxxx") */
  id: string;
  /** Human-readable name shown in the provider selector */
  name: string;
  /** API base URL (e.g. "https://api.example.com/v1") */
  baseUrl: string;
  /** API key */
  apiKey: string;
  /** Pre-configured model list */
  models: PluginModelEntry[];
  /** Allow typing a custom model name */
  allowCustomModel: boolean;
  /** Timestamp of creation */
  createdAt: number;
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = 'ksc_ai_plugin_';
const INDEX_KEY = `${STORAGE_PREFIX}_index`;

function getIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveIndex(ids: string[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}

function pluginStorageKey(id: string): string {
  return `${STORAGE_PREFIX}${id}`;
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateId(): string {
  return 'plug_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/** Get all registered plugin providers. */
export function getAllPlugins(): PluginProviderEntry[] {
  const ids = getIndex();
  const plugins: PluginProviderEntry[] = [];
  for (const id of ids) {
    try {
      const raw = localStorage.getItem(pluginStorageKey(id));
      if (raw) {
        const entry = JSON.parse(raw) as PluginProviderEntry;
        plugins.push(entry);
      }
    } catch {}
  }
  return plugins;
}

/** Get a single plugin by ID. */
export function getPlugin(id: string): PluginProviderEntry | null {
  try {
    const raw = localStorage.getItem(pluginStorageKey(id));
    if (raw) return JSON.parse(raw) as PluginProviderEntry;
  } catch {}
  return null;
}

/** Create a new plugin provider. Returns the new entry's ID. */
export function createPlugin(data: Omit<PluginProviderEntry, 'id' | 'createdAt'>): string {
  const id = generateId();
  const entry: PluginProviderEntry = {
    ...data,
    id,
    createdAt: Date.now(),
  };
  localStorage.setItem(pluginStorageKey(id), JSON.stringify(entry));

  const index = getIndex();
  index.push(id);
  saveIndex(index);

  return id;
}

/** Update an existing plugin provider by ID. Returns true on success. */
export function updatePlugin(id: string, data: Partial<Omit<PluginProviderEntry, 'id' | 'createdAt'>>): boolean {
  const existing = getPlugin(id);
  if (!existing) return false;

  const updated: PluginProviderEntry = {
    ...existing,
    ...data,
    id, // never change ID
    createdAt: existing.createdAt, // never change creation timestamp
  };
  localStorage.setItem(pluginStorageKey(id), JSON.stringify(updated));
  return true;
}

/** Delete a plugin provider by ID. Returns true on success. */
export function deletePlugin(id: string): boolean {
  const index = getIndex();
  const idx = index.indexOf(id);
  if (idx === -1) return false;

  index.splice(idx, 1);
  saveIndex(index);
  localStorage.removeItem(pluginStorageKey(id));
  return true;
}

/** Check if a plugin ID exists. */
export function hasPlugin(id: string): boolean {
  return getPlugin(id) !== null;
}

/** Convert a plugin entry to a ProviderConfig-compatible shape (used by ai.ts). */
export function pluginToProviderConfig(plugin: PluginProviderEntry): {
  label: string;
  baseUrl: string;
  models: PluginModelEntry[];
  openaiCompat: boolean;
  allowCustomModel: boolean;
} {
  return {
    label: plugin.name,
    baseUrl: plugin.baseUrl,
    models: plugin.models,
    openaiCompat: true, // all plugins must be OpenAI-compatible
    allowCustomModel: plugin.allowCustomModel,
  };
}
