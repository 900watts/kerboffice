/**
 * AI service for KerbOffice.
 * Multi-provider AI chat system supporting OpenRouter, Google AI, OpenAI,
 * SiliconFlow (CN/INT), Ollama, and user-registered plugin providers.
 * All API keys stored in localStorage. No server-side dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatResult {
  reply: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  tier?: string;
}

export interface CustomChatOptions {
  signal?: AbortSignal;
  temperature?: number;
  topP?: number;
  /** If true, skips prepending the default system prompt (kerbals provide their own). */
  noSystemPrompt?: boolean;
}

/** Sentinel returned when all AI retries produce empty responses. */
export const EMPTY_RESPONSE = '(no response)';

/**
 * Provider identifier — either a built-in name or a plugin ID (prefixed "plug_").
 * Changed from literal union to `string` to support dynamic plugin registration.
 */
export type CustomProvider = string;

export interface ProviderConfig {
  label: string;
  baseUrl: string;
  models: { id: string; label: string }[];
  /** true = OpenAI-compatible chat/completions, false = Google format */
  openaiCompat: boolean;
  /** true = user can type any model name (e.g. OpenRouter has thousands of models) */
  allowCustomModel: boolean;
}

// ---------------------------------------------------------------------------
// Provider definitions
// ---------------------------------------------------------------------------

