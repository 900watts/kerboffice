import { ipcMain, app } from 'electron';
import fs from 'fs';
import path from 'path';

// DIAGNOSTIC: confirm IPC handler module loaded
console.log('[ipc-handlers] module loaded');

// DIAGNOSTIC: mirror to log file
const logFile = path.join(app.getPath('userData'), 'main.log');
function mainLog(...args: any[]) {
  const line = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}\n`;
  try { fs.appendFileSync(logFile, line); } catch {}
  console.log(...args);
}
mainLog('[ipc-handlers] module loaded');

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

// Binary file write (for docx and other binary outputs)
ipcMain.handle('file:writeBinary', (_event, filePath: string, base64Content: string) => {
  try {
    const dir = path.dirname(filePath);
    ensureDir(dir);
    const buffer = Buffer.from(base64Content, 'base64');
    fs.writeFileSync(filePath, buffer);
    return true;
  } catch {
    return false;
  }
});

// Default documents directory for kerbal-generated files
ipcMain.handle('app:getDefaultDocsDir', () => {
  return path.join(app.getPath('documents'), 'KerbOffice_Reports');
});

// ---------------------------------------------------------------------------
// Kerbal soul loader — reads bundled .md files from the asar.
// Renderer-side `fetch('/kerbal-souls/foo.md')` fails on file:// origin in the
// packaged EXE, so we expose this through IPC.
// ---------------------------------------------------------------------------
ipcMain.handle('kerbal-soul:read', (_event, name: string): string | null => {
  try {
    // dist-electron/main.js sits in app.asar/dist-electron/, souls live at
    // app.asar/dist/kerbal-souls/{name}.md
    const soulPath = path.join(__dirname, '..', 'dist', 'kerbal-souls', `${encodeURIComponent(name)}.md`);
    mainLog('[kerbal-soul:read]', name, '| path:', soulPath);
    const content = fs.readFileSync(soulPath, 'utf-8');
    mainLog('[kerbal-soul:read] OK,', content.length, 'bytes');
    return content;
  } catch (err: any) {
    mainLog('[kerbal-soul:read] FAILED for', name, ':', err?.message ?? err);
    return null;
  }
});

// ---------------------------------------------------------------------------
// AI fetch proxy — routes HTTP requests through the main process
// to bypass file:// origin restrictions on fetch() in the renderer.
// ---------------------------------------------------------------------------

interface AiFetchParams {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

interface AiFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  body: string;
}

ipcMain.handle('ai:fetch', async (_event, params: AiFetchParams): Promise<AiFetchResult> => {
  // DIAGNOSTIC: log every IPC fetch call
  mainLog('[main ai:fetch]', params.method, params.url, '| body len:', (params.body ?? '').length);
  try {
    const response = await fetch(params.url, {
      method: params.method,
      headers: params.headers,
      body: params.body ?? undefined,
    });
    const body = await response.text();
    mainLog('[main ai:fetch] OK status', response.status, '| body len:', body.length);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      body,
    };
  } catch (err: any) {
    mainLog('[main ai:fetch] FAILED:', err?.message ?? err);
    return {
      ok: false,
      status: 0,
      statusText: err?.message ?? String(err),
      body: '',
    };
  }
});
