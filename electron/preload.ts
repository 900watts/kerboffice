import { contextBridge, ipcRenderer } from 'electron';

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

  // App info
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
});
