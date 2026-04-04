import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { MemoryStore } from './memoryStore';
import { ClaudeService } from './claudeService';
import { Memory } from './types';
import { getRoleById, DEFAULT_ROLE_ID } from './roles';
import { parseMarkdownFile } from './markdownImporter';

export class BrainPanel {
  static readonly viewType = 'claudeBrain.brainPanel';
  static currentPanel: BrainPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _disposables: vscode.Disposable[] = [];

  static createOrShow(
    extensionUri: vscode.Uri,
    store: MemoryStore,
    claude: ClaudeService,
    globalState: vscode.Memento
  ): void {
    if (BrainPanel.currentPanel) {
      BrainPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      BrainPanel.viewType,
      'GrayMatter',
      vscode.ViewColumn.One,
      { enableScripts: true, localResourceRoots: [extensionUri], retainContextWhenHidden: true }
    );
    BrainPanel.currentPanel = new BrainPanel(panel, extensionUri, store, claude, globalState);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly store: MemoryStore,
    private readonly claude: ClaudeService,
    private readonly globalState: vscode.Memento
  ) {
    this._panel = panel;
    panel.webview.options = { enableScripts: true, localResourceRoots: [extensionUri] };
    panel.webview.html = this.getHtml();

    panel.onDidDispose(() => this.dispose(), null, this._disposables);
    panel.onDidChangeViewState(() => {
      if (panel.visible) { setTimeout(() => this.sendState(), 100); }
    }, null, this._disposables);

    this._disposables.push(store.onDidChange(() => this.sendState()));

    panel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'requestDelete': {
          const mem = this.store.get(msg.id);
          if (mem) {
            const choice = await vscode.window.showWarningMessage(
              `Delete memory: "${mem.summary}"?`, { modal: true }, 'Delete'
            );
            if (choice === 'Delete') {
              this.store.delete(msg.id);
              this.postMessage({ type: 'memoryDeleted', id: msg.id });
            }
          }
          break;
        }
        case 'requestRegionMemories':
          this.postMessage({ type: 'regionSelected', region: msg.region });
          break;
        case 'requestStats':
          this.postMessage({ type: 'statsUpdate', stats: this.store.getStats() });
          break;
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
          if (updated) { this.postMessage({ type: 'memoryUpdated', memory: updated }); }
          break;
        }
        case 'scanWorkspace':
          vscode.commands.executeCommand('claudeBrain.scanWorkspace');
          break;
        case 'writeToContextFile':
          vscode.commands.executeCommand('claudeBrain.writeToContextFile');
          break;
        case 'browseImportFile': {
          const uris = await vscode.window.showOpenDialog({
            filters: { 'Context files': ['md', 'txt', 'cursorrules'] },
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
            const categorized = await this.claude.categorize(
              entry.content, role.categorizationHint + (entry.hint ? ` Hint: ${entry.hint}` : '')
            );
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
            ok: true, done: true,
            memories: this.store.getAll()
          });
          break;
        }
      }
    }, null, this._disposables);

    setTimeout(() => this.sendState(), 300);
  }

  private getRole() {
    const id = this.globalState.get<string>('graymatter.roleId') ?? DEFAULT_ROLE_ID;
    return getRoleById(id) ?? getRoleById(DEFAULT_ROLE_ID)!;
  }

  private sendState(): void {
    this.postMessage({ type: 'init', state: this.store.getState(), role: this.getRole() });
  }

  private postMessage(msg: unknown): void {
    this._panel.webview.postMessage(msg);
  }

  private getHtml(): string {
    const htmlPath = path.join(this.extensionUri.fsPath, 'webview', 'brain.html');
    try {
      return fs.readFileSync(htmlPath, 'utf-8');
    } catch {
      return `<html><body><h3>Failed to load GrayMatter</h3><p>Missing: ${htmlPath}</p></body></html>`;
    }
  }

  dispose(): void {
    BrainPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) { d.dispose(); }
    }
  }
}
