import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { kerbalStore } from '../KerbalStore';
import type { KerbalState } from '../KerbalStore';
import { SoulLoader } from '../SoulLoader';
import type { KerbalSoul } from '../SoulLoader';
import { statsToApiParams } from '../SoulLoader';
import { growthSystem } from '../GrowthSystem';
import { chatViaProvider, EMPTY_RESPONSE } from '../../services/ai';
import { KerbalMemory } from '../KerbalMemory';
import { moodSystem } from '../MoodSystem';
import { storyEngine } from '../StoryEngine';
import { buildToolsPrompt, parseToolCalls, executeToolCall, stripToolCalls } from '../AgentSkills';
import { t, getLanguage, setLanguage } from '../../services/i18n';
import type { Language } from '../../services/i18n';
import { idleBanter } from './IdleBanter';
import ApiPlugins from '../../services/ApiPlugins';
import {
  getConfiguredProviders,
  getSelectedProvider,
  setSelectedProvider,
  getSelectedModel,
  setSelectedModel,
  resolveProviderConfig,
} from '../../services/ai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContactThread {
  kerbal: KerbalState;
  messages: ThreadMessage[];
}

export interface ThreadMessage {
  id: string;
  sender: 'user' | string; // string = kerbal name
  content: string;
  timestamp: number;
  isGroggy?: boolean;
}

type ViewMode = 'contacts' | 'thread' | 'settings';

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const THREADS_KEY = 'kerbal-control:phone-threads';

