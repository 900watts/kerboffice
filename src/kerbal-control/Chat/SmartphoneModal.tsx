import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { kerbalStore } from '../KerbalStore';
import type { KerbalState } from '../KerbalStore';
import { SoulLoader } from '../SoulLoader';
import type { KerbalSoul } from '../SoulLoader';
import { statsToApiParams } from '../SoulLoader';
import { growthSystem } from '../GrowthSystem';
import { chatViaProvider, EMPTY_RESPONSE, setApiKey, getCustomApiKey, AI_PROVIDERS } from '../../services/ai';
import { KerbalMemory } from '../KerbalMemory';
import { moodSystem } from '../MoodSystem';
import { storyEngine } from '../StoryEngine';
import { buildToolsPrompt, parseToolCalls, executeToolCall, stripToolCalls } from '../AgentSkills';
import { t, getLanguage, setLanguage } from '../../services/i18n';
import type { Language } from '../../services/i18n';
import { idleBanter } from './IdleBanter';
import { UserProfile } from '../UserProfile';
import { timeSystem } from '../TimeSystem';
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

type ViewMode = 'home' | 'contacts' | 'thread' | 'settings';

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

function statusText(kerbal: KerbalState, status: DerivedStatus): string {
  if (status === 'off-shift') {
    return t(('status.position.' + kerbal.position) as any);
  }
  switch (status) {
    case 'on-shift':
      return t('status.onShift');
    case 'on-break':
      return t('status.onBreak');
  }
}

function isOffShift(status: DerivedStatus): boolean {
  return status === 'off-shift';
}

function getWakePrefix(kerbal: KerbalState): string {
  var key = 'wake.prefix.' + kerbal.position;
  return t(key as any);
}

/** Returns true when the in-game clock is in nighttime hours (18:00–06:00). */
function isNighttime(): boolean {
  return timeSystem.getTime().shiftType === 'night';
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
  onNewReply?: (kerbalName: string) => void;
}

