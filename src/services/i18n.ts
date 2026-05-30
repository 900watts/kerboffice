/**
 * i18n — Lightweight internationalization for KSC Mission Control.
 * Supports English (en), Chinese (zh), and Japanese (ja).
 * Uses React context for reactive language switching via useSyncExternalStore.
 *
 * This is the SINGLE source of truth for all UI translations.
 * All components should import `t` or `useT` from this module.
 */

import { useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Language = 'en' | 'zh' | 'ja';

export type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string;

// ---------------------------------------------------------------------------
// Translation map
// ---------------------------------------------------------------------------

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'nav.available': 'Available',
    'nav.installed': 'Installed',
    'nav.downloads': 'Downloads',
    'nav.instances': 'Instances',
    'nav.settings': 'Settings',
    'nav.aiAssistant': 'AI Assistant',
    'nav.collapse': 'Collapse',
    'nav.expand': 'Expand',
    'nav.modsLoaded': '{count} mods loaded',
    'nav.loadingRegistry': 'Loading registry\u2026',
    'nav.installed.count': '{count} installed',
    'nav.missionControl': 'Mission Control',

    // Settings
    'settings.title': 'Settings',
    'settings.account': 'Account',
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme',
    'settings.darkMode': 'Dark mode active',
    'settings.lightMode': 'Light mode active',
    'settings.dark': 'Dark Mode',
    'settings.light': 'Light Mode',
    'settings.aiAssistant': 'AI Assistant',
    'settings.model': 'Model',
    'settings.usageLimits': 'Usage Limits',
    'settings.usageDesc': 'Free: 20 requests/day | Paid: Unlimited (1 point/request)',
    'settings.paidTier': 'Paid Tier',
    'settings.comingSoon': 'Coming soon \u2014 credits system in development',
    'settings.apiKeys': 'AI API Keys',
    'settings.apiKeysDesc': 'Connect your own API keys to use custom AI providers. Keys are stored locally in your browser.',
    'settings.runsLocally': 'Runs locally \u2014 no API key needed',
    'settings.keySaved': 'Key saved',
    'settings.missionChatter': 'Mission Control Chatter',
    'settings.missionChatterOn': "Kerbals chat with each other when you're idle",
    'settings.missionChatterOff': 'Kerbals only respond when you message them',
    'settings.chatterDisclaimer': "Kerbals will autonomously chat with each other when you're idle. This consumes AI API calls. Disable anytime if you prefer kerbals only respond when spoken to.",
    'settings.kerbalModel': 'Kerbal Chat Model',
    'settings.kerbalModelDesc': 'Specific AI model for kerbals. Leave empty for system default.',
    'settings.kerbalModelExample': 'Example: kimi-k2.6:cloud',
    'settings.registry': 'CKAN Registry',
    'settings.language': 'Language',
    'settings.languageDesc': 'Interface display language',
    'settings.signInPrompt': 'Sign in to CKAN',
    'settings.signInPromptDesc': 'Sync mods and AI points across devices',
    'settings.authSuccess': 'Account created! Check your email inbox and click the verification link to activate your account.',
    'settings.repository': 'Repository',
    'settings.repositoryDesc': 'master \u2014 github.com/KSP-CKAN/CKAN-meta',
    'settings.manage': 'Manage',

    // Mission Control
    'mc.loading': 'Loading Kerbal souls...',
    'mc.dayShift': 'Day shift arriving (06:00). Kerbals taking their stations.',
    'mc.nightShift': 'Night shift arriving (18:00). Night crew on duty.',
    'mc.noKerbals': 'No Kerbals are currently on shift. Wait for a shift change or check the roster.',
    'mc.signalLost': 'Signal lost -- the Kerbals could not respond. Check the comms link.',
    'mc.emptyChat': 'Mission Control Communications',
    'mc.emptyChatDesc': 'The crew is standing by. Send a message to get started -- the right Kerbal will pick it up.',
    'mc.inputPlaceholder': 'Send a message to Mission Control...',
    'mc.waitingPlaceholder': 'Waiting for the crew to respond...',
    'mc.pressEnter': 'Press Enter to send',
    'mc.kerbalsOnShift': 'Kerbal(s) on shift',
    'mc.contacts': 'Contacts',
    'mc.startConversation': 'Start a conversation with',
    'mc.messageThem': 'Message',
    'mc.typing': 'is typing...',
    'mc.thinking': 'is thinking...',
    'mc.waking': 'Waking',
    'mc.noResponse': 'No response. They must be deep asleep.',
    'mc.mumbles': 'mumbles sleepily',
    'mc.stares': 'stares at the screen blankly',
    'mc.awayBathroom': "is away from their desk (bathroom break). They'll respond when they return.",
    'mc.awayLunch': "is away from their desk (lunch break). They'll respond when they return.",
    'mc.openPhone': 'Open Smartphone',
    'mc.offShiftPhone': '{name} is off-shift right now.',
    'mc.offShiftPhoneHint': 'Use the phone to call off-shift Kerbals.',
    'mc.usePhone': 'Use Phone',
    'mc.phoneHint': 'Open phone',
    'mc.clearChat': 'Clear',
    'mc.clearHistory': 'Clear chat history',
    'mc.aiUnavailable': 'seems distracted... (AI unavailable -- check API key in Settings)',
    'mc.kerbalCantRespond': "{name} couldn't respond -- check AI settings.",
    'mc.messageInput': 'Message input',
    'mc.sendMessage': 'Send message',
    'mc.sendHint': 'Send message (Enter)',
    'mc.backToContacts': 'Back to contacts',
    'mc.cancel': 'Cancel',
    'mc.close': 'Close',
    'mc.chat': 'Chat',

    // Kerbal positions
    'status.onShift': 'On shift',
    'status.onBreak': 'On break',
    'status.offShift': 'Off shift',

    // Banter tags
    'banter.tag': 'banter',
    'route.broadcast': 'to crew',
    'route.chimed': 'chimed in',
    'route.mentioned': 'mentioned',
    'route.checkin': 'check-in',

    // Time of day
    'time.earlyMorning': 'early morning',
    'time.morning': 'morning',
    'time.earlyAfternoon': 'early afternoon',
    'time.afternoon': 'afternoon',
    'time.evening': 'evening',
    'time.night': 'night',
    'time.lateNight': 'late night',
    'time.preDawn': 'pre-dawn',
    'time.middleOfNight': 'middle of the night',

    // AI Chat actions
    'ai.action.install': 'Install {modId}',
    'ai.action.uninstall': 'Uninstall {modId}',
    'ai.action.search': 'Search: {query}',
    'ai.action.refreshRepo': 'Refresh Repository',
    'ai.welcome': "Hi! I'm your KSC AI assistant. I can help you find mods, explain dependencies, and recommend mod packs.\n\nConfigure your API key in Settings to start chatting.",

    // Banter fallback templates
    'banter.fallback.initiator.0': 'Did you hear about "{context}"? That\'s wild.',
    'banter.fallback.initiator.1': '{context} \u2014 I have *thoughts* about this one.',
    'banter.fallback.initiator.2': '{context}? Honestly...',
    'banter.fallback.initiator.3': 'Oh, you\'re not going to believe what I heard about "{context}".',
    'banter.fallback.responder.0': 'Oh, definitely! I completely agree.',
    'banter.fallback.responder.1': 'Hmm, I see your point but I\'m not so sure...',
    'banter.fallback.responder.2': 'That\'s exactly what I was thinking.',
    'banter.fallback.responder.3': 'Wait, really? Tell me more.',
    'banter.fallback.responder.4': 'I have a story about this actually.',

    // Common
    'common.unknownError': 'Unknown error',
    'common.on': 'ON',
    'common.off': 'OFF',
    'common.save': 'Save',
    'common.clear': 'Clear',
    'common.cancel': 'Cancel',
    'common.signIn': 'Sign In',
    'common.signOut': 'Sign Out',
    'common.signUp': 'Sign Up',
    'common.soon': 'SOON',
    'common.free': 'FREE',
    'common.auto': 'Auto',
    'common.placeholder': 'Paste API key...',
    'common.search': 'Search',
    'common.signInEmail': 'Sign In with Email',
    'common.createAccount': 'Create Account',
    'common.email': 'Email',
    'common.password': 'Password',
    'common.close': 'Close',
    'common.saved': 'Saved!',
    'common.tags': 'Tags',
    'common.links': 'Links',
    'common.add': 'Add',
    'common.remove': 'Remove',
    'common.delete': 'Delete',

    // Plugin / custom API provider
    'plugin.title': 'API Plugins',
    'plugin.noPlugins': 'No plugins registered. Add your first API provider above.',
    'plugin.name': 'Name',
    'plugin.baseUrl': 'Base URL',
    'plugin.apiKey': 'API Key',
    'plugin.models': 'Models',
    'plugin.allowCustom': 'Allow custom model names',
    'plugin.test': 'Test',
    'plugin.testOk': 'OK \u2014 {count} model(s)',
    'plugin.testFail': 'Connection failed',
    'plugin.addPlugin': 'Add Plugin',
    'plugin.errNameRequired': 'Name is required',
    'plugin.errUrlRequired': 'Base URL is required',
    'plugin.errKeyRequired': 'API key is required',
    'plugin.errCreate': 'Failed to create plugin',

    // Phone settings (provider, model, language)
    'settings.provider': 'AI Provider',
    'settings.providerDesc': 'Select the AI provider for chat conversations',
    'settings.modelLabel': 'Chat Model',
    'settings.modelDesc': 'Select or type a model name',

    // Shift Config (Kerbal)
    'shift.assignments': 'Shift Assignments',
    'shift.assignDesc': 'Assign Kerbals to day or night shifts. Click a Kerbal to move them between shifts.',
    'shift.dayShift': 'Day Shift (06:00 \u2013 18:00)',
    'shift.nightShift': 'Night Shift (18:00 \u2013 06:00)',
    'shift.noAssigned': 'No Kerbals assigned',
    'shift.kerbonaut': 'Kerbonaut',
    'shift.saveChanges': 'Save Changes',
    'shift.saved': 'Saved!',
    'shift.resetDefaults': 'Reset to Defaults',
    'shift.idleBanter': 'Idle Banter',
    'shift.enableIdle': 'Enable idle Kerbal conversations',
    'shift.enableIdleDesc': 'Kerbals will chat among themselves when the player is inactive.',
    'shift.idleDelay': 'Idle delay',
    'shift.minutes': '{n} minutes',
    'shift.frequency': 'Conversation frequency',
    'shift.occasional': 'Occasional',
    'shift.chatty': 'Chatty',
    'shift.tokenWarning': 'Idle conversations consume API tokens. Disable to save.',
    'shift.noResponse': 'No response.',

    // Room Canvas
    'room.title': 'KSC  MISSION  CONTROL',
    'room.statusOk': 'ALL SYSTEMS NOMINAL',
    'room.dayShift': 'DAY SHIFT',
    'room.nightShift': 'NIGHT SHIFT',
    'room.crew': '{count} crew',
    'room.coffee': 'COFFEE',
  },

  zh: {
    // Navigation
    'nav.available': '\u53EF\u7528\u6A21\u7EC4',
    'nav.installed': '\u5DF2\u5B89\u88C5',
    'nav.downloads': '\u4E0B\u8F7D',
    'nav.instances': '\u6E38\u620F\u5B9E\u4F8B',
    'nav.settings': '\u8BBE\u7F6E',
    'nav.aiAssistant': 'AI \u52A9\u624B',
    'nav.collapse': '\u6536\u8D77',
    'nav.expand': '\u5C55\u5F00',
    'nav.modsLoaded': '\u5DF2\u52A0\u8F7D {count} \u4E2A\u6A21\u7EC4',
    'nav.loadingRegistry': '\u6B63\u5728\u52A0\u8F7D\u6CE8\u518C\u8868\u2026',
    'nav.installed.count': '\u5DF2\u5B89\u88C5 {count} \u4E2A',
    'nav.missionControl': '\u4EFB\u52A1\u63A7\u5236\u4E2D\u5FC3',

    // Settings
    'settings.title': '\u8BBE\u7F6E',
    'settings.account': '\u8D26\u6237',
    'settings.appearance': '\u5916\u89C2',
    'settings.theme': '\u4E3B\u9898',
    'settings.darkMode': '\u6DF1\u8272\u6A21\u5F0F\u5DF2\u5F00\u542F',
    'settings.lightMode': '\u6D45\u8272\u6A21\u5F0F\u5DF2\u5F00\u542F',
    'settings.dark': '\u6DF1\u8272\u6A21\u5F0F',
    'settings.light': '\u6D45\u8272\u6A21\u5F0F',
    'settings.aiAssistant': 'AI \u52A9\u624B',
    'settings.model': '\u6A21\u578B',
    'settings.usageLimits': '\u4F7F\u7528\u9650\u5236',
    'settings.usageDesc': '\u514D\u8D39\uFF1A20\u6B21/\u5929 | \u4ED8\u8D39\uFF1A\u65E0\u9650\uFF081\u79EF\u5206/\u6B21\uFF09',
    'settings.paidTier': '\u4ED8\u8D39\u5957\u9910',
    'settings.comingSoon': '\u5373\u5C06\u63A8\u51FA \u2014 \u79EF\u5206\u7CFB\u7EDF\u5F00\u53D1\u4E2D',
    'settings.apiKeys': 'AI API \u5BC6\u94A5',
    'settings.apiKeysDesc': '\u8FDE\u63A5\u4F60\u81EA\u5DF1\u7684 API \u5BC6\u94A5\u4EE5\u4F7F\u7528\u81EA\u5B9A\u4E49 AI \u63D0\u4F9B\u5546\u3002\u5BC6\u94A5\u4EC5\u5B58\u50A8\u5728\u672C\u5730\u6D4F\u89C8\u5668\u4E2D\u3002',
    'settings.runsLocally': '\u672C\u5730\u8FD0\u884C \u2014 \u65E0\u9700 API \u5BC6\u94A5',
    'settings.keySaved': '\u5BC6\u94A5\u5DF2\u4FDD\u5B58',
    'settings.missionChatter': '\u4EFB\u52A1\u63A7\u5236\u4E2D\u5FC3\u95F2\u804A',
    'settings.missionChatterOn': '\u7A7A\u95F2\u65F6 Kerbal \u4F1A\u81EA\u52A8\u804A\u5929',
    'settings.missionChatterOff': 'Kerbal \u4EC5\u5728\u60A8\u53D1\u9001\u6D88\u606F\u65F6\u56DE\u590D',
    'settings.chatterDisclaimer': 'Kerbal \u4F1A\u5728\u60A8\u7A7A\u95F2\u65F6\u81EA\u4E3B\u804A\u5929\u3002\u8FD9\u4F1A\u6D88\u8017 AI API \u8C03\u7528\u6B21\u6570\u3002\u5982\u679C\u4E0D\u5E0C\u671B Kerbal \u4E3B\u52A8\u804A\u5929\uFF0C\u53EF\u968F\u65F6\u7981\u7528\u3002',
    'settings.kerbalModel': 'Kerbal \u804A\u5929\u6A21\u578B',
    'settings.kerbalModelDesc': '\u4E3A Kerbal \u6307\u5B9A\u7684 AI \u6A21\u578B\u3002\u7559\u7A7A\u5219\u4F7F\u7528\u7CFB\u7EDF\u9ED8\u8BA4\u3002',
    'settings.kerbalModelExample': '\u793A\u4F8B\uFF1Akimi-k2.6:cloud',
    'settings.registry': 'CKAN \u6CE8\u518C\u8868',
    'settings.language': '\u8BED\u8A00',
    'settings.languageDesc': '\u754C\u9762\u663E\u793A\u8BED\u8A00',
    'settings.signInPrompt': '\u767B\u5F55 CKAN',
    'settings.signInPromptDesc': '\u8DE8\u8BBE\u5907\u540C\u6B65\u6A21\u7EC4\u548C AI \u79EF\u5206',
    'settings.authSuccess': '\u8D26\u6237\u5DF2\u521B\u5EFA\uFF01\u8BF7\u68C0\u67E5\u90AE\u7BB1\u6536\u4EF6\u7BB1\uFF0C\u70B9\u51FB\u9A8C\u8BC1\u94FE\u63A5\u6FC0\u6D3B\u8D26\u6237\u3002',
    'settings.repository': '\u4ED3\u5E93',
    'settings.repositoryDesc': 'master \u2014 github.com/KSP-CKAN/CKAN-meta',
    'settings.manage': '\u7BA1\u7406',

    // Mission Control
    'mc.loading': '\u6B63\u5728\u52A0\u8F7D Kerbal \u7075\u9B42...',
    'mc.dayShift': '\u767D\u73ED\u5230\u5C97 (06:00)\u3002Kerbal \u6B63\u5728\u5C31\u4F4D\u3002',
    'mc.nightShift': '\u591C\u73ED\u5230\u5C97 (18:00)\u3002\u591C\u73ED\u4EBA\u5458\u5DF2\u5C31\u4F4D\u3002',
    'mc.noKerbals': '\u5F53\u524D\u6CA1\u6709 Kerbal \u503C\u73ED\u3002\u7B49\u5F85\u6362\u73ED\u6216\u67E5\u770B\u6392\u73ED\u8868\u3002',
    'mc.signalLost': '\u4FE1\u53F7\u4E22\u5931 -- Kerbal \u65E0\u6CD5\u56DE\u5E94\u3002\u8BF7\u68C0\u67E5\u901A\u8BAF\u94FE\u8DEF\u3002',
    'mc.emptyChat': '\u4EFB\u52A1\u63A7\u5236\u4E2D\u5FC3\u901A\u8BAF',
    'mc.emptyChatDesc': '\u5168\u4F53\u4EBA\u5458\u5F85\u547D\u4E2D\u3002\u53D1\u9001\u6D88\u606F\u5F00\u59CB \u2014 \u5408\u9002\u7684 Kerbal \u4F1A\u81EA\u52A8\u63A5\u542C\u3002',
    'mc.inputPlaceholder': '\u5411\u4EFB\u52A1\u63A7\u5236\u4E2D\u5FC3\u53D1\u9001\u6D88\u606F...',
    'mc.waitingPlaceholder': '\u7B49\u5F85\u4EBA\u5458\u56DE\u590D...',
    'mc.pressEnter': '\u6309 Enter \u53D1\u9001',
    'mc.kerbalsOnShift': '\u4EBA\u5728\u503C\u73ED',
    'mc.contacts': '\u8054\u7CFB\u4EBA',
    'mc.startConversation': '\u5F00\u59CB\u5BF9\u8BDD',
    'mc.messageThem': '\u53D1\u9001\u6D88\u606F',
    'mc.typing': '\u6B63\u5728\u8F93\u5165...',
    'mc.thinking': '\u6B63\u5728\u601D\u8003...',
    'mc.waking': '\u6B63\u5728\u5524\u9192',
    'mc.noResponse': '\u65E0\u54CD\u5E94\u3002\u4ED6\u4EEC\u53EF\u80FD\u7761\u5F97\u5F88\u6C89\u3002',
    'mc.mumbles': '\u8FF7\u8FF7\u7CCA\u7CCA\u5730\u5495\u5631\u7740',
    'mc.stares': '\u832B\u7136\u5730\u76EF\u7740\u5C4F\u5E55',
    'mc.awayBathroom': '\u4E0D\u5728\u5DE5\u4F4D\uFF08\u4E0A\u53A0\u6240\u53BB\u4E86\uFF09\u3002\u56DE\u6765\u540E\u4F1A\u56DE\u590D\u3002',
    'mc.awayLunch': '\u4E0D\u5728\u5DE5\u4F4D\uFF08\u5403\u5348\u996D\u53BB\u4E86\uFF09\u3002\u56DE\u6765\u540E\u4F1A\u56DE\u590D\u3002',
    'mc.openPhone': '\u6253\u5F00\u5BF9\u8BB2\u673A',
    'mc.offShiftPhone': '{name} \u73B0\u5728\u4E0D\u5728\u503C\u73ED\u3002',
    'mc.offShiftPhoneHint': '\u4F7F\u7528\u5BF9\u8BB2\u673A\u8054\u7CFB\u4E0D\u5728\u503C\u73ED\u7684 Kerbal\u3002',
    'mc.usePhone': '\u4F7F\u7528\u5BF9\u8BB2\u673A',
    'mc.phoneHint': '\u6253\u5F00\u5BF9\u8BB2\u673A',
    'mc.clearChat': '\u6E05\u9664',
    'mc.clearHistory': '\u6E05\u9664\u804A\u5929\u8BB0\u5F55',
    'mc.aiUnavailable': '\u4F3C\u4E4E\u8D70\u795E\u4E86...\uFF08AI \u4E0D\u53EF\u7528 -- \u8BF7\u5728\u8BBE\u7F6E\u4E2D\u68C0\u67E5 API \u5BC6\u94A5\uFF09',
    'mc.kerbalCantRespond': '{name} \u65E0\u6CD5\u56DE\u590D -- \u8BF7\u68C0\u67E5 AI \u8BBE\u7F6E\u3002',
    'mc.messageInput': '\u6D88\u606F\u8F93\u5165',
    'mc.sendMessage': '\u53D1\u9001\u6D88\u606F',
    'mc.sendHint': '\u53D1\u9001\u6D88\u606F (Enter)',
    'mc.backToContacts': '\u8FD4\u56DE\u8054\u7CFB\u4EBA',
    'mc.cancel': '\u53D6\u6D88',
    'mc.close': '\u5173\u95ED',
    'mc.chat': '\u804A\u5929',

    // Kerbal positions
    'status.onShift': '\u503C\u73ED\u4E2D',
    'status.onBreak': '\u4F11\u606F\u4E2D',
    'status.offShift': '\u672A\u503C\u73ED',

    // Banter tags
    'banter.tag': '\u95F2\u804A',
    'route.broadcast': '\u5168\u5458',
    'route.chimed': '\u63D2\u8BDD',
    'route.mentioned': '\u88AB\u63D0\u53CA',
    'route.checkin': '\u4E3B\u52A8\u95EE\u5019',

    // Time of day
    'time.earlyMorning': '\u6E05\u6668',
    'time.morning': '\u4E0A\u5348',
    'time.earlyAfternoon': '\u5348\u540E',
    'time.afternoon': '\u4E0B\u5348',
    'time.evening': '\u508D\u665A',
    'time.night': '\u665A\u4E0A',
    'time.lateNight': '\u6DF1\u591C',
    'time.preDawn': '\u9ECE\u660E\u524D',
    'time.middleOfNight': '\u5348\u591C',

    // AI Chat actions
    'ai.action.install': '\u5B89\u88C5 {modId}',
    'ai.action.uninstall': '\u5378\u8F7D {modId}',
    'ai.action.search': '\u641C\u7D22\uFF1A{query}',
    'ai.action.refreshRepo': '\u5237\u65B0\u4ED3\u5E93',
    'ai.welcome': '\u4F60\u597D\uFF01\u6211\u662F\u4F60\u7684 KSC AI \u52A9\u624B\u3002\u6211\u53EF\u4EE5\u5E2E\u4F60\u5BFB\u627E\u6A21\u7EC4\u3001\u89E3\u91CA\u4F9D\u8D56\u5173\u7CFB\uFF0C\u5E76\u63A8\u8350\u6A21\u7EC4\u7EC4\u5408\u3002\n\n\u914D\u7F6E\u4F60\u7684 API \u5BC6\u94A5\u540E\u5373\u53EF\u5F00\u59CB\u804A\u5929\u3002',

    // Banter fallback templates
    'banter.fallback.initiator.0': '\u4F60\u542C\u8BF4"{context}"\u4E86\u5417\uFF1F\u592A\u75AF\u72C2\u4E86\u3002',
    'banter.fallback.initiator.1': '{context} \u2014 \u6211\u5BF9\u6B64*\u6709\u60F3\u6CD5*\u3002',
    'banter.fallback.initiator.2': '{context}\uFF1F\u8BF4\u5B9E\u8BDD\u2026\u2026',
    'banter.fallback.initiator.3': '\u54E6\uFF0C\u4F60\u4E0D\u4F1A\u76F8\u4FE1\u6211\u542C\u5230\u7684\u5173\u4E8E"{context}"\u7684\u4E8B\u3002',
    'banter.fallback.responder.0': '\u54E6\uFF0C\u5F53\u7136\uFF01\u6211\u5B8C\u5168\u540C\u610F\u3002',
    'banter.fallback.responder.1': '\u55EF\uFF0C\u6211\u7406\u89E3\u4F60\u7684\u89C2\u70B9\uFF0C\u4F46\u6211\u4E0D\u592A\u786E\u5B9A\u2026\u2026',
    'banter.fallback.responder.2': '\u8FD9\u6B63\u662F\u6211\u7684\u60F3\u6CD5\u3002',
    'banter.fallback.responder.3': '\u7B49\u7B49\uFF0C\u771F\u7684\u5417\uFF1F\u5FEB\u544A\u8BC9\u6211\u66F4\u591A\u3002',
    'banter.fallback.responder.4': '\u5176\u5B9E\u6211\u8FD9\u65B9\u9762\u6709\u4E2A\u6545\u4E8B\u3002',

    // Common
    'common.unknownError': '\u672A\u77E5\u9519\u8BEF',
    'common.on': '\u5F00',
    'common.off': '\u5173',
    'common.save': '\u4FDD\u5B58',
    'common.clear': '\u6E05\u9664',
    'common.cancel': '\u53D6\u6D88',
    'common.signIn': '\u767B\u5F55',
    'common.signOut': '\u9000\u51FA',
    'common.signUp': '\u6CE8\u518C',
    'common.soon': '\u5373\u5C06',
    'common.free': '\u514D\u8D39',
    'common.auto': '\u81EA\u52A8',
    'common.placeholder': '\u7C98\u8D34 API \u5BC6\u94A5...',
    'common.search': '\u641C\u7D22',
    'common.signInEmail': '\u4F7F\u7528\u90AE\u7BB1\u767B\u5F55',
    'common.createAccount': '\u521B\u5EFA\u8D26\u6237',
    'common.email': '\u90AE\u7BB1',
    'common.password': '\u5BC6\u7801',
    'common.close': '\u5173\u95ED',
    'common.saved': '\u5DF2\u4FDD\u5B58\uFF01',
    'common.tags': '\u6807\u7B7E',
    'common.links': '\u94FE\u63A5',
    'common.add': '\u6DFB\u52A0',
    'common.remove': '\u79FB\u9664',
    'common.delete': '\u5220\u9664',

    // Plugin / custom API provider
    'plugin.title': 'API \u63D2\u4EF6',
    'plugin.noPlugins': '\u5C1A\u65E0\u63D2\u4EF6\u6CE8\u518C\u3002\u8BF7\u5728\u4E0A\u65B9\u6DFB\u52A0\u4F60\u7684\u7B2C\u4E00\u4E2A API \u63D0\u4F9B\u5546\u3002',
    'plugin.name': '\u540D\u79F0',
    'plugin.baseUrl': '\u57FA\u7840 URL',
    'plugin.apiKey': 'API \u5BC6\u94A5',
    'plugin.models': '\u6A21\u578B',
    'plugin.allowCustom': '\u5141\u8BB8\u81EA\u5B9A\u4E49\u6A21\u578B\u540D\u79F0',
    'plugin.test': '\u6D4B\u8BD5',
    'plugin.testOk': '\u6B63\u5E38 \u2014 {count} \u4E2A\u6A21\u578B',
    'plugin.testFail': '\u8FDE\u63A5\u5931\u8D25',
    'plugin.addPlugin': '\u6DFB\u52A0\u63D2\u4EF6',
    'plugin.errNameRequired': '\u8BF7\u8F93\u5165\u540D\u79F0',
    'plugin.errUrlRequired': '\u8BF7\u8F93\u5165\u57FA\u7840 URL',
    'plugin.errKeyRequired': '\u8BF7\u8F93\u5165 API \u5BC6\u94A5',
    'plugin.errCreate': '\u521B\u5EFA\u63D2\u4EF6\u5931\u8D25',

    // Phone settings (provider, model, language)
    'settings.provider': 'AI \u63D0\u4F9B\u5546',
    'settings.providerDesc': '\u9009\u62E9\u804A\u5929\u4F7F\u7528\u7684 AI \u63D0\u4F9B\u5546',
    'settings.modelLabel': '\u804A\u5929\u6A21\u578B',
    'settings.modelDesc': '\u9009\u62E9\u6216\u8F93\u5165\u6A21\u578B\u540D\u79F0',

    // Shift Config (Kerbal)
    'shift.assignments': '\u6392\u73ED\u5B89\u6392',
    'shift.assignDesc': '\u5C06 Kerbal \u5206\u914D\u5230\u767D\u73ED\u6216\u591C\u73ED\u3002\u70B9\u51FB Kerbal \u53EF\u5728\u4E24\u73ED\u4E4B\u95F4\u79FB\u52A8\u3002',
    'shift.dayShift': '\u767D\u73ED (06:00 \u2013 18:00)',
    'shift.nightShift': '\u591C\u73ED (18:00 \u2013 06:00)',
    'shift.noAssigned': '\u672A\u5206\u914D Kerbal',
    'shift.kerbonaut': '\u822A\u5929\u5458',
    'shift.saveChanges': '\u4FDD\u5B58\u66F4\u6539',
    'shift.saved': '\u5DF2\u4FDD\u5B58\uFF01',
    'shift.resetDefaults': '\u6062\u590D\u9ED8\u8BA4',
    'shift.idleBanter': '\u7A7A\u95F2\u95F2\u804A',
    'shift.enableIdle': '\u542F\u7528 Kerbal \u7A7A\u95F2\u5BF9\u8BDD',
    'shift.enableIdleDesc': '\u73A9\u5BB6\u4E0D\u6D3B\u8DC3\u65F6\uFF0CKerbal \u4F1A\u4E92\u76F8\u804A\u5929\u3002',
    'shift.idleDelay': '\u7A7A\u95F2\u7B49\u5F85\u65F6\u95F4',
    'shift.minutes': '{n} \u5206\u949F',
    'shift.frequency': '\u5BF9\u8BDD\u9891\u7387',
    'shift.occasional': '\u5076\u5C14',
    'shift.chatty': '\u9891\u7E41',
    'shift.tokenWarning': '\u7A7A\u95F2\u5BF9\u8BDD\u4F1A\u6D88\u8017 API \u989D\u5EA6\u3002\u5173\u95ED\u53EF\u8282\u7701\u7528\u91CF\u3002',
    'shift.noResponse': '\u65E0\u54CD\u5E94\u3002',

    // Room Canvas
    'room.title': 'KSC \u4EFB\u52A1\u63A7\u5236\u4E2D\u5FC3',
    'room.statusOk': '\u6240\u6709\u7CFB\u7EDF\u6B63\u5E38',
    'room.dayShift': '\u767D\u73ED',
    'room.nightShift': '\u591C\u73ED',
    'room.crew': '{count} \u540D\u4EBA\u5458',
    'room.coffee': '\u5496\u5561',
  },

  ja: {
    // Navigation
    'nav.available': '\u5229\u7528\u53EF\u80FD',
    'nav.installed': '\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u6E08\u307F',
    'nav.downloads': '\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9',
    'nav.instances': '\u30A4\u30F3\u30B9\u30BF\u30F3\u30B9',
    'nav.settings': '\u8A2D\u5B9A',
    'nav.aiAssistant': 'AI \u30A2\u30B7\u30B9\u30BF\u30F3\u30C8',
    'nav.collapse': '\u9589\u3058\u308B',
    'nav.expand': '\u5C55\u958B',
    'nav.modsLoaded': '{count} \u30E2\u30C3\u30C9\u304C\u8AAD\u307F\u8FBC\u307F\u6E08\u307F',
    'nav.loadingRegistry': '\u30EC\u30B8\u30B9\u30C8\u30EA\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026',
    'nav.installed.count': '{count} \u500B\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u6E08\u307F',
    'nav.missionControl': '\u30DF\u30C3\u30B7\u30E7\u30F3\u30B3\u30F3\u30C8\u30ED\u30FC\u30EB',

    // Settings
    'settings.title': '\u8A2D\u5B9A',
    'settings.account': '\u30A2\u30AB\u30A6\u30F3\u30C8',
    'settings.appearance': '\u5916\u89B3',
    'settings.theme': '\u30C6\u30FC\u30DE',
    'settings.darkMode': '\u30C0\u30FC\u30AF\u30E2\u30FC\u30C9\u304C\u6709\u52B9\u3067\u3059',
    'settings.lightMode': '\u30E9\u30A4\u30C8\u30E2\u30FC\u30C9\u304C\u6709\u52B9\u3067\u3059',
    'settings.dark': '\u30C0\u30FC\u30AF\u30E2\u30FC\u30C9',
    'settings.light': '\u30E9\u30A4\u30C8\u30E2\u30FC\u30C9',
    'settings.aiAssistant': 'AI \u30A2\u30B7\u30B9\u30BF\u30F3\u30C8',
    'settings.model': '\u30E2\u30C7\u30EB',
    'settings.usageLimits': '\u4F7F\u7528\u5236\u9650',
    'settings.usageDesc': '\u30D5\u30EA\u30FC: 20\u56DE/\u65E5 | \u6709\u6599: \u5236\u9650\u306A\u3057 (1\u30DD\u30A4\u30F3\u30C8/\u56DE)',
    'settings.paidTier': '\u6709\u6599\u30D4\u30A2',
    'settings.comingSoon': '\u4ECA\u5F8C\u63D0\u4F9B\u4E88\u5B9A \u2014 \u30AF\u30EC\u30B8\u30C3\u30C8\u30B7\u30B9\u30C6\u30E0\u3092\u958B\u767A\u4E2D',
    'settings.apiKeys': 'AI API \u30AD\u30FC',
    'settings.apiKeysDesc': '\u72EC\u81EA\u306E API \u30AD\u30FC\u3092\u9023\u7D61\u3057\u3066\u3001\u30AB\u30B9\u30BF\u30E0 AI \u30D7\u30ED\u30D0\u30A4\u30C0\u3092\u4F7F\u7528\u3002\u30AD\u30FC\u306F\u30D6\u30E9\u30A6\u30B6\u306B\u4FDD\u5B58\u3055\u308C\u307E\u3059\u3002',
    'settings.runsLocally': '\u30ED\u30FC\u30AB\u30EB\u5B9F\u884C \u2014 API \u30AD\u30FC\u4E0D\u8981',
    'settings.keySaved': '\u30AD\u30FC\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F',
    'settings.missionChatter': '\u30DF\u30C3\u30B7\u30E7\u30F3\u30B3\u30F3\u30C8\u30ED\u30FC\u30EB\u306E\u4F11\u61A9\u8A71',
    'settings.missionChatterOn': '\u975E\u64CD\u4F5C\u6642\u306B Kerbal \u304C\u4E92\u3044\u306B\u30C1\u30E3\u30C3\u30C8\u3059\u308B',
    'settings.missionChatterOff': '\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u9001\u3063\u305F\u6642\u306E\u307F Kerbal \u304C\u53CD\u5FDC\u3059\u308B',
    'settings.chatterDisclaimer': 'Kerbal \u306F\u975E\u64CD\u4F5C\u6642\u306B\u81EA\u5206\u3067\u30C1\u30E3\u30C3\u30C8\u3057\u307E\u3059\u3002\u3053\u308C\u306B\u3088\u308A AI API \u3092\u6D88\u8CBB\u3057\u307E\u3059\u3002\u5FC5\u8981\u306A\u3044\u5834\u5408\u306F\u7121\u52B9\u306B\u3059\u308B\u3053\u3068\u304C\u3067\u304D\u307E\u3059\u3002',
    'settings.kerbalModel': 'Kerbal \u30C1\u30E3\u30C3\u30C8\u30E2\u30C7\u30EB',
    'settings.kerbalModelDesc': 'Kerbal \u7528\u306E\u7279\u5B9A AI \u30E2\u30C7\u30EB\u3002\u7A7A\u767D\u306E\u5834\u5408\u306F\u30B7\u30B9\u30C6\u30E0\u306E\u30C7\u30D5\u30A9\u30EB\u30C8\u304C\u4F7F\u7528\u3055\u308C\u307E\u3059\u3002',
    'settings.kerbalModelExample': '\u4F8B: kimi-k2.6:cloud',
    'settings.registry': 'CKAN \u30EC\u30B8\u30B9\u30C8\u30EA',
    'settings.language': '\u8A00\u8A9E',
    'settings.languageDesc': '\u8868\u793A\u8A00\u8A9E\u306E\u5207\u308A\u66FF\u3048',
    'settings.signInPrompt': 'CKAN \u306B\u30B5\u30A4\u30F3\u30A4\u30F3',
    'settings.signInPromptDesc': '\u30E2\u30C3\u30C9\u3084 AI \u30DD\u30A4\u30F3\u30C8\u3092\u30C7\u30D0\u30A4\u30B9\u9593\u3067\u540C\u671F\u3059\u308B',
    'settings.authSuccess': '\u30A2\u30AB\u30A6\u30F3\u30C8\u304C\u4F5C\u6210\u3055\u308C\u307E\u3057\u305F\uFF01\u4FBF\u7D19\u7BB1\u3092\u78BA\u8A8D\u3057\u3001\u8A8D\u8A3C\u30EA\u30F3\u30AF\u3092\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u30A2\u30AB\u30A6\u30F3\u30C8\u3092\u6709\u52B9\u5316\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    'settings.repository': '\u30EA\u30DD\u30B8\u30C8\u30EA',
    'settings.repositoryDesc': 'master \u2014 github.com/KSP-CKAN/CKAN-meta',
    'settings.manage': '\u7BA1\u7406',

    // Mission Control
    'mc.loading': 'Kerbal \u30BD\u30A6\u30EB\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D...',
    'mc.dayShift': '\u663C\u52E4\u304C\u4E57\u308A\u8FBC\u3093\u3067\u304D\u307E\u3057\u305F (06:00)\u3002Kerbal \u304C\u5F53\u756A\u306B\u3064\u304D\u307E\u3059\u3002',
    'mc.nightShift': '\u591C\u52E4\u304C\u4E57\u308A\u8FBC\u3093\u3067\u304D\u307E\u3057\u305F (18:00)\u3002\u591C\u52E4\u30AF\u30EB\u30FC\u304C\u62C5\u5F53\u3067\u3059\u3002',
    'mc.noKerbals': '\u73FE\u5728\u5F53\u756A\u306E Kerbal \u306F\u3044\u307E\u305B\u3093\u3002\u5F85\u6A5F\u30FB\u30B7\u30D5\u30C8\u5909\u66F4\u3092\u304A\u5F85\u3061\u304F\u3060\u3055\u3044\u3002',
    'mc.signalLost': '\u4FE1\u53F7\u304C\u5207\u308C\u307E\u3057\u305F -- Kerbal \u304C\u53CD\u5FDC\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002',
    'mc.emptyChat': '\u30DF\u30C3\u30B7\u30E7\u30F3\u30B3\u30F3\u30C8\u30ED\u30FC\u30EB\u901A\u4FE1',
    'mc.emptyChatDesc': '\u30AF\u30EB\u30FC\u306F\u5F85\u6A5F\u4E2D\u3067\u3059\u3002\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u9001\u4FE1\u3059\u308B\u3068\u9002\u5207\u306A Kerbal \u304C\u5FDC\u7B54\u3057\u307E\u3059\u3002',
    'mc.inputPlaceholder': '\u30DF\u30C3\u30B7\u30E7\u30F3\u30B3\u30F3\u30C8\u30ED\u30FC\u30EB\u306B\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u9001\u4FE1...',
    'mc.waitingPlaceholder': '\u30AF\u30EB\u30FC\u306E\u53CD\u5FDC\u3092\u5F85\u3063\u3066\u3044\u307E\u3059...',
    'mc.pressEnter': 'Enter \u30AD\u30FC\u3067\u9001\u4FE1',
    'mc.kerbalsOnShift': '\u9023\u306E Kerbal',
    'mc.contacts': '\u9023\u7D61\u5148',
    'mc.startConversation': '\u4F1A\u8A71\u3092\u958B\u59CB',
    'mc.messageThem': '\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u9001\u308B',
    'mc.typing': '\u5165\u529B\u4E2D...',
    'mc.thinking': '\u8003\u3048\u4E2D...',
    'mc.waking': '\u8D77\u3053\u3057\u4E2D',
    'mc.noResponse': '\u53CD\u5FDC\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u5BDD\u3066\u3044\u308B\u3088\u3046\u3067\u3059\u3002',
    'mc.mumbles': '\u306D\u307C\u3063\u3066\u3044\u307E\u3059',
    'mc.stares': '\u305B\u3093\u3058\u308A\u3068\u5C4F\u5E55\u3092\u898B\u3066\u3044\u307E\u3059',
    'mc.awayBathroom': '\u5E2D\u3092\u5916\u3057\u3066\u3044\u307E\u3059\u3002\u623B\u3063\u3066\u304D\u305F\u3089\u5FDC\u7B54\u3057\u307E\u3059\u3002',
    'mc.awayLunch': '\u5E2D\u3092\u5916\u3057\u3066\u3044\u307E\u3059\u3002\u623B\u3063\u3066\u304D\u305F\u3089\u5FDC\u7B54\u3057\u307E\u3059\u3002',
    'mc.openPhone': '\u30B9\u30DE\u30FC\u30C8\u30D5\u30A9\u30F3\u3092\u958B\u304F',
    'mc.offShiftPhone': '{name} \u306F\u73FE\u5728\u975E\u52E4\u5F53\u3067\u3059\u3002',
    'mc.offShiftPhoneHint': '\u975E\u52E4\u5F53\u306E Kerbal \u306B\u9023\u7D61\u3059\u308B\u306B\u306F\u30B9\u30DE\u30FC\u30C8\u30D5\u30A9\u30F3\u3092\u4F7F\u7528\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    'mc.usePhone': '\u30B9\u30DE\u30FC\u30C8\u30D5\u30A9\u30F3\u3092\u4F7F\u3046',
    'mc.phoneHint': '\u30B9\u30DE\u30FC\u30C8\u30D5\u30A9\u30F3\u3092\u958B\u304F',
    'mc.clearChat': '\u30AF\u30EA\u30A2',
    'mc.clearHistory': '\u30C1\u30E3\u30C3\u30C8\u5C65\u6B74\u3092\u30AF\u30EA\u30A2',
    'mc.aiUnavailable': 'AI \u3092\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093 -- \u8A2D\u5B9A\u3067 API \u30AD\u30FC\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044',
    'mc.kerbalCantRespond': '{name} \u304C\u53CD\u5FDC\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F -- AI \u8A2D\u5B9A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    'mc.messageInput': '\u30E1\u30C3\u30BB\u30FC\u30B8\u5165\u529B',
    'mc.sendMessage': '\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u9001\u4FE1',
    'mc.sendHint': '\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u9001\u4FE1 (Enter)',
    'mc.backToContacts': '\u9023\u7D61\u5148\u306B\u623B\u308B',
    'mc.cancel': '\u30AD\u30E3\u30F3\u30BB\u30EB',
    'mc.close': '\u9589\u3058\u308B',
    'mc.chat': '\u30C1\u30E3\u30C3\u30C8',

    // Kerbal positions
    'status.onShift': '\u52E4\u52D9\u4E2D',
    'status.onBreak': '\u4F11\u61A9\u4E2D',
    'status.offShift': '\u975E\u52E4\u5F53',

    // Banter tags
    'banter.tag': '\u4F11\u61A9\u8A71',
    'route.broadcast': '\u5168\u54E1\u3078',
    'route.chimed': '\u53E3\u3092\u633F\u3093\u3060',
    'route.mentioned': '\u8A00\u53CA\u3055\u308C\u305F',
    'route.checkin': '\u554F\u3044\u5408\u308F\u305B',

    // Time of day
    'time.earlyMorning': '\u671D\u65E9\u304F',
    'time.morning': '\u671D',
    'time.earlyAfternoon': '\u663C\u524D',
    'time.afternoon': '\u5348\u5F8C',
    'time.evening': '\u5915\u65B9',
    'time.night': '\u591C',
    'time.lateNight': '\u6DF1\u591C',
    'time.preDawn': '\u671D\u65B9\u3051',
    'time.middleOfNight': '\u771F\u591C\u4E2D',

    // AI Chat actions
    'ai.action.install': '{modId} \u3092\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB',
    'ai.action.uninstall': '{modId} \u3092\u30A2\u30F3\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB',
    'ai.action.search': '\u691C\u7D22: {query}',
    'ai.action.refreshRepo': '\u30EA\u30DD\u30B8\u30C8\u30EA\u3092\u66F4\u65B0',
    'ai.welcome': '\u3053\u3093\u306B\u3061\u306F\u3001KSC AI \u30A2\u30B7\u30B9\u30BF\u30F3\u30C8\u3067\u3059\u3002\u30E2\u30C3\u30C9\u306E\u691C\u7D22\u3001\u4F9D\u5B58\u95A2\u4FC2\u306E\u8AAC\u660E\u3001\u304A\u3059\u3059\u3081\u30E2\u30C3\u30C9\u306E\u63D0\u6848\u304C\u3067\u304D\u307E\u3059\u3002\n\n\u8A2D\u5B9A\u3067 API \u30AD\u30FC\u3092\u8A2D\u5B9A\u3059\u308B\u3068\u3001\u30C1\u30E3\u30C3\u30C8\u304C\u59CB\u3081\u3089\u308C\u307E\u3059\u3002',

    // Banter fallback templates
    'banter.fallback.initiator.0': '\u300C{context}\u300D\u306B\u3064\u3044\u3066\u805E\u3044\u305F\uFF1F\u3059\u3054\u3044\u3088\u306D\u3002',
    'banter.fallback.initiator.1': '{context} \u2014 \u3053\u308C\u306B\u306F*\u610F\u898B*\u304C\u3042\u308B\u3093\u3060\u3051\u3069\u306A\u3002',
    'banter.fallback.initiator.2': '{context}\uFF1F\u307E\u3042\u3001\u30CD\u2026\u2026',
    'banter.fallback.initiator.3': '\u3044\u3084\u3001\u300C{context}\u300D\u306B\u3064\u3044\u3066\u805E\u3044\u305F\u3093\u3060\u3051\u3069\u3001\u7D20\u6674\u3089\u3057\u3044\u3088\u3002',
    'banter.fallback.responder.0': '\u3042\u3001\u305D\u308C\u306F\u5F7B\u5E95\u540C\u610F\uFF01',
    'banter.fallback.responder.1': '\u3046\u3093\u3001\u305D\u306E\u610F\u898B\u3082\u308F\u304B\u308B\u3051\u3069\u3001\u306A\u3093\u3060\u304B\u306A\u3041\u2026\u2026',
    'banter.fallback.responder.2': '\u305D\u3063\u304F\u308A\u3001\u308F\u305F\u3057\u3082\u305D\u3046\u601D\u3063\u3066\u305F\u3002',
    'banter.fallback.responder.3': '\u3048\u3001\u307E\u3058\u3067\uFF1F\u3082\u3063\u3068\u805E\u304B\u305B\u3066\u3002',
    'banter.fallback.responder.4': '\u3053\u308C\u306B\u95A2\u3057\u3066\u306F\u3001\u30A8\u30D4\u30BD\u30FC\u30C9\u304C\u3042\u308B\u3093\u3060\u3088\u306A\u3002',

    // Common
    'common.unknownError': '\u4E0D\u660E\u306A\u30A8\u30E9\u30FC',
    'common.on': 'ON',
    'common.off': 'OFF',
    'common.save': '\u4FDD\u5B58',
    'common.clear': '\u30AF\u30EA\u30A2',
    'common.cancel': '\u30AD\u30E3\u30F3\u30BB\u30EB',
    'common.signIn': '\u30B5\u30A4\u30F3\u30A4\u30F3',
    'common.signOut': '\u30B5\u30A4\u30F3\u30A2\u30A6\u30C8',
    'common.signUp': '\u65B0\u898F\u767B\u9332',
    'common.soon': '\u4ECA\u5F8C',
    'common.free': '\u7121\u6599',
    'common.auto': '\u81EA\u52D5',
    'common.placeholder': 'API \u30AD\u30FC\u3092\u8CBC\u308A\u4ED8\u3051\u2026',
    'common.search': '\u691C\u7D22',
    'common.signInEmail': '\u30E1\u30FC\u30EB\u3067\u30B5\u30A4\u30F3\u30A4\u30F3',
    'common.createAccount': '\u30A2\u30AB\u30A6\u30F3\u30C8\u4F5C\u6210',
    'common.email': '\u30E1\u30FC\u30EB',
    'common.password': '\u30D1\u30B9\u30EF\u30FC\u30C9',
    'common.close': '\u9589\u3058\u308B',
    'common.saved': '\u4FDD\u5B58\u3057\u307E\u3057\u305F\uFF01',
    'common.tags': '\u30BF\u30B0',
    'common.links': '\u30EA\u30F3\u30AF',
    'common.add': '\u8FFD\u52A0',
    'common.remove': '\u524A\u9664',
    'common.delete': '\u524A\u53BB',

    // Plugin / custom API provider
    'plugin.title': 'API \u30D7\u30E9\u30B0\u30A4\u30F3',
    'plugin.noPlugins': '\u30D7\u30E9\u30B0\u30A4\u30F3\u304C\u767B\u9332\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u4E0A\u8A18\u306E\u30D5\u30A9\u30FC\u30E0\u3067\u6700\u521D\u306E API \u30D7\u30ED\u30D0\u30A4\u30C0\u3092\u8FFD\u52A0\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    'plugin.name': '\u540D\u524D',
    'plugin.baseUrl': '\u30D9\u30FC\u30B9 URL',
    'plugin.apiKey': 'API \u30AD\u30FC',
    'plugin.models': '\u30E2\u30C7\u30EB',
    'plugin.allowCustom': '\u30AB\u30B9\u30BF\u30E0\u30E2\u30C7\u30EB\u540D\u3092\u8A31\u53EF\u3059\u308B',
    'plugin.test': '\u30C6\u30B9\u30C8',
    'plugin.testOk': 'OK \u2014 {count} \u30E2\u30C7\u30EB',
    'plugin.testFail': '\u63A5\u7D9A\u306B\u5931\u6557\u3057\u307E\u3057\u305F',
    'plugin.addPlugin': '\u30D7\u30E9\u30B0\u30A4\u30F3\u3092\u8FFD\u52A0',
    'plugin.errNameRequired': '\u540D\u524D\u306F\u5FC5\u9808\u3067\u3059',
    'plugin.errUrlRequired': '\u30D9\u30FC\u30B9 URL \u306F\u5FC5\u9808\u3067\u3059',
    'plugin.errKeyRequired': 'API \u30AD\u30FC\u306F\u5FC5\u9808\u3067\u3059',
    'plugin.errCreate': '\u30D7\u30E9\u30B0\u30A4\u30F3\u306E\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F',

    // Phone settings (provider, model, language)
    'settings.provider': 'AI \u30D7\u30ED\u30D0\u30A4\u30C0',
    'settings.providerDesc': '\u30C1\u30E3\u30C3\u30C8\u3067\u4F7F\u7528\u3059\u308B AI \u30D7\u30ED\u30D0\u30A4\u30C0\u3092\u9078\u629E',
    'settings.modelLabel': '\u30C1\u30E3\u30C3\u30C8\u30E2\u30C7\u30EB',
    'settings.modelDesc': '\u30E2\u30C7\u30EB\u540D\u3092\u9078\u629E\u307E\u305F\u306F\u5165\u529B',

    // Shift Config (Kerbal)
    'shift.assignments': '\u30B7\u30D5\u30C8\u5272\u308A\u5F53\u3066',
    'shift.assignDesc': 'Kerbal \u3092\u663C\u52E4\u307E\u305F\u306F\u591C\u52E4\u306B\u5272\u308A\u5F53\u3066\u307E\u3059\u3002Kerbal \u3092\u30AF\u30EA\u30C3\u30AF\u3059\u308B\u3068\u30B7\u30D5\u30C8\u9593\u3067\u79FB\u52D5\u3067\u304D\u307E\u3059\u3002',
    'shift.dayShift': '\u663C\u52E4 (06:00 \u2013 18:00)',
    'shift.nightShift': '\u591C\u52E4 (18:00 \u2013 06:00)',
    'shift.noAssigned': '\u5272\u308A\u5F53\u3066\u3089\u308C\u3066\u3044\u306A\u3044 Kerbal',
    'shift.kerbonaut': 'Kerbonaut',
    'shift.saveChanges': '\u5909\u66F4\u3092\u4FDD\u5B58',
    'shift.saved': '\u4FDD\u5B58\u3057\u307E\u3057\u305F\uFF01',
    'shift.resetDefaults': '\u30C7\u30D5\u30A9\u30EB\u30C8\u306B\u623B\u3059',
    'shift.idleBanter': '\u4F11\u61A9\u6642\u306E\u96D1\u8AC7',
    'shift.enableIdle': 'Kerbal \u306E\u975E\u64CD\u4F5C\u6642\u30C1\u30E3\u30C3\u30C8\u3092\u6709\u52B9\u306B\u3059\u308B',
    'shift.enableIdleDesc': '\u30D7\u30EC\u30A4\u30E4\u30FC\u304C\u975E\u6D3B\u52D5\u306E\u5834\u5408\u3001Kerbal \u306F\u4E92\u3044\u306B\u30C1\u30E3\u30C3\u30C8\u3057\u307E\u3059\u3002',
    'shift.idleDelay': '\u975E\u6D3B\u52D5\u5F85\u6A5F\u6642\u9593',
    'shift.minutes': '{n} \u5206',
    'shift.frequency': '\u4F1A\u8A71\u306E\u983B\u5EA6',
    'shift.occasional': '\u3068\u304D\u3069\u304D',
    'shift.chatty': '\u3088\u304F\u8A71\u3059',
    'shift.tokenWarning': '\u975E\u64CD\u4F5C\u6642\u306E\u4F1A\u8A71\u306F API \u30C8\u30FC\u30AF\u30F3\u3092\u6D88\u8CBB\u3057\u307E\u3059\u3002\u7BC0\u7D04\u3059\u308B\u306B\u306F\u7121\u52B9\u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
    'shift.noResponse': '\u53CD\u5FDC\u304C\u3042\u308A\u307E\u305B\u3093\u3002',

    // Room Canvas
    'room.title': 'KSC  \u30DF\u30C3\u30B7\u30E7\u30F3  \u30B3\u30F3\u30C8\u30ED\u30FC\u30EB',
    'room.statusOk': '\u5168\u30B7\u30B9\u30C6\u30E0\u9806\u8ABF\u3067\u3059',
    'room.dayShift': '\u663C\u52E4',
    'room.nightShift': '\u591C\u52E4',
    'room.crew': '{count} \u540D',
    'room.coffee': '\u30B3\u30FC\u30D2\u30FC',
  },
};