function loadThreads(): Record<string, ThreadMessage[]> {
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveThreads(threads: Record<string, ThreadMessage[]>): void {
  try {
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  } catch (err) {
    console.warn('[SmartphoneModal] Failed to save threads to localStorage:', err);
  }
}

// ---------------------------------------------------------------------------
// Helpers — derived from actual KerbalState fields
// ---------------------------------------------------------------------------

type DerivedStatus = 'on-shift' | 'on-break' | 'off-shift';

function deriveStatus(kerbal: KerbalState): DerivedStatus {
  if (!kerbal.present) return 'off-shift';
  if (kerbalStore.isOnBreak(kerbal.name)) return 'on-break';
  return 'on-shift';
}

function statusColor(status: DerivedStatus): string {
  switch (status) {
    case 'on-shift':
      return 'bg-green-400';
    case 'on-break':
      return 'bg-orange-400';
    case 'off-shift':
      return 'bg-gray-500';
  }
}

function statusText(status: DerivedStatus): string {
  switch (status) {
    case 'on-shift':
      return t('status.onShift');
    case 'on-break':
      return t('status.onBreak');
    case 'off-shift':
      return t('status.offShift');
  }
}

function isOffShift(status: DerivedStatus): boolean {
  return status === 'off-shift';
}

// ---------------------------------------------------------------------------
// Soul cache — avoid re-fetching from network on every message
// ---------------------------------------------------------------------------

const soulCache = new Map<string, KerbalSoul>();

async function getSoulCached(kerbalName: string): Promise<KerbalSoul> {
  const key = kerbalName.toLowerCase();
  const cached = soulCache.get(key);
  if (cached) return cached;
  const soul = await SoulLoader.loadWithGrowth(key);
  soulCache.set(key, soul);
  return soul;
}

// ---------------------------------------------------------------------------
// BanterToggle — iOS-style toggle for Kerbal Banter
// ---------------------------------------------------------------------------

const IDLE_CONFIG_KEY = 'kerbal-control:idle-config';

/** Read banter enabled from localStorage (handles missing/corrupt data). */
function readBanterEnabled(): boolean {
  try {
    const raw = localStorage.getItem(IDLE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.enabled === true;
    }
  } catch { /* corrupt data — default off */ }
  return false;
}

/** Write banter enabled to localStorage and sync with idleBanter singleton. */
function writeBanterEnabled(enabled: boolean): void {
  try {
    const raw = localStorage.getItem(IDLE_CONFIG_KEY);
    const config = raw ? JSON.parse(raw) : {};
    config.enabled = enabled;
    localStorage.setItem(IDLE_CONFIG_KEY, JSON.stringify(config));
  } catch { /* ignore storage errors */ }
  idleBanter.updateConfig({ enabled });
}

const BanterToggle: React.FC = () => {
  const [banterOn, setBanterOn] = useState(() => readBanterEnabled());
  const toggleId = 'banter-toggle';

  const handleToggle = useCallback(() => {
    const next = !banterOn;
    setBanterOn(next);
    writeBanterEnabled(next);
  }, [banterOn]);

  return (
    <div className="flex items-center justify-between py-1">
      <label htmlFor={toggleId} style={{ color: '#aaa', fontSize: 12, cursor: 'pointer' }}>
        Kerbal Banter
      </label>
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={banterOn}
        onClick={handleToggle}
        style={{
          position: 'relative',
          width: 44,
          height: 24,
          borderRadius: 12,
          border: 'none',
          cursor: 'pointer',
          background: banterOn ? '#34c759' : '#39393f',
          transition: 'background 0.2s',
          padding: 0,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: banterOn ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            transition: 'left 0.2s',
          }}
        />
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SmartphoneModal
// ---------------------------------------------------------------------------

export interface SmartphoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  perContactUnread?: Record<string, number>;
  onOpenThread?: (kerbalName: string) => void;
}

const SmartphoneModal: React.FC<SmartphoneModalProps> = ({ isOpen, onClose, perContactUnread = {}, onOpenThread }) => {
  const [visible, setVisible] = useState(false);
  const [view, setView] = useState<ViewMode>('contacts');
  const [activeKerbal, setActiveKerbal] = useState<KerbalState | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSummoning, setIsSummoning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summonError, setSummonError] = useState<string | null>(null);
  const [settingsTick, setSettingsTick] = useState(0);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeKerbalRef = useRef<KerbalState | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Sync activeKerbalRef whenever activeKerbal changes
  useEffect(() => {
    activeKerbalRef.current = activeKerbal;
  }, [activeKerbal]);

  // Mark unmounted on cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (view === 'thread') {
      inputRef.current?.focus();
    }
  }, [view]);

  // Sync external isOpen → internal visible for mount animation
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  // Reset state when fully closed
  useEffect(() => {
    if (!isOpen && !visible) {
      setView('contacts');
      setActiveKerbal(null);
      setMessages([]);
      setInputValue('');
      setIsSummoning(false);
      setIsGenerating(false);
      setSummonError(null);
    }
  }, [isOpen, visible]);

  // Status bar clock - update every 30s
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => clearInterval(interval);
  }, [visible]);

  // Subscribe to kerbalStore changes for reactive contact list updates
  useEffect(() => {
    const unsub = kerbalStore.subscribe(() => setForceUpdate(n => n + 1));
    return unsub;
  }, []);

  const handleClose = useCallback(() => {
    // Abort any in-flight request before closing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setVisible(false);
  }, []);

  const handleExitComplete = useCallback(() => {
    if (!visible) onClose();
  }, [visible, onClose]);

  const sendMessage = useCallback(async () => {
    // Read current values from refs to avoid stale closures on rapid typing
    const currentKerbal = activeKerbalRef.current;
    const rawValue = inputRef.current?.value ?? '';
    const trimmed = rawValue.trim();
    if (!trimmed || !currentKerbal) return;

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMsg: ThreadMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    if (inputRef.current) inputRef.current.value = '';
    setSummonError(null);

    const status = deriveStatus(currentKerbal);

    // ---- Off-shift: wake-up delay + groggy AI response ----
    if (isOffShift(status)) {
      setIsSummoning(true);

      // 30% chance of no response (deep asleep) — show immediately, no artificial delay
      if (Math.random() < 0.3) {
        setSummonError(t('mc.noResponse'));
        setIsSummoning(false);
        abortControllerRef.current = null;
        return;
      }

      // Simulate wake-up time: 5-10 seconds
      const wakeDelay = 5000 + Math.random() * 5000;
      await new Promise((resolve) => setTimeout(resolve, wakeDelay));

      // Check if aborted or unmounted after the delay
      if (controller.signal.aborted || !mountedRef.current) {
        abortControllerRef.current = null;
        return;
      }

      try {
        const soul: KerbalSoul = await getSoulCached(currentKerbal.name);
        const params = statsToApiParams(soul);

        const memoryCtx = KerbalMemory.buildMemoryContext(currentKerbal.name);

        const messages = [
          {
            role: 'system' as const,
            content: `[GROGGY - just woke up]\n\n${soul.rawMarkdown}${memoryCtx}`,
          },
          { role: 'user' as const, content: trimmed },
        ];

        const result = await chatViaProvider(messages, {
          temperature: params.temperature,
          topP: params.topP,
          noSystemPrompt: true,
          signal: controller.signal,
        });

        if (controller.signal.aborted || !mountedRef.current) return;

        const kerbalMsg: ThreadMessage = {
          id: `msg-${Date.now()}-${currentKerbal.name}`,
          sender: currentKerbal.name,
          content: (result.reply && result.reply !== EMPTY_RESPONSE) ? result.reply : `*${currentKerbal.name} ${t('mc.mumbles')}*`,
          timestamp: Date.now(),
          isGroggy: true,
        };
        setMessages((prev) => [...prev, kerbalMsg]);

        KerbalMemory.addSummary(currentKerbal.name, result.reply);
        KerbalMemory.extractAndStore(currentKerbal.name, trimmed);
        growthSystem.tick(currentKerbal.name, 'successful_chat');
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        growthSystem.tick(currentKerbal.name, 'error_response');
        setSummonError(
          err instanceof Error ? err.message : 'No response.',
        );
      } finally {
        if (mountedRef.current) setIsSummoning(false);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
      return;
    }

    // ---- On-shift / On-break: real AI call with typing indicator ----
    setIsGenerating(true);
    try {
      const soul: KerbalSoul = await getSoulCached(currentKerbal.name);
      const params = statsToApiParams(soul);

      const memoryCtx = KerbalMemory.buildMemoryContext(currentKerbal.name);
      const moodCtx = moodSystem.buildMoodPrompt(currentKerbal.name);
      const storyCtx = storyEngine.buildStoryPrompt(currentKerbal.name);
      const toolsCtx = buildToolsPrompt(soul.role);
      const systemPrompt = [soul.rawMarkdown, moodCtx, memoryCtx, storyCtx, toolsCtx].filter(Boolean).join('\n\n');

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: trimmed },
      ];

      const result = await chatViaProvider(messages, {
        temperature: params.temperature,
        topP: params.topP,
        noSystemPrompt: true,
        signal: controller.signal,
      });

      if (controller.signal.aborted || !mountedRef.current) return;

      let reply = (result.reply && result.reply !== EMPTY_RESPONSE) ? result.reply : `*${currentKerbal.name} ${t('mc.aiUnavailable')}*`;
      const toolCalls = parseToolCalls(reply);
      for (const tc of toolCalls.slice(0, 2)) {
        if (controller.signal.aborted) break;
        try {
          const toolResult = await executeToolCall(tc);
          const followUpMessages = [
            { role: 'system' as const, content: `[TOOL RESULT for ${tc.toolName}]: ${toolResult}\n\nRespond naturally.` },
            { role: 'user' as const, content: trimmed },
          ];
          const followUp = await chatViaProvider(followUpMessages, { temperature: params.temperature, topP: params.topP, noSystemPrompt: true, signal: controller.signal });
          if (controller.signal.aborted) return;
          if (followUp.reply && followUp.reply !== EMPTY_RESPONSE) reply = stripToolCalls(followUp.reply);
        } catch {}
      }

      if (controller.signal.aborted || !mountedRef.current) return;
      const finalContent = stripToolCalls(reply);

      const kerbalMsg: ThreadMessage = {
        id: `msg-${Date.now()}-${currentKerbal.name}`,
        sender: currentKerbal.name,
        content: finalContent,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, kerbalMsg]);

      KerbalMemory.addSummary(currentKerbal.name, result.reply);
      moodSystem.tickMood(currentKerbal.name, 'user_interaction');
      growthSystem.tick(currentKerbal.name, 'successful_chat');
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return; // Silently ignore aborts
      }
      if (!mountedRef.current) return;
      console.error(
        `[SmartphoneModal] AI call failed for ${currentKerbal.name}:`,
        err,
      );
      growthSystem.tick(currentKerbal.name, 'error_response');
      // Fall back to echo behavior if AI call fails
      const kerbalMsg: ThreadMessage = {
        id: `msg-${Date.now()}-${currentKerbal.name}`,
        sender: currentKerbal.name,
        content: `*${currentKerbal.name} ${t('mc.aiUnavailable')}*`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, kerbalMsg]);
    } finally {
      if (mountedRef.current) setIsGenerating(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, []);

  const openThread = useCallback((kerbal: KerbalState) => {
    setActiveKerbal(kerbal);
    const saved = loadThreads();
    setMessages(saved[kerbal.name] ?? []);
    setView('thread');
    setInputValue('');
    setIsSummoning(false);
    setIsGenerating(false);
    setSummonError(null);
    // Reset per-contact unread count when opening a thread
    if (onOpenThread) onOpenThread(kerbal.name);
  }, [onOpenThread]);

  // Save thread messages to localStorage whenever they change
  useEffect(() => {
    if (!activeKerbal || view !== 'thread') return;
    const saved = loadThreads();
    saved[activeKerbal.name] = messages;
    saveThreads(saved);
  }, [messages, activeKerbal, view]);

  const backToContacts = useCallback(() => {
    setView('contacts');
    setActiveKerbal(null);
    setMessages([]);
    setInputValue('');
    setIsSummoning(false);
    setIsGenerating(false);
    setSummonError(null);
  }, []);

  const cancelMessage = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setIsSummoning(false);
  }, []);

  const handleSettingsChange = () => {
    setSettingsTick(t => t + 1);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (isOpen) window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [isOpen, handleClose]);

  if (!isOpen && !visible) return null;

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {visible && (
        <div
          className="fixed inset-0 z-50 bg-black/30"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          {/* Phone body — slides up from bottom-right like GTA */}
          <motion.div
            key="smartphone"
            className="absolute right-6 bottom-0 w-[248px] h-[436px] bg-zinc-900 rounded-[2.8rem] border-[4px] border-zinc-500/60 shadow-2xl overflow-hidden flex flex-col"
            style={{
              boxShadow: '0 25px 60px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.08)',
            }}
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            exit={{ y: '105%' }}
            transition={{
              type: 'spring',
              damping: 28,
              stiffness: 350,
              mass: 0.8,
            }}
          >
        {/* Notch / speaker grille — more realistic */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center pointer-events-none" style={{ paddingTop: 8 }}>
          {/* Camera lens */}
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-950 ring-[1.5px] ring-zinc-500/60 mb-0.5" />
          {/* Speaker grille */}
          <div className="w-10 h-[3px] rounded-full bg-zinc-800 ring-[0.5px] ring-zinc-600/30" />
        </div>

        {/* Screen — single scrollable surface, fully rounded inside */}
        <div className="flex-1 flex flex-col text-white rounded-[2.4rem] overflow-hidden" style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #0d0d1a 100%)', margin: 3 }}>
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-3 pb-1 text-[10px] text-zinc-300 shrink-0">
            <span className="font-semibold tracking-wide">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <div className="flex items-center gap-2">
              {/* Signal bars */}
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none" className="text-zinc-300">
                <rect x="0" y="6" width="2.5" height="4" rx="0.5" fill="currentColor" opacity="0.4"/>
                <rect x="3.5" y="4" width="2.5" height="6" rx="0.5" fill="currentColor" opacity="0.6"/>
                <rect x="7" y="2" width="2.5" height="8" rx="0.5" fill="currentColor" opacity="0.8"/>
                <rect x="10.5" y="0" width="2.5" height="10" rx="0.5" fill="currentColor"/>
              </svg>
              {/* Battery */}
              <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className="text-zinc-300">
                <rect x="0.5" y="0.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="0.8" fill="none"/>
                <rect x="14" y="3" width="1.5" height="4" rx="0.5" fill="currentColor" opacity="0.5"/>
                <rect x="1.5" y="1.5" width="9" height="7" rx="1" fill="currentColor" opacity="0.85"/>
              </svg>
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {view === 'thread' ? (
              <button
                type="button"
                className="text-blue-400 hover:text-blue-300 text-sm leading-none shrink-0 w-6 h-6 flex items-center justify-center"
                onClick={backToContacts}
                aria-label={t('mc.backToContacts')}
              >
                &#8592;
              </button>
            ) : (
              <div className="w-6 shrink-0" />
            )}
            <h2 className="text-sm font-semibold flex-1 truncate text-center">
              {view === 'contacts' ? t('mc.contacts') : activeKerbal?.name ?? t('mc.chat')}
            </h2>
            <button
              type="button"
              className="text-zinc-400 hover:text-white text-sm leading-none shrink-0 w-6 h-6 flex items-center justify-center"
              onClick={handleClose}
              aria-label={t('mc.close')}
            >
              &#10005;
            </button>
          </div>

          {/* Bottom Tab Bar */}
          <div className="flex shrink-0" style={{
            background: '#12121e',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <button
              onClick={() => {
                setView('contacts');
                handleSettingsChange();
              }}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 text-[10px] transition-colors"
              style={{
                background: view === 'contacts' ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: view === 'contacts' ? '#fff' : '#666',
              }}
            >
              {/* Contacts icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span style={{ fontWeight: view === 'contacts' ? 600 : 400 }}>{t('phone.contacts')}</span>
            </button>
            <button
              onClick={() => setView('settings')}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 text-[10px] transition-colors"
              style={{
                background: view === 'settings' ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: view === 'settings' ? '#fff' : '#666',
              }}
            >
              {/* Settings icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span style={{ fontWeight: view === 'settings' ? 600 : 400 }}>{t('phone.settings')}</span>
            </button>
          </div>

          {/* Body area */}
          <div className="flex-1 flex flex-col min-h-0">
            {view === 'contacts' ? (
              <ul className="flex-1 overflow-y-auto divide-y divide-zinc-800/50 overscroll-contain [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-track]:bg-transparent">
                {kerbalStore.getAll().map((k) => {
                  const s = deriveStatus(k);
                  const unread = perContactUnread[k.name] || 0;
                  return (
                    <li
                      key={k.name}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/60 cursor-pointer transition-colors"
                      onClick={() => openThread(k)}
                    >
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColor(s)}`}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-xs block truncate">
                          {k.name}
                        </span>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {statusText(s)}
                        </p>
                      </div>
                      {unread > 0 && (
                        <span className="flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none flex-shrink-0">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                      <span className="text-zinc-600 text-sm">&#8250;</span>
                    </li>
                  );
                })}
              </ul>
            ) : view === 'settings' ? (
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 12,
                background: '#0f0f1a',
                color: '#ccc',
                fontSize: 13,
              }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: 14 }}>
                  {t('settings.title')}
                </h3>

                {/* Provider Selector */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, color: '#aaa', fontSize: 12 }}>
                    {t('settings.provider')}
                  </label>
                  <select
                    value={getSelectedProvider()}
                    onChange={e => {
                      setSelectedProvider(e.target.value);
                      handleSettingsChange();
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      background: '#1a1a2e',
                      color: '#fff',
                      border: '1px solid #333',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    {getConfiguredProviders().map(p => (
                      <option key={p} value={p}>{resolveProviderConfig(p)?.label ?? p}</option>
                    ))}
                  </select>
                </div>

                {/* Model Input */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, color: '#aaa', fontSize: 12 }}>
                    {t('settings.modelLabel')}
                  </label>
                  <input
                    type="text"
                    defaultValue={getSelectedModel(getSelectedProvider())}
                    onBlur={e => {
                      setSelectedModel(getSelectedProvider(), e.target.value);
                      handleSettingsChange();
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setSelectedModel(getSelectedProvider(), (e.target as HTMLInputElement).value);
                        handleSettingsChange();
                      }
                    }}
                    placeholder="e.g. gpt-4"
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      background: '#1a1a2e',
                      color: '#fff',
                      border: '1px solid #333',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  />
                </div>

                {/* Language Toggle */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, color: '#aaa', fontSize: 12 }}>
                    {t('settings.language')}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['zh', 'en', 'ja'].map(lang => (
                      <button
                        key={lang}
                        onClick={() => {
                          setLanguage(lang as Language);
                          handleSettingsChange();
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          border: `1px solid ${getLanguage() === lang ? '#ff9900' : '#333'}`,
                          background: getLanguage() === lang ? '#2a2a1e' : '#1a1a2e',
                          color: getLanguage() === lang ? '#ff9900' : '#888',
                          cursor: 'pointer',
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        {lang === 'zh' ? '中文' : lang === 'en' ? 'English' : '日本語'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Banter Toggle */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, color: '#aaa', fontSize: 12 }}>
                    {t('settings.banter') || 'Kerbal Banter'}
                  </label>
                  <BanterToggle />
                </div>

                {/* ApiPlugins */}
                <div>
                  <ApiPlugins key={settingsTick} />
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0 overscroll-contain [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-track]:bg-transparent">
                  {messages.length === 0 && !isSummoning && !isGenerating && (
                    <p className="text-center text-[10px] text-zinc-600 mt-8 px-2">
                      {t('mc.startConversation')} {activeKerbal?.name}
                    </p>
                  )}

                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.sender === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] px-2.5 py-1.5 rounded-2xl text-xs leading-snug ${
                          msg.sender === 'user'
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : msg.isGroggy
                              ? 'bg-zinc-800 text-zinc-300 rounded-bl-md italic'
                              : 'bg-zinc-800 text-zinc-300 rounded-bl-md'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                        <span
                          className={`block text-[9px] mt-0.5 ${
                            msg.sender === 'user'
                              ? 'text-blue-200 text-right'
                              : 'text-zinc-500 text-right'
                          }`}
                        >
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  ))}

                  {isSummoning && (
                    <div className="flex justify-start">
                      <div className="bg-zinc-800 text-zinc-400 text-[10px] px-3 py-1.5 rounded-2xl rounded-bl-md animate-pulse italic">
                        {t('mc.waking')} {activeKerbal?.name}...
                      </div>
                    </div>
                  )}

                  {isGenerating && (
                    <div className="flex justify-start">
                      <div className="bg-zinc-800 text-zinc-400 text-[10px] px-3 py-1.5 rounded-2xl rounded-bl-md animate-pulse italic">
                        {activeKerbal?.name} {t('mc.typing')}
                      </div>
                    </div>
                  )}

                  {summonError && (
                    <div className="flex justify-center px-2">
                      <div className="bg-red-900/50 text-red-300 text-[10px] px-2 py-1 rounded-lg text-center">
                        {summonError}
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-zinc-800/60 px-3 py-2 flex gap-2 items-center shrink-0">
                  <input
                    ref={inputRef}
                    type="text"
                    className="flex-1 min-w-0 bg-zinc-800 text-white text-xs rounded-full px-3 py-1.5 outline-none placeholder-zinc-500 focus:ring-1 focus:ring-inset focus:ring-blue-500"
                    placeholder={
                      (() => {
                        if (isSummoning) return t('mc.waitingPlaceholder');
                        if (isGenerating) return `${activeKerbal?.name} ${t('mc.thinking')}`;
                        return `${t('mc.messageThem')} ${activeKerbal?.name}...`;
                      })()
                    }
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isSummoning || isGenerating}
                  />
                  {isSummoning || isGenerating ? (
                    <button
                      type="button"
                      className="flex-shrink-0 w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
                      onClick={cancelMessage}
                      aria-label={t('mc.cancel')}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-500 disabled:opacity-40 transition-colors"
                      onClick={sendMessage}
                      disabled={!inputValue.trim()}
                      aria-label={t('mc.sendMessage')}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 12h14m0 0l-6-6m6 6l-6 6"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SmartphoneModal;