const SmartphoneModal: React.FC<SmartphoneModalProps> = ({ isOpen, onClose, perContactUnread = {}, onOpenThread, onNewReply }) => {
  const [visible, setVisible] = useState(false);
  const [view, setView] = useState<ViewMode>('home');
  const [activeKerbal, setActiveKerbal] = useState<KerbalState | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSummoning, setIsSummoning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summonError, setSummonError] = useState<string | null>(null);
  const [settingsTick, setSettingsTick] = useState(0);
  const [keySavedFeedback, setKeySavedFeedback] = useState<string | null>(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeKerbalRef = useRef<KerbalState | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const wokenMapRef = useRef<Set<string>>(new Set());

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

  // Sync phone clock with system time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (mountedRef.current) {
        setCurrentTime(new Date());
      }
    }, 30000);
    return () => clearInterval(interval);
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
      setView('home');
      setActiveKerbal(null);
      setMessages([]);
      setInputValue('');
      setIsSummoning(false);
      setIsGenerating(false);
      setSummonError(null);
      wokenMapRef.current = new Set();
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
    // Resume idle banter when phone closes
    idleBanter.resume();
    setVisible(false);
  }, []);

  const handleExitComplete = useCallback(() => {
    if (!visible) {
      idleBanter.resume();
      onClose();
    }
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

    // ---- Off-shift: three-way status-based behavior ----
    if (isOffShift(status)) {
      // Check for on-break positions first — these are short breaks (lunch, bathroom, etc.)
      // where the kerbal is still on-premises. Instant response, no groggy, no fail roll.
      const breakPositions = ['lunch', 'bathroom', 'snack', 'break'];
      const isOnBreakPos = breakPositions.includes(currentKerbal.position);

      if (isOnBreakPos) {
        try {
          const soul: KerbalSoul = await getSoulCached(currentKerbal.name);
          const params = statsToApiParams(soul);

          const memoryCtx = KerbalMemory.buildMemoryContext(currentKerbal.name);
          const moodCtx = moodSystem.buildMoodPrompt(currentKerbal.name);
          const storyCtx = storyEngine.buildStoryPrompt(currentKerbal.name);
          const toolsCtx = buildToolsPrompt(soul.role);
          const narrativeRule = `IMPORTANT: You are a character in a real-time chat. Speak naturally and directly in first person. NEVER describe your own actions in third-person narrative style. Never write things like "[Name] crosses her arms" or "[Name] raises an eyebrow." Just speak as yourself — first person, natural conversation, as if you're in a chat room.`;

          const prefix = getWakePrefix(currentKerbal);

          const messages = [
            {
              role: 'system' as const,
              content: `${prefix}\n\n${soul.rawMarkdown}\n\n${moodCtx}\n\n${memoryCtx}\n\n${storyCtx}\n\n${toolsCtx}\n\n${narrativeRule}`,
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
            content: (result.reply && result.reply !== EMPTY_RESPONSE) ? result.reply : `*${currentKerbal.name} ${t('mc.aiUnavailable')}*`,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, kerbalMsg]);
          onNewReply?.(currentKerbal.name);

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

      // Determine which off-shift variant we're in
      const isAsleep = currentKerbal.position === 'offshift' && isNighttime();
      const isAtHome = currentKerbal.position === 'offshift' && !isNighttime();
      const isOtherOffShift = !isAsleep && !isAtHome;

      // --- Branch A: Asleep (offshift + nighttime) — full delay + irritated/slurred ---
      if (isAsleep) {
        setIsSummoning(true);

        const isWoken = wokenMapRef.current.has(currentKerbal.name);

        if (!isWoken) {
          // 30% chance of no response (deep asleep)
          if (Math.random() < 0.3) {
            setSummonError(t('mc.noResponse'));
            setIsSummoning(false);
            abortControllerRef.current = null;
            return;
          }

          // Simulate wake-up time: 5-10 seconds
          const wakeDelay = 5000 + Math.random() * 5000;
          await new Promise((resolve) => setTimeout(resolve, wakeDelay));

          if (controller.signal.aborted || !mountedRef.current) {
            abortControllerRef.current = null;
            return;
          }
        }

        try {
          const soul: KerbalSoul = await getSoulCached(currentKerbal.name);
          const params = statsToApiParams(soul);

          const memoryCtx = KerbalMemory.buildMemoryContext(currentKerbal.name);
          const moodCtx = moodSystem.buildMoodPrompt(currentKerbal.name);
          const storyCtx = storyEngine.buildStoryPrompt(currentKerbal.name);
          const toolsCtx = buildToolsPrompt(soul.role);
          const narrativeRule = `IMPORTANT: You are a character in a real-time chat. Speak naturally and directly in first person. NEVER describe your own actions in third-person narrative style. Never write things like "[Name] crosses her arms" or "[Name] raises an eyebrow." Just speak as yourself — first person, natural conversation, as if you're in a chat room.`;

          const prefix = isWoken ? t('wake.prefix.stillWaking') : t('wake.prefix.asleep');

          const messages = [
            {
              role: 'system' as const,
              content: `${prefix}\n\n${soul.rawMarkdown}\n\n${moodCtx}\n\n${memoryCtx}\n\n${storyCtx}\n\n${toolsCtx}\n\n${narrativeRule}`,
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

          wokenMapRef.current.add(currentKerbal.name);

          const kerbalMsg: ThreadMessage = {
            id: `msg-${Date.now()}-${currentKerbal.name}`,
            sender: currentKerbal.name,
            content: (result.reply && result.reply !== EMPTY_RESPONSE) ? result.reply : `*${currentKerbal.name} ${t('mc.mumbles')}*`,
            timestamp: Date.now(),
            isGroggy: true,
          };
          setMessages((prev) => [...prev, kerbalMsg]);
          onNewReply?.(currentKerbal.name);

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

      // --- Branch B: At home (offshift + daytime) — instant response, no groggy ---
      if (isAtHome) {
        try {
          const soul: KerbalSoul = await getSoulCached(currentKerbal.name);
          const params = statsToApiParams(soul);

          const memoryCtx = KerbalMemory.buildMemoryContext(currentKerbal.name);
          const moodCtx = moodSystem.buildMoodPrompt(currentKerbal.name);
          const storyCtx = storyEngine.buildStoryPrompt(currentKerbal.name);
          const toolsCtx = buildToolsPrompt(soul.role);
          const narrativeRule = `IMPORTANT: You are a character in a real-time chat. Speak naturally and directly in first person. NEVER describe your own actions in third-person narrative style. Never write things like "[Name] crosses her arms" or "[Name] raises an eyebrow." Just speak as yourself — first person, natural conversation, as if you're in a chat room.`;

          const prefix = t('wake.prefix.atHome');

          const messages = [
            {
              role: 'system' as const,
              content: `${prefix}\n\n${soul.rawMarkdown}\n\n${moodCtx}\n\n${memoryCtx}\n\n${storyCtx}\n\n${toolsCtx}\n\n${narrativeRule}`,
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
            content: (result.reply && result.reply !== EMPTY_RESPONSE) ? result.reply : `*${currentKerbal.name} ${t('mc.aiUnavailable')}*`,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, kerbalMsg]);
          onNewReply?.(currentKerbal.name);

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

      // --- Branch C: Other off-shift positions (entering, leaving, etc.) — original behavior ---
      if (isOtherOffShift) {
        setIsSummoning(true);

        const isWoken = wokenMapRef.current.has(currentKerbal.name);

        if (!isWoken) {
          if (Math.random() < 0.3) {
            setSummonError(t('mc.noResponse'));
            setIsSummoning(false);
            abortControllerRef.current = null;
            return;
          }

          const wakeDelay = 5000 + Math.random() * 5000;
          await new Promise((resolve) => setTimeout(resolve, wakeDelay));

          if (controller.signal.aborted || !mountedRef.current) {
            abortControllerRef.current = null;
            return;
          }
        }

        try {
          const soul: KerbalSoul = await getSoulCached(currentKerbal.name);
          const params = statsToApiParams(soul);

          const memoryCtx = KerbalMemory.buildMemoryContext(currentKerbal.name);
          const moodCtx = moodSystem.buildMoodPrompt(currentKerbal.name);
          const storyCtx = storyEngine.buildStoryPrompt(currentKerbal.name);
          const toolsCtx = buildToolsPrompt(soul.role);
          const narrativeRule = `IMPORTANT: You are a character in a real-time chat. Speak naturally and directly in first person. NEVER describe your own actions in third-person narrative style. Never write things like "[Name] crosses her arms" or "[Name] raises an eyebrow." Just speak as yourself — first person, natural conversation, as if you're in a chat room.`;

          const prefix = isWoken ? t('wake.prefix.stillWaking') : getWakePrefix(currentKerbal);

          const messages = [
            {
              role: 'system' as const,
              content: `${prefix}\n\n${soul.rawMarkdown}\n\n${moodCtx}\n\n${memoryCtx}\n\n${storyCtx}\n\n${toolsCtx}\n\n${narrativeRule}`,
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

          wokenMapRef.current.add(currentKerbal.name);

          const kerbalMsg: ThreadMessage = {
            id: `msg-${Date.now()}-${currentKerbal.name}`,
            sender: currentKerbal.name,
            content: (result.reply && result.reply !== EMPTY_RESPONSE) ? result.reply : `*${currentKerbal.name} ${t('mc.mumbles')}*`,
            timestamp: Date.now(),
            isGroggy: true,
          };
          setMessages((prev) => [...prev, kerbalMsg]);
          onNewReply?.(currentKerbal.name);

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
      const narrativeRule = `IMPORTANT: You are a character in a real-time chat. Speak naturally and directly in first person. NEVER describe your own actions in third-person narrative style. Never write things like "[Name] crosses her arms" or "[Name] raises an eyebrow." Just speak as yourself — first person, natural conversation, as if you're in a chat room.`;
      const bathroomCtx = currentKerbal.position === 'bathroom' ? getWakePrefix(currentKerbal) : '';
      const systemPrompt = [bathroomCtx, soul.rawMarkdown, moodCtx, memoryCtx, storyCtx, toolsCtx, narrativeRule].filter(Boolean).join('\n\n');

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
      onNewReply?.(currentKerbal.name);

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
      onNewReply?.(currentKerbal.name);
    } finally {
      if (mountedRef.current) setIsGenerating(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, []);

  const openThread = useCallback((kerbal: KerbalState) => {
    // Pause idle banter so it doesn't compete for AI calls while user is chatting
    idleBanter.pause();

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

  const backToHome = useCallback(() => {
    setView('home');
    setActiveKerbal(null);
    setMessages([]);
    setInputValue('');
    setIsSummoning(false);
    setIsGenerating(false);
    setSummonError(null);
    wokenMapRef.current = new Set();
  }, []);

  const backToContacts = useCallback(() => {
    // Resume idle banter now that we're leaving the thread
    idleBanter.resume();
    setView('contacts');
    setActiveKerbal(null);
    setMessages([]);
    setInputValue('');
    setIsSummoning(false);
    setIsGenerating(false);
    setSummonError(null);
    wokenMapRef.current = new Set();
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
            className="absolute right-6 bottom-0 w-[252px] h-[440px] bg-zinc-800 rounded-[3rem] border-[1.5px] border-zinc-500/25 shadow-2xl overflow-hidden flex flex-col"
            style={{
              boxShadow: '0 30px 80px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.06)',
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
        {/* Dynamic Island */}
        <div className="absolute top-[10px] left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="w-[88px] h-[22px] rounded-full bg-black flex items-center justify-end px-3 gap-1.5"
            style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.04)' }}>
            <div className="w-[7px] h-[7px] rounded-full bg-zinc-900 ring-[0.5px] ring-zinc-700/30" />
          </div>
        </div>

        {/* Screen — single scrollable surface, fully rounded inside */}
        <div className="flex-1 flex flex-col text-white rounded-[2.8rem] overflow-hidden px-3" style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #0d0d1a 100%)', margin: 2 }}>
          {/* Status bar — fresh rebuild */}
          <div className="shrink-0 w-full flex items-center justify-between text-[11px] text-zinc-300" style={{ padding: '26px 44px 6px 44px' }}>
            <span className="font-semibold tracking-wide">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <div className="flex items-center gap-1" />
          </div>

          {/* Header — context-aware back button */}
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
            ) : view === 'contacts' || view === 'settings' ? (
              <button
                type="button"
                className="text-blue-400 hover:text-blue-300 text-sm leading-none shrink-0 w-6 h-6 flex items-center justify-center"
                onClick={backToHome}
                aria-label="Back to Home"
              >
                &#8592;
              </button>
            ) : (
              <div className="w-6 shrink-0" />
            )}
            <h2 className="text-sm font-semibold flex-1 truncate text-center">
              {view === 'home' && 'KerbOffice'}
              {view === 'contacts' && t('mc.contacts')}
              {view === 'settings' && t('settings.title')}
              {view === 'thread' && (activeKerbal?.name ?? t('mc.chat'))}
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

          {/* Home indicator — small pill at bottom, like iPhone */}
          <div className="flex shrink-0 items-center justify-center py-2" style={{
            background: '#12121e',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div className="w-20 h-[5px] rounded-full bg-zinc-500/40" />
          </div>

          {/* Body area */}
          <div className="flex-1 flex flex-col min-h-0">
            {view === 'home' ? (
              /* --- Home screen with app icons --- */
              <div className="flex-1 flex flex-col items-center justify-center px-6" style={{
                background: 'linear-gradient(180deg, #0d0d1a 0%, #0a0a12 100%)',
              }}>
                {/* Time display */}
                <div className="text-white/60 text-[11px] mb-8 font-light tracking-wider">
                  {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>

                {/* App icon grid */}
                <div className="flex gap-6">
                  {/* Contacts app */}
                  <button
                    onClick={() => setView('contacts')}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <div className="w-14 h-14 rounded-[1.1rem] flex items-center justify-center transition-transform group-hover:scale-105 active:scale-95" style={{
                      background: 'linear-gradient(135deg, #1a73e8, #0d47a1)',
                      boxShadow: '0 4px 12px rgba(26,115,232,0.3)',
                    }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-medium">{t('phone.contacts')}</span>
                  </button>

                  {/* Settings app */}
                  <button
                    onClick={() => setView('settings')}
                    className="flex flex-col items-center gap-1.5 group"
                  >
                    <div className="w-14 h-14 rounded-[1.1rem] flex items-center justify-center transition-transform group-hover:scale-105 active:scale-95" style={{
                      background: 'linear-gradient(135deg, #6366f1, #3730a3)',
                      boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                    }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                      </svg>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-medium">{t('phone.settings')}</span>
                  </button>
                </div>
              </div>
            ) : view === 'contacts' ? (
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
                          {statusText(k, s)}
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
                      setKeySavedFeedback(null);
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
                    {/* Show all built-in providers + any configured plugin providers */}
                    {[...Object.keys(AI_PROVIDERS), ...getConfiguredProviders().filter(p => p.startsWith('plug_'))].map(p => (
                      <option key={p} value={p}>{resolveProviderConfig(p)?.label ?? p}</option>
                    ))}
                  </select>
                </div>

                {/* API Key Input */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, color: '#aaa', fontSize: 12 }}>
                    {t('settings.apiKeys')}
                  </label>
                  {getSelectedProvider() === 'ollama' ? (
                    <div style={{
                      padding: '6px 0', color: '#888', fontSize: 12, fontStyle: 'italic',
                    }}>
                      {t('settings.runsLocally')}
                    </div>
                  ) : getSelectedProvider().startsWith('plug_') ? null : (
                    <div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          key={getSelectedProvider()}
                          type="password"
                          defaultValue={getCustomApiKey(getSelectedProvider()) ?? ''}
                          onBlur={e => {
                            const val = e.target.value.trim();
                            if (val) {
                              setApiKey(getSelectedProvider(), val);
                              setKeySavedFeedback(t('settings.keySaved'));
                              setTimeout(() => setKeySavedFeedback(null), 2000);
                              handleSettingsChange();
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (val) {
                                setApiKey(getSelectedProvider(), val);
                                setKeySavedFeedback(t('settings.keySaved'));
                                setTimeout(() => setKeySavedFeedback(null), 2000);
                                handleSettingsChange();
                              }
                            }
                          }}
                          placeholder={t('common.placeholder')}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            background: '#1a1a2e',
                            color: '#fff',
                            border: '1px solid #333',
                            borderRadius: 4,
                            fontSize: 12,
                          }}
                        />
                        {keySavedFeedback && (
                          <span style={{
                            color: '#4caf50', fontSize: 11, whiteSpace: 'nowrap', fontWeight: 'bold',
                          }}>
                            {keySavedFeedback}
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>
                        {t('settings.apiKeysDesc')}
                      </div>
                    </div>
                  )}

                  {/* No-key warning for selected provider */}
                  {getSelectedProvider() !== 'ollama' && !getSelectedProvider().startsWith('plug_') && !getCustomApiKey(getSelectedProvider()) && (
                    <div style={{
                      marginTop: 6,
                      padding: '6px 8px',
                      background: 'rgba(255, 152, 0, 0.1)',
                      border: '1px solid rgba(255, 152, 0, 0.4)',
                      borderRadius: 4,
                      color: '#ffb74d',
                      fontSize: 11,
                      lineHeight: 1.4,
                    }}>
                      {t('settings.noKeyForSelected')}
                    </div>
                  )}
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

                {/* User Profile */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, color: '#aaa', fontSize: 12 }}>
                    About Me
                  </label>
                  <input
                    defaultValue={UserProfile.load().name}
                    placeholder="Your name (optional)"
                    onChange={(e) => {
                      const p = UserProfile.load();
                      p.name = e.target.value;
                      UserProfile.save(p);
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      background: '#1a1a2e',
                      color: '#fff',
                      border: '1px solid #333',
                      borderRadius: 4,
                      fontSize: 12,
                      marginBottom: 6,
                    }}
                  />
                  <input
                    defaultValue={UserProfile.load().description}
                    placeholder="A short note about you (optional)"
                    onChange={(e) => {
                      const p = UserProfile.load();
                      p.description = e.target.value;
                      UserProfile.save(p);
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
                <div className="flex-1 overflow-y-auto px-2 py-3 space-y-2 min-h-0 overscroll-contain [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-track]:bg-transparent">
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
                        className={`max-w-[85%] px-2.5 py-1.5 rounded-2xl text-xs leading-snug ${
                          msg.sender === 'user'
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : msg.isGroggy
                              ? 'bg-zinc-800 text-zinc-300 rounded-bl-md italic'
                              : 'bg-zinc-800 text-zinc-300 rounded-bl-md'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-all overflow-hidden">
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
                <div className="border-t border-zinc-800/60 px-2 py-1.5 flex gap-1.5 items-center shrink-0 overflow-hidden justify-center">
                  <input
                    ref={inputRef}
                    type="text"
                    className="w-[160px] shrink-0 bg-zinc-800 text-white text-xs rounded-full px-3 py-1.5 outline-none placeholder-zinc-500 focus:ring-1 focus:ring-inset focus:ring-blue-500"
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
                    style={{ boxSizing: 'border-box', maxWidth: '100%', minWidth: 0 }}
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