export const AI_PROVIDERS: Record<CustomProvider, ProviderConfig> = {
  'openrouter': {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    openaiCompat: true,
    allowCustomModel: true,
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (Free)' },
      { id: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder (Free)' },
      { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B (Free)' },
    ],
  },
  'google': {
    label: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    openaiCompat: false,
    allowCustomModel: true,
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
    ],
  },
  'openai': {
    label: 'OpenAI / ChatGPT',
    baseUrl: 'https://api.openai.com/v1',
    openaiCompat: true,
    allowCustomModel: true,
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'o3-mini', label: 'o3-mini' },
    ],
  },
  'siliconflow-cn': {
    label: 'Silicon Flow (CN)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    openaiCompat: true,
    allowCustomModel: true,
    models: [
      { id: 'Qwen/Qwen3-8B', label: 'Qwen3 8B' },
      { id: 'deepseek-ai/DeepSeek-V3.2', label: 'DeepSeek V3.2' },
      { id: 'zai-org/GLM-4.6', label: 'GLM 4.6' },
    ],
  },
  'siliconflow-int': {
    label: 'Silicon Flow (INT)',
    baseUrl: 'https://api.siliconflow.com/v1',
    openaiCompat: true,
    allowCustomModel: true,
    models: [
      { id: 'Qwen/Qwen3-8B', label: 'Qwen3 8B' },
      { id: 'deepseek-ai/DeepSeek-V3.2', label: 'DeepSeek V3.2' },
      { id: 'zai-org/GLM-4.6', label: 'GLM 4.6' },
    ],
  },
  'ollama': {
    label: 'Ollama (Local)',
    baseUrl: 'http://127.0.0.1:11434/v1',
    openaiCompat: true,
    allowCustomModel: true,
    models: [
      { id: 'llama3.2:latest', label: 'Llama 3.2' },
      { id: 'qwen3:latest', label: 'Qwen3' },
      { id: 'deepseek-coder-v2:latest', label: 'DeepSeek Coder V2' },
      { id: 'mistral:latest', label: 'Mistral' },
      { id: 'codellama:latest', label: 'Code Llama' },
      { id: 'gemma3:latest', label: 'Gemma 3' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Plugin provider resolution
// ---------------------------------------------------------------------------

/** Check if a provider ID refers to a user-registered plugin. */
function isPluginProvider(provider: string): boolean {
  return provider.startsWith('plug_');
}

/**
 * Resolve provider config from built-in AI_PROVIDERS or from PluginRegistry.
 * Returns undefined if neither is found.
 */
export function resolveProviderConfig(provider: string): ProviderConfig | undefined {
  // Built-in first
  if (provider in AI_PROVIDERS) {
    const cfg = AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS];
    // Override Ollama baseUrl at call-time to use Vite proxy in dev mode
    if (provider === 'ollama') {
      return { ...cfg, baseUrl: getOllamaBaseUrl() };
    }
    return cfg;
  }
  // Plugin fallback
  if (isPluginProvider(provider)) {
    try {
      // Dynamic import to avoid circular dependency at module level
      const { getPlugin, pluginToProviderConfig } = require('./PluginRegistry');
      const plugin = getPlugin(provider);
      if (plugin) return pluginToProviderConfig(plugin);
    } catch {}
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Default system prompt (used when noSystemPrompt is false)
// ---------------------------------------------------------------------------

const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant in the KSC (Kerbal Space Center) Mission Control application.
You assist with mod management, answer questions about Kerbal Space Program,
and chat with the user as a friendly mission control operator.
Keep responses concise and in-character when appropriate.`;

// ---------------------------------------------------------------------------
// localStorage key management
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = 'ksc_ai_';

export function getCustomApiKey(provider: CustomProvider): string | null {
  if (provider === 'ollama') return 'ollama'; // local, no key needed
  if (isPluginProvider(provider)) {
    // Read API key from the plugin entry itself
    try {
      const { getPlugin } = require('./PluginRegistry');
      const plugin = getPlugin(provider);
      return plugin?.apiKey ?? null;
    } catch {
      return null;
    }
  }
  return localStorage.getItem(`${STORAGE_PREFIX}key_${provider}`);
}

export function setApiKey(provider: CustomProvider, key: string): void {
  if (isPluginProvider(provider)) {
    // Store API key inside the plugin entry
    try {
      const { updatePlugin } = require('./PluginRegistry');
      updatePlugin(provider, { apiKey: key });
    } catch {}
    return;
  }
  localStorage.setItem(`${STORAGE_PREFIX}key_${provider}`, key);
}

export function clearApiKeyFor(provider: CustomProvider): void {
  if (isPluginProvider(provider)) {
    try {
      const { updatePlugin } = require('./PluginRegistry');
      updatePlugin(provider, { apiKey: '' });
    } catch {}
    return;
  }
  localStorage.removeItem(`${STORAGE_PREFIX}key_${provider}`);
}

function getBuiltinProviderKeys(): CustomProvider[] {
  return Object.keys(AI_PROVIDERS);
}

function getPluginProviderKeys(): CustomProvider[] {
  try {
    const { getAllPlugins } = require('./PluginRegistry');
    return getAllPlugins().map((p: { id: string }) => p.id);
  } catch {
    return [];
  }
}

function getAllProviderKeys(): CustomProvider[] {
  return [...getBuiltinProviderKeys(), ...getPluginProviderKeys()];
}

export function hasAnyCustomKey(): boolean {
  return getAllProviderKeys().some(
    (p) => (p === 'ollama' && ollamaDetected === true) || (p !== 'ollama' && !!getCustomApiKey(p))
  );
}

export function getConfiguredProviders(): CustomProvider[] {
  return getAllProviderKeys().filter(
    (p) => (p === 'ollama' && ollamaDetected === true) || (p !== 'ollama' && !!getCustomApiKey(p))
  );
}

export function getSelectedProvider(): CustomProvider {
  return localStorage.getItem(`${STORAGE_PREFIX}provider`) || 'openrouter';
}

export function setSelectedProvider(p: CustomProvider): void {
  localStorage.setItem(`${STORAGE_PREFIX}provider`, p);
}

export function getSelectedModel(provider: CustomProvider): string {
  const saved = localStorage.getItem(`${STORAGE_PREFIX}model_${provider}`);
  if (saved) return saved;
  const config = resolveProviderConfig(provider);
  return config?.models[0]?.id ?? '';
}

export function setSelectedModel(provider: CustomProvider, model: string): void {
  localStorage.setItem(`${STORAGE_PREFIX}model_${provider}`, model);
}

/** Set the selected model for the current AI config (provider + model as a combined string like "openrouter:gpt-4o"). */
export function setAIConfigModel(configStr: string): void {
  const colonIdx = configStr.lastIndexOf(':');
  if (colonIdx === -1) {
    // Just a model name — use selected provider
    const prov = getSelectedProvider();
    setSelectedModel(prov, configStr);
  } else {
    const prov = configStr.slice(0, colonIdx);
    const model = configStr.slice(colonIdx + 1);
    setSelectedProvider(prov);
    setSelectedModel(prov, model);
  }
}

export function getKerbalModelOverride(): string {
  return localStorage.getItem(`${STORAGE_PREFIX}kerbal_model`) || '';
}

export function setKerbalModelOverride(model: string): void {
  localStorage.setItem(`${STORAGE_PREFIX}kerbal_model`, model);
}

// ---------------------------------------------------------------------------
// Message trimming
// ---------------------------------------------------------------------------

const MAX_MESSAGES = 30;
const KEEP_LAST = 20;

function trimMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_MESSAGES) return messages;
  const systemMsg = messages.find(m => m.role === 'system');
  if (systemMsg) {
    const nonSystem = messages.filter(m => m.role !== 'system');
    if (nonSystem.length > KEEP_LAST) {
      const trimmed = nonSystem.slice(-KEEP_LAST);
      return [systemMsg, ...trimmed];
    }
    return messages;
  }
  return messages.slice(-KEEP_LAST);
}

// ---------------------------------------------------------------------------
// Electron-safe fetch — routes through main process IPC when running in EXE
// to bypass file:// origin restrictions on fetch() in the renderer.
// Falls back to regular browser fetch() when not in Electron.
// ---------------------------------------------------------------------------

interface ElectronFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  body: string;
}

interface ElectronAIAPI {
  aiFetch: (params: { method: string; url: string; headers: Record<string, string>; body?: string }) => Promise<ElectronFetchResult>;
}

/**
 * Electron-safe fetch that proxies HTTP requests through the main process
 * when running in the Electron EXE (where file:// origin blocks outbound fetch).
 */
async function electronSafeFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const ei = (window as unknown as { electronAPI?: ElectronAIAPI }).electronAPI;
  if (ei?.aiFetch) {
    const result = await ei.aiFetch({
      method: (options.method as string) ?? 'GET',
      url,
      headers: (options.headers as Record<string, string>) ?? {},
      body: options.body as string | undefined,
    });
    if (!result.ok && result.status === 0) {
      // Main process threw a network error — throw the same way fetch() would
      throw new TypeError(`Failed to fetch (via IPC): ${result.statusText}`);
    }
    return new Response(result.body, {
      status: result.ok ? result.status : result.status,
      statusText: result.statusText,
    });
  }
  // Fall back to browser fetch
  return fetch(url, options);
}

// ---------------------------------------------------------------------------
// Ollama helpers — uses Vite proxy in dev mode to bypass CORS
// ---------------------------------------------------------------------------

/** Returns the correct Ollama endpoint depending on dev/prod environment. */
function ollamaEndpoint(path: string): string {
  // In Vite dev mode, use proxy to work around Ollama's missing CORS headers
  if (typeof window !== 'undefined') {
    const port = window.location.port;
    if (port === '5173' || port === '5174') {
      return `/ollama-proxy${path}`;
    }
  }
  // Use 127.0.0.1 instead of localhost — Node's fetch inside Electron's main
  // process sometimes picks IPv6 ::1 first when given "localhost", which
  // breaks the connection even when the IPv4 server is healthy.
  return `http://127.0.0.1:11434${path}`;
}

/** Resolve the Ollama baseUrl at call time (proxy vs direct). */
function getOllamaBaseUrl(): string {
  return ollamaEndpoint('/v1');
}

let ollamaDetected: boolean | null = null;
let ollamaModels: string[] | null = null;
let ollamaDetectionTime: number = 0;
const OLLAMA_DETECTION_TTL_MS = 30_000;

async function detectOllama(): Promise<boolean> {
  if (ollamaDetected !== null && Date.now() - ollamaDetectionTime < OLLAMA_DETECTION_TTL_MS) return ollamaDetected;
  try {
    const res = await electronSafeFetch(ollamaEndpoint('/api/tags'), {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      ollamaModels = (data.models ?? []).map((m: { name: string }) => m.name);
      ollamaDetected = true;
    } else {
      ollamaDetected = false;
    }
  } catch {
    ollamaDetected = false;
  }
  ollamaDetectionTime = Date.now();
  return ollamaDetected;
}

export function refreshOllamaDetection(): void {
  ollamaDetected = null;
  ollamaModels = null;
  ollamaDetectionTime = 0;
}

function getOllamaAvailableModels(): string[] {
  return ollamaModels ?? [];
}

function resolveOllamaModel(fallbackModel?: string): string {
  const model = fallbackModel ?? getSelectedModel('ollama');
  const available = getOllamaAvailableModels();
  if (available.length > 0 && !available.includes(model)) {
    return available[0];
  }
  return model;
}

// ---------------------------------------------------------------------------
// Custom provider chat
// ---------------------------------------------------------------------------

export async function chatWithCustomProvider(
  provider: CustomProvider,
  model: string,
  messages: ChatMessage[],
  options?: CustomChatOptions,
): Promise<AiChatResult> {
  messages = trimMessages(messages);
  const apiKey = provider === 'ollama' ? 'ollama' : getCustomApiKey(provider);
  const config = resolveProviderConfig(provider);
  if (!apiKey && provider !== 'ollama') throw new Error(`No API key set for ${config?.label ?? provider}. Add it in Settings.`);
  if (!config) throw new Error(`Unknown provider: ${provider}`);
  const signal = options?.signal ?? AbortSignal.timeout(120_000);
  const fullMessages: ChatMessage[] = options?.noSystemPrompt
    ? messages
    : [{ role: 'system', content: DEFAULT_SYSTEM_PROMPT }, ...messages];

  if (config.openaiCompat) {
    const baseTemp = options?.temperature ?? 0.7;
    const isOModel = provider === 'openai' && model.startsWith('o');
    const body: Record<string, unknown> = {
      model,
      messages: fullMessages,
      ...(isOModel
        ? { max_completion_tokens: 4096 }
        : { max_tokens: provider === 'ollama' ? 2048 : 4096 }),
      ...(isOModel ? {} : { temperature: baseTemp }),
    };
    if (options?.topP !== undefined) body.top_p = options.topP;

    const res = await electronSafeFetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let errorMessage: string;
      if (res.status === 401 || res.status === 403) {
        errorMessage = `Invalid API key for ${config.label}. Please check your API key in Settings.`;
      } else if (res.status === 429) {
        errorMessage = `Rate limited by ${config.label}. Please wait and try again.`;
      } else if (res.status >= 500 && res.status <= 503) {
        errorMessage = `Service unavailable from ${config.label}. The provider may be down.`;
      } else {
        errorMessage = `${config.label} error (${res.status}): ${errText.slice(0, 200)}`;
      }
      throw new Error(errorMessage);
    }

    const data = await res.json();
    let reply = data.choices?.[0]?.message?.content;
    let retryUsed = false;

    // Retry with different params if empty
    if (!reply) {
      console.warn(`[ai] Empty response from ${config.label}, retrying...`);
      // Retry 1: higher temperature + no max_tokens limit
      try {
        const retryBody: Record<string, unknown> = { ...body, temperature: Math.min(baseTemp + 0.2, 1.2) };
        delete retryBody.max_tokens;
        const r1 = await electronSafeFetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(retryBody),
          signal,
        });
        if (r1.ok) {
          const d1 = await r1.json();
          reply = d1.choices?.[0]?.message?.content;
          if (reply) retryUsed = true;
        }
      } catch { /* continue */ }

      // Retry 2: minimal prompt — just the last user message
      if (!reply) {
        console.warn(`[ai] Retry 2: minimal prompt...`);
        try {
          const lastUser = fullMessages.filter(m => m.role === 'user').slice(-1);
          const retryMessages: ChatMessage[] = [
            ...lastUser,
          ];
          const r2 = await electronSafeFetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model,
              messages: retryMessages,
              temperature: baseTemp + 0.1,
              max_tokens: 200,
            }),
            signal,
          });
          if (r2.ok) {
            const d2 = await r2.json();
            reply = d2.choices?.[0]?.message?.content;
            if (reply) retryUsed = true;
          }
        } catch { /* continue */ }
      }
    }

    if (!reply) {
      console.error(`[ai] All attempts empty for ${config.label}/${model}`);
    }

    return {
      reply: reply || EMPTY_RESPONSE,
      model,
      usage: retryUsed ? undefined : data.usage,
      tier: 'custom',
    };
  } else {
    // Google Gemini format
    const contents = fullMessages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = fullMessages.find((m) => m.role === 'system');

    const res = await electronSafeFetch(
      `${config.baseUrl}/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey!,
        },
        body: JSON.stringify({
          contents,
          ...(systemInstruction
            ? { systemInstruction: { parts: [{ text: systemInstruction.content }] } }
            : {}),
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: options?.temperature ?? 0.7,
          },
        }),
        signal,
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`${config.label} error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from model.';
    return { reply: text, model, tier: 'custom' };
  }
}

