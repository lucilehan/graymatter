import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Memory, BrainRegion, MemoryStats, MemoryState } from './types';

const VALID_REGIONS = new Set<BrainRegion>(['frontal','temporal','parietal','occipital','cerebellum','limbic']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeMemory(m: Memory): Memory | null {
  if (!m.id || !UUID_RE.test(m.id)) { return null; }
  if (!m.content || typeof m.content !== 'string') { return null; }
  const region: BrainRegion = VALID_REGIONS.has(m.region as BrainRegion) ? m.region : 'parietal';
  return {
    ...m,
    id: m.id,
    content: String(m.content).slice(0, 10000),
    summary: String(m.summary || m.content).slice(0, 500),
    region,
    tags: Array.isArray(m.tags) ? m.tags.filter(t => typeof t === 'string').slice(0, 20) : [],
    importance: Math.max(0, Math.min(1, Number(m.importance) || 0.5)),
  };
}

/**
 * Persistent memory store.
 * Saves memories as JSON in the workspace's `.claude-brain/` directory
 * or a user-configured path.
 */
export class MemoryStore {
  private memories = new Map<string, Memory>();
  private storagePath: string;

  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.storagePath = this.resolveStoragePath();
    this.load();
  }

  private resolveStoragePath(): string {
    const config = vscode.workspace.getConfiguration('claudeBrain');
    const custom = config.get<string>('storagePath');
    if (custom && custom.trim()) {
      return custom;
    }
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (ws) {
      return path.join(ws, '.claude-brain');
    }
    return path.join(this.context.globalStorageUri.fsPath, 'claude-brain');
  }

  private get filePath(): string {
    return path.join(this.storagePath, 'memories.json');
  }

  // ── External sync ─────────────────────────────────────

  getStoragePath(): string { return this.storagePath; }

  reload(): void {
    this.load();
    this._onDidChange.fire();
  }

  // ── CRUD ──────────────────────────────────────────────

  add(memory: Memory): void {
    this.memories.set(memory.id, memory);
    this.save();
    this._onDidChange.fire();
  }

  get(id: string): Memory | undefined {
    return this.memories.get(id);
  }

  getAll(): Memory[] {
    return Array.from(this.memories.values())
      .sort((a, b) => b.importance - a.importance);
  }

  getByRegion(region: BrainRegion): Memory[] {
    return this.getAll().filter(m => m.region === region);
  }

  update(id: string, patch: Partial<Memory>): Memory | undefined {
    const existing = this.memories.get(id);
    if (!existing) { return undefined; }
    const updated: Memory = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.memories.set(id, updated);
    this.save();
    this._onDidChange.fire();
    return updated;
  }

  delete(id: string): boolean {
    const deleted = this.memories.delete(id);
    if (deleted) {
      this.save();
      this._onDidChange.fire();
    }
    return deleted;
  }

  clearAll(): void {
    this.memories.clear();
    this.save();
    this._onDidChange.fire();
  }

  // ── Stats ─────────────────────────────────────────────

  getStats(): MemoryStats {
    const all = this.getAll();
    const byRegion: Record<BrainRegion, number> = {
      frontal: 0, temporal: 0, parietal: 0,
      occipital: 0, cerebellum: 0, limbic: 0
    };
    let totalImportance = 0;
    let oldest: string | null = null;
    let newest: string | null = null;

    for (const m of all) {
      byRegion[m.region]++;
      totalImportance += m.importance;
      if (!oldest || m.createdAt < oldest) { oldest = m.createdAt; }
      if (!newest || m.createdAt > newest) { newest = m.createdAt; }
    }

    return {
      totalMemories: all.length,
      byRegion,
      averageImportance: all.length ? totalImportance / all.length : 0,
      oldestMemory: oldest,
      newestMemory: newest
    };
  }

  getState(): MemoryState {
    return {
      memories: this.getAll(),
      stats: this.getStats(),
      lastUpdated: new Date().toISOString()
    };
  }

  // ── Persistence ───────────────────────────────────────

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data: Memory[] = JSON.parse(raw);
        this.memories.clear();
        for (const m of data) {
          const clean = sanitizeMemory(m);
          if (clean) { this.memories.set(clean.id, clean); }
        }
      }
    } catch (err) {
      console.error('[GrayMatter] Failed to load memories:', err);
    }
  }

  private save(): void {
    try {
      if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(this.storagePath, { recursive: true });
      }
      const data = Array.from(this.memories.values());
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[GrayMatter] Failed to save memories:', err);
      vscode.window.showErrorMessage('GrayMatter: Failed to save memories.');
    }
  }

  // ── Import / Export ───────────────────────────────────

  exportToJSON(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }

  /** Import from GrayMatter's own JSON export format. */
  importFromJSON(json: string): number {
    const data: Memory[] = JSON.parse(json);
    let count = 0;
    for (const m of data) {
      const clean = sanitizeMemory(m);
      if (clean) {
        this.memories.set(clean.id, clean);
        count++;
      }
    }
    this.save();
    this._onDidChange.fire();
    return count;
  }

  /**
   * Bulk-add pre-built Memory objects (used by the markdown import flow).
   * Fires a single change event after all are added.
   */
  importMemories(items: Memory[]): number {
    for (const m of items) {
      this.memories.set(m.id, m);
    }
    if (items.length > 0) {
      this.save();
      this._onDidChange.fire();
    }
    return items.length;
  }
}
