/**
 * ApiPlugins — Phone-compatible UI for managing custom API provider plugins.
 *
 * Provides CRUD management for PluginRegistry entries with a compact layout
 * designed for the 240px-wide phone screen.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  getAllPlugins,
  createPlugin,
  updatePlugin,
  deletePlugin,
  pluginToProviderConfig,
  type PluginProviderEntry,
  type PluginModelEntry,
} from './PluginRegistry';
import { t } from './i18n';

// ---------------------------------------------------------------------------
// Default model preset
// ---------------------------------------------------------------------------

const DEFAULT_MODEL: PluginModelEntry = { id: 'gpt-4o-mini', label: 'Default' };

// ---------------------------------------------------------------------------
// Editable form state for a single plugin
// ---------------------------------------------------------------------------

interface PluginFormState {
  name: string;
  baseUrl: string;
  apiKey: string;
  models: PluginModelEntry[];
  allowCustomModel: boolean;
}

const emptyForm = (): PluginFormState => ({
  name: '',
  baseUrl: '',
  apiKey: '',
  models: [{ ...DEFAULT_MODEL }],
  allowCustomModel: true,
});

function formFromPlugin(p: PluginProviderEntry): PluginFormState {
  return {
    name: p.name,
    baseUrl: p.baseUrl,
    apiKey: p.apiKey,
    models: p.models.length > 0 ? p.models.map((m) => ({ ...m })) : [{ ...DEFAULT_MODEL }],
    allowCustomModel: p.allowCustomModel,
  };
}

// ---------------------------------------------------------------------------
// Test-connection helper
// ---------------------------------------------------------------------------

async function testConnection(baseUrl: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const count = data?.data?.length ?? 0;
      return t('plugin.testOk', { count: String(count) });
    }
    const status = res.status;
    const text = await res.text().catch(() => '');
    return `${t('plugin.testFail')} (${status}): ${text.slice(0, 60)}`;
  } catch (err: unknown) {
    return `${t('plugin.testFail')}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ---------------------------------------------------------------------------
// PluginCard — collapsible card for one plugin
// ---------------------------------------------------------------------------

interface PluginCardProps {
  plugin: PluginProviderEntry;
  onUpdated: () => void;
  onDeleted: () => void;
}

const PluginCard: React.FC<PluginCardProps> = ({ plugin, onUpdated, onDeleted }) => {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<PluginFormState>(() => formFromPlugin(plugin));
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Reset local form when plugin changes (e.g. after parent re-fetch)
  useEffect(() => {
    if (!dirty) setForm(formFromPlugin(plugin));
  }, [plugin, dirty]);

  const handleSave = useCallback(() => {
    const success = updatePlugin(plugin.id, {
      name: form.name,
      baseUrl: form.baseUrl,
      apiKey: form.apiKey,
      models: form.models,
      allowCustomModel: form.allowCustomModel,
    });
    if (success) {
      setDirty(false);
      onUpdated();
    }
  }, [plugin.id, form, onUpdated]);

  const handleDelete = useCallback(() => {
    deletePlugin(plugin.id);
    onDeleted();
  }, [plugin.id, onDeleted]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testConnection(form.baseUrl, form.apiKey);
    setTestResult(result);
    setTesting(false);
  }, [form.baseUrl, form.apiKey]);

  const updateModel = useCallback((idx: number, field: keyof PluginModelEntry, value: string) => {
    setForm((prev) => {
      const models = [...prev.models];
      models[idx] = { ...models[idx], [field]: value };
      return { ...prev, models };
    });
    setDirty(true);
  }, []);

  const addModel = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      models: [...prev.models, { id: '', label: '' }],
    }));
    setDirty(true);
  }, []);

  const removeModel = useCallback((idx: number) => {
    setForm((prev) => ({
      ...prev,
      models: prev.models.filter((_, i) => i !== idx),
    }));
    setDirty(true);
  }, []);

  const hasChanges = dirty;

  return (
    <div className="border border-zinc-700 rounded-lg mb-2 overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-800/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0 mr-2">
          <span className="text-xs font-medium text-white truncate block">
            {plugin.name}
          </span>
          <span className="text-[10px] text-zinc-500 truncate block mt-0.5">
            {plugin.baseUrl} &middot; {plugin.models.length} models
          </span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded form */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-zinc-800 pt-2">
          {/* Name */}
          <div>
            <label className="text-[10px] text-zinc-400 block mb-0.5">{t('plugin.name')}</label>
            <input
              type="text"
              className="w-full bg-zinc-800 text-white text-[11px] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
              value={form.name}
              onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setDirty(true); }}
            />
          </div>

          {/* Base URL */}
          <div>
            <label className="text-[10px] text-zinc-400 block mb-0.5">{t('plugin.baseUrl')}</label>
            <input
              type="text"
              className="w-full bg-zinc-800 text-white text-[11px] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
              value={form.baseUrl}
              onChange={(e) => { setForm((p) => ({ ...p, baseUrl: e.target.value })); setDirty(true); }}
              placeholder="https://api.example.com/v1"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="text-[10px] text-zinc-400 block mb-0.5">{t('plugin.apiKey')}</label>
            <input
              type="password"
              className="w-full bg-zinc-800 text-white text-[11px] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
              value={form.apiKey}
              onChange={(e) => { setForm((p) => ({ ...p, apiKey: e.target.value })); setDirty(true); }}
              placeholder="sk-..."
            />
          </div>

          {/* Models */}
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-[10px] text-zinc-400">{t('plugin.models')}</label>
              <button
                type="button"
                className="text-[10px] text-blue-400 hover:text-blue-300"
                onClick={addModel}
              >
                + {t('common.add')}
              </button>
            </div>
            {form.models.map((m, idx) => (
              <div key={idx} className="flex gap-1 mb-1">
                <input
                  type="text"
                  className="flex-1 min-w-0 bg-zinc-800 text-white text-[10px] rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                  value={m.id}
                  onChange={(e) => updateModel(idx, 'id', e.target.value)}
                  placeholder="model-id"
                />
                <input
                  type="text"
                  className="flex-[2] min-w-0 bg-zinc-800 text-white text-[10px] rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                  value={m.label}
                  onChange={(e) => updateModel(idx, 'label', e.target.value)}
                  placeholder="Display name"
                />
                <button
                  type="button"
                  className="text-zinc-500 hover:text-red-400 text-[10px] px-1 shrink-0"
                  onClick={() => removeModel(idx)}
                  aria-label={t('common.remove')}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          {/* Allow custom model toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
              checked={form.allowCustomModel}
              onChange={(e) => { setForm((p) => ({ ...p, allowCustomModel: e.target.checked })); setDirty(true); }}
            />
            <span className="text-[10px] text-zinc-300">{t('plugin.allowCustom')}</span>
          </label>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[10px] rounded py-1 transition-colors"
              onClick={handleSave}
              disabled={!hasChanges}
            >
              {t('common.save')}
            </button>
            <button
              type="button"
              className="px-3 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white text-[10px] rounded py-1 transition-colors"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? '...' : t('plugin.test')}
            </button>
            <button
              type="button"
              className="px-3 bg-red-700 hover:bg-red-600 text-white text-[10px] rounded py-1 transition-colors"
              onClick={handleDelete}
            >
              {t('common.delete')}
            </button>
          </div>

          {/* Test result */}
          {testResult && (
            <p
              className={`text-[10px] mt-1 ${
                testResult.startsWith('OK')
                  ? 'text-green-400'
                  : testResult.includes('error') || testResult.includes('fail')
                    ? 'text-red-400'
                    : 'text-zinc-400'
              }`}
            >
              {testResult}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ApiPlugins — main component
// ---------------------------------------------------------------------------

const ApiPlugins: React.FC = () => {
  const [plugins, setPlugins] = useState<PluginProviderEntry[]>(() => getAllPlugins());
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<PluginFormState>(emptyForm);
  const [addError, setAddError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setPlugins(getAllPlugins());
  }, []);

  const handleAdd = useCallback(() => {
    // Validate
    if (!addForm.name.trim()) { setAddError(t('plugin.errNameRequired')); return; }
    if (!addForm.baseUrl.trim()) { setAddError(t('plugin.errUrlRequired')); return; }
    if (!addForm.apiKey.trim()) { setAddError(t('plugin.errKeyRequired')); return; }

    const id = createPlugin({
      name: addForm.name.trim(),
      baseUrl: addForm.baseUrl.trim().replace(/\/+$/, ''),
      apiKey: addForm.apiKey.trim(),
      models: addForm.models.filter((m) => m.id.trim()),
      allowCustomModel: addForm.allowCustomModel,
    });

    if (id) {
      setAddForm(emptyForm());
      setShowAddForm(false);
      setAddError(null);
      refresh();
    } else {
      setAddError(t('plugin.errCreate'));
    }
  }, [addForm, refresh]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <h3 className="text-xs font-semibold text-white">{t('plugin.title')}</h3>
        <button
          type="button"
          className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] rounded px-2 py-1 transition-colors"
          onClick={() => { setShowAddForm((v) => !v); setAddError(null); }}
        >
          {showAddForm ? t('common.cancel') : `+ ${t('common.add')}`}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="mx-3 mb-2 p-2 border border-blue-700/50 rounded-lg bg-zinc-900/80 space-y-1.5">
          <input
            type="text"
            className="w-full bg-zinc-800 text-white text-[11px] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
            value={addForm.name}
            onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
            placeholder={t('plugin.name')}
          />
          <input
            type="text"
            className="w-full bg-zinc-800 text-white text-[11px] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
            value={addForm.baseUrl}
            onChange={(e) => setAddForm((p) => ({ ...p, baseUrl: e.target.value }))}
            placeholder={t('plugin.baseUrl') + ' (https://...)'}
          />
          <input
            type="password"
            className="w-full bg-zinc-800 text-white text-[11px] rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
            value={addForm.apiKey}
            onChange={(e) => setAddForm((p) => ({ ...p, apiKey: e.target.value }))}
            placeholder={t('plugin.apiKey')}
          />
          <button
            type="button"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[10px] rounded py-1.5 transition-colors"
            onClick={handleAdd}
          >
            {t('plugin.addPlugin')}
          </button>
          {addError && (
            <p className="text-red-400 text-[10px]">{addError}</p>
          )}
        </div>
      )}

      {/* Plugin list */}
      <div className="flex-1 overflow-y-auto px-3 pb-2 overscroll-contain [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-track]:bg-transparent">
        {plugins.length === 0 && !showAddForm && (
          <p className="text-center text-[10px] text-zinc-600 mt-6 px-4">
            {t('plugin.noPlugins')}
          </p>
        )}
        {plugins.map((p) => (
          <PluginCard key={p.id} plugin={p} onUpdated={refresh} onDeleted={refresh} />
        ))}
      </div>
    </div>
  );
};

export default ApiPlugins;