// ---------------------------------------------------------------------------
// Provider-aware unified chat (routes to the selected provider)
// ---------------------------------------------------------------------------

/**
 * Unified chat endpoint: routes to the user's selected provider.
 * On auth failure, falls back to Ollama if available.
 * No server-side fallback — fully client-side.
 */
export async function chatViaProvider(
  messages: ChatMessage[],
  options?: CustomChatOptions,
): Promise<AiChatResult> {
  messages = trimMessages(messages);

  // Early check: if the selected provider has no key (or the user has no
  // keys at all), try Ollama so the chat still works.
  const configuredProviders = getConfiguredProviders();
  const selectedProvider = getSelectedProvider();
  const selectedHasKey =
    selectedProvider === 'ollama'
      ? true // Ollama doesn't need a key — detection happens below
      : !!getCustomApiKey(selectedProvider);

  if (configuredProviders.length === 0 || !selectedHasKey) {
    const reason = configuredProviders.length === 0
      ? 'No API keys configured'
      : `Selected provider "${selectedProvider}" has no API key`;
    console.log(`[ai] ${reason}, checking Ollama...`);
    const ollamaAvailable = await detectOllama();
    if (ollamaAvailable) {
      console.log('[ai] Auto-switching to Ollama (fallback)');
      const ollamaModel = resolveOllamaModel();
      return await chatWithCustomProvider('ollama', ollamaModel, messages, {
        ...options,
        noSystemPrompt: options?.noSystemPrompt ?? false,
      });
    }
    throw new Error(
      configuredProviders.length === 0
        ? 'No AI provider configured. Add an API key in Settings (phone → Settings → AI Provider) or install and start Ollama locally (https://ollama.com).'
        : `Selected provider "${selectedProvider}" has no API key. Add one in Settings or install/start Ollama locally (https://ollama.com).`,
    );
  }

  const provider = getSelectedProvider();
  let model = getSelectedModel(provider);

  if (options?.noSystemPrompt) {
    const kerbalOverride = getKerbalModelOverride();
    if (kerbalOverride) model = kerbalOverride;
  }

  if (provider === 'ollama') {
    await detectOllama();
    model = resolveOllamaModel(model);
  }

  try {
    return await chatWithCustomProvider(provider, model, messages, {
      ...options,
      noSystemPrompt: options?.noSystemPrompt ?? false,
    });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    const isAuthError = msg.includes('401') || msg.includes('403') || msg.includes('Invalid API key') || msg.includes('No API key');
    const isNetworkError = msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network') || msg.includes('ERR_CONNECTION');
    if (isAuthError || isNetworkError) {
      console.warn(`[ai] ${provider} ${isAuthError ? 'auth' : 'network'} failed, trying Ollama fallback...`);
      const ollamaAvailable = await detectOllama();
      if (ollamaAvailable) {
        console.log('[ai] Falling back to Ollama');
        const ollamaModel = resolveOllamaModel();
        try {
          return await chatWithCustomProvider('ollama', ollamaModel, messages, {
            ...options,
            noSystemPrompt: options?.noSystemPrompt ?? false,
          });
        } catch (ollamaErr: any) {
          console.warn('[ai] Ollama fallback also failed:', ollamaErr?.message ?? String(ollamaErr));
        }
      }
      const reason = isAuthError ? 'auth error' : 'network error';
      throw new Error(
        `Custom provider failed with ${reason} and no fallback is available. ` +
        'Please check your API key in Settings or set up a local Ollama instance.',
      );
    }
    throw err;
  }
}
