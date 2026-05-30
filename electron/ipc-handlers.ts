import { ipcMain, app } from 'electron';
import fs from 'fs';
import path from 'path';

const AGENTS_DIR = path.join(app.getPath('userData'), 'agents_data');
const CONFIG_DIR = path.join(app.getPath('userData'), 'config');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// File operations
ipcMain.handle('file:read', (_event, filePath: string) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
});

ipcMain.handle('file:write', (_event, filePath: string, content: string) => {
  try {
    const dir = path.dirname(filePath);
    ensureDir(dir);
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('file:readDir', (_event, dirPath: string) => {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true }).map(d => ({
      name: d.name,
      isDirectory: d.isDirectory(),
    }));
  } catch {
    return [];
  }
});

// Agent data
ipcMain.handle('agent:getData', (_event, agentName: string) => {
  const agentDir = path.join(AGENTS_DIR, `agent_${agentName}`);
  ensureDir(agentDir);
  try {
    const soul = fs.readFileSync(path.join(agentDir, 'Soul.md'), 'utf-8');
    const memory = fs.readFileSync(path.join(agentDir, 'Memory.md'), 'utf-8');
    return { soul, memory };
  } catch {
    return { soul: '', memory: '' };
  }
});

ipcMain.handle('agent:saveData', (_event, agentName: string, data: { soul?: string; memory?: string }) => {
  const agentDir = path.join(AGENTS_DIR, `agent_${agentName}`);
  ensureDir(agentDir);
  try {
    if (data.soul !== undefined) fs.writeFileSync(path.join(agentDir, 'Soul.md'), data.soul, 'utf-8');
    if (data.memory !== undefined) fs.writeFileSync(path.join(agentDir, 'Memory.md'), data.memory, 'utf-8');
    return true;
  } catch {
    return false;
  }
});

// LLM config
ipcMain.handle('config:getLLM', () => {
  ensureDir(CONFIG_DIR);
  const configPath = path.join(CONFIG_DIR, 'llm-config.json');
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return { defaultProvider: 'openai', providers: {} };
  }
});

ipcMain.handle('config:setLLM', (_event, config: any) => {
  ensureDir(CONFIG_DIR);
  fs.writeFileSync(path.join(CONFIG_DIR, 'llm-config.json'), JSON.stringify(config, null, 2), 'utf-8');
  return true;
});

// App version
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});