// ---------------------------------------------------------------------------
// Store (reactive language state)
// ---------------------------------------------------------------------------

type Listener = () => void;

let currentLang: Language = 'en';
const listeners = new Set<Listener>();

function getStoredLang(): Language {
  try {
    const saved = localStorage.getItem('ksc_language');
    if (saved === 'zh') return 'zh';
    if (saved === 'ja') return 'ja';
  } catch (error) {
    console.warn('Failed to read language from localStorage:', error);
  }
  return 'en';
}

currentLang = getStoredLang();

function emitChange() {
  for (const fn of listeners) fn();
}

/** Translate with parameter interpolation. Falls back to English, then raw key. */
function translate(key: string, params?: Record<string, string | number>): string {
  let value =
    translations[currentLang]?.[key] ??
    translations.en[key] ??
    key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, String(v));
    }
  }

  return value;
}

/** Extract a human-readable message from an unknown error value. */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : translate('common.unknownError');
}

/** The exported t function \u2014 works outside React. */
export const t: TranslateFn = translate;

export function getLanguage(): Language {
  return currentLang;
}

export function setLanguage(lang: Language): void {
  if (lang === currentLang) return;
  currentLang = lang;
  try {
    localStorage.setItem('ksc_language', lang);
  } catch (error) {
    console.warn('Failed to save language to localStorage:', error);
  }
  emitChange();
}

export function subscribe(callback: Listener): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** i18n service object for compat with code that imports `i18n` */
export const i18n = {
  get language(): Language {
    return currentLang;
  },
  t: translate,
  setLanguage(lang: Language) {
    setLanguage(lang);
  },
  subscribe(callback: Listener) {
    return subscribe(callback);
  },
};

// ---------------------------------------------------------------------------
// React hook \u2014 reactive via useSyncExternalStore
// ---------------------------------------------------------------------------

function getSnapshot(): Language {
  return currentLang;
}

function getServerSnapshot(): Language {
  return 'en';
}

export function useT(): { t: TranslateFn; lang: Language } {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { t: translate, lang: currentLang };
}
