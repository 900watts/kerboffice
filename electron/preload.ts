import { contextBridge, ipcRenderer } from 'electron';

// DIAGNOSTIC: log when preload script runs
console.log('[preload] KSC preload script loaded');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
  readDir: (path: string) => ipcRenderer.invoke('file:readDir', path),

  // Agent data
  getAgentData: (agentName: string) => ipcRenderer.invoke('agent:getData', agentName),
  saveAgentData: (agentName: string, data: any) => ipcRenderer.invoke('agent:saveData', agentName),

  // LLM config
  getLLMConfig: () => ipcRenderer.invoke('config:getLLM'),
  setLLMConfig: (config: any) => ipcRenderer.invoke('config:setLLM', config),

  // Binary file write (for docx and other binary outputs)
  saveDocx: (base64Content: string, filePath: string) =>
    ipcRenderer.invoke('file:writeBinary', filePath, base64Content),

  // Default documents directory
  getDefaultDocsDir: () => ipcRenderer.invoke('app:getDefaultDocsDir'),

  // App info
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  // AI fetch proxy — routes external API requests through the main process
  aiFetch: (params: { method: string; url: string; headers: Record<string, string>; body?: string }) =>
    ipcRenderer.invoke('ai:fetch', params),

  // Kerbal soul loader — reads bundled .md files from the asar
  // (renderer-side fetch('/kerbal-souls/foo.md') fails on file:// origin in EXE)
  readKerbalSoul: (name: string) => ipcRenderer.invoke('kerbal-soul:read', name),
});
