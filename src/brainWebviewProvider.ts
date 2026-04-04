import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { MemoryStore } from './memoryStore';
import { ClaudeService } from './claudeService';
import { Memory } from './types';
import { RoleConfig, getRoleById, DEFAULT_ROLE_ID } from './roles';
import { parseMarkdownFile } from './markdownImporter';

export class BrainWebviewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'claudeBrain.brainView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly store: MemoryStore,
    private readonly claude: ClaudeService,
    private readonly globalState: vscode.Memento
  ) {
    store.onDidChange(() => this.sendState());
  }

  private getRole(): RoleConfig {
    const id = this.globalState.get<string>('graymatter.roleId') ?? DEFAULT_ROLE_ID;
    return getRoleById(id) ?? getRoleById(DEFAULT_ROLE_ID)!;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'requestDelete': {
          const mem = this.store.get(msg.id);
          if (mem) {
            const choice = await vscode.window.showWarningMessage(
              `Delete memory: "${mem.summary}"?`,
              { modal: true },
              'Delete'
            );
            if (choice === 'Delete') {
              this.store.delete(msg.id);
              this.postMessage({ type: 'memoryDeleted', id: msg.id });
            }
          }
          break;
        }
        case 'requestRegionMemories': {
          this.postMessage({ type: 'regionSelected', region: msg.region });
          break;
        }
        case 'requestStats': {
          this.postMessage({ type: 'statsUpdate', stats: this.store.getStats() });
          break;
        }
        case 'setRole': {
          if (!msg.roleId) { break; }
          await this.globalState.update('graymatter.roleId', msg.roleId);
          this.sendState();
          break;
        }
        case 'addMemory': {
          if (!msg.content?.trim()) { break; }
          const role = this.getRole();
          const categorized = await this.claude.categorize(msg.content.trim(), role.categorizationHint);
          const now = new Date().toISOString();
          const memory: Memory = {
            id: crypto.randomUUID(),
            content: msg.content.trim(),
            summary: categorized.summary,
            region: categorized.region,
            tags: categorized.tags,
            importance: categorized.importance,
            createdAt: now,
            updatedAt: now
          };
          this.store.add(memory);
          break;
        }
        case 'updateMemory': {
          if (!msg.id || !msg.patch) { break; }
          const updated = this.store.update(msg.id, msg.patch);
          if (updated) {
            this.postMessage({ type: 'memoryUpdated', memory: updated });
          }
          break;
        }
        case 'scanWorkspace': {
          vscode.commands.executeCommand('claudeBrain.scanWorkspace');
          break;
        }
        case 'writeToContextFile': {
          vscode.commands.executeCommand('claudeBrain.writeToContextFile');
          break;
        }
        case 'browseImportFile': {
          const uris = await vscode.window.showOpenDialog({
            filters: { 'Context files': ['md', 'txt', 'cursorrules'], 'Markdown': ['md'] },
            canSelectMany: false,
            title: 'Select a context file to import (CLAUDE.md, .cursorrules, AGENTS.md…)'
          });
          if (!uris || uris.length === 0) {
            this.postMessage({ type: 'importStatus', text: 'No file selected.', ok: false, done: false });
            break;
          }
          const uri = uris[0];
          const filename = path.basename(uri.fsPath);
          const raw = fs.readFileSync(uri.fsPath, 'utf-8');
          const entries = parseMarkdownFile(raw, filename);
          if (entries.length === 0) {
            this.postMessage({ type: 'importStatus', text: `No importable entries found in ${filename}.`, ok: false, done: false });
            break;
          }
          this.postMessage({ type: 'importStatus', text: `Categorizing ${entries.length} entries from ${filename}…`, ok: true, done: false });
          const role = this.getRole();
          const memories: Memory[] = [];
          for (const entry of entries) {
            const categorized = await this.claude.categorize(entry.content, role.categorizationHint + (entry.hint ? ` Hint: ${entry.hint}` : ''));
            const now = new Date().toISOString();
            memories.push({
              id: crypto.randomUUID(),
              content: entry.content,
              summary: categorized.summary,
              region: categorized.region,
              tags: categorized.tags,
              importance: categorized.importance,
              createdAt: now,
              updatedAt: now,
              source: entry.source
            });
          }
          this.store.importMemories(memories);
          this.postMessage({
            type: 'importStatus',
            text: `✓ Imported ${memories.length} memories from ${filename}.`,
            ok: true,
            done: true,
            memories: this.store.getAll()
          });
          break;
        }
      }
    });

    setTimeout(() => this.sendState(), 300);
  }

  private sendState(): void {
    const role = this.getRole();
    this.postMessage({ type: 'init', state: this.store.getState(), role });
  }

  private postMessage(msg: unknown): void {
    this._view?.webview.postMessage(msg);
  }

  private getHtml(): string {
    const htmlPath = path.join(this.extensionUri.fsPath, 'webview', 'brain.html');
    try {
      return fs.readFileSync(htmlPath, 'utf-8');
    } catch {
      return `<html><body><h3>Failed to load brain visualizer</h3><p>Missing: ${htmlPath}</p></body></html>`;
    }
  }
}
