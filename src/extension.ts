import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { MemoryStore } from './memoryStore';
import { ClaudeService } from './claudeService';
import { BrainWebviewProvider } from './brainWebviewProvider';
import { BrainPanel } from './brainPanel';
import { MemoryTreeProvider } from './memoryTreeProvider';
import { Memory, REGION_META } from './types';
import { parseMarkdownFile } from './markdownImporter';
import { ContextSyncer, renderMemoriesAsMarkdown } from './contextSyncer';
import { getRoleById, DEFAULT_ROLE_ID } from './roles';
import { scanWorkspace } from './workspaceScanner';

export function activate(context: vscode.ExtensionContext): void {
  console.log('[GrayMatter] Extension activating...');

  const store = new MemoryStore(context);
  const claude = new ClaudeService();
  const contextSyncer = new ContextSyncer(store);
  context.subscriptions.push({ dispose: () => contextSyncer.dispose() });

  // Watch for external writes to memories.json (other agents, tools)
  const memoriesGlob = new vscode.RelativePattern(
    vscode.Uri.file(store.getStoragePath()),
    'memories.json'
  );
  const fsWatcher = vscode.workspace.createFileSystemWatcher(memoriesGlob);
  fsWatcher.onDidChange(() => store.reload());
  fsWatcher.onDidCreate(() => store.reload());
  context.subscriptions.push(fsWatcher);

  // ── Webview (3D Brain) ──
  const brainProvider = new BrainWebviewProvider(context.extensionUri, store, claude, context.globalState);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(BrainWebviewProvider.viewType, brainProvider)
  );

  // ── Tree View (Memory List) ──
  const treeProvider = new MemoryTreeProvider(store);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('claudeBrain.memoryList', treeProvider)
  );

  // ── Commands ──

  context.subscriptions.push(vscode.commands.registerCommand('claudeBrain.open', () => {
    BrainPanel.createOrShow(context.extensionUri, store, claude, context.globalState);
  }));

  // Auto-open editor panel on every activation
  BrainPanel.createOrShow(context.extensionUri, store, claude, context.globalState);

  context.subscriptions.push(vscode.commands.registerCommand('claudeBrain.menu', async () => {
    const items: vscode.QuickPickItem[] = [
      { label: '$(add) Add Memory',             description: 'Store something new in your brain' },
      { label: '$(clippy) Copy Relevant Context', description: 'Inject memories into your next prompt' },
      { label: '$(beaker) Distill Memories',     description: 'Merge redundant memories with Claude' },
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      { label: '$(cloud-download) Import',       description: 'Import from JSON or markdown files' },
      { label: '$(cloud-upload) Export as JSON', description: 'Export all memories as JSON' },
      { label: '$(sync) Write to context file',  description: 'Overwrite CLAUDE.md, .cursorrules, or any markdown file' },
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      { label: '$(search) Scan Workspace',        description: 'Auto-detect conventions and stack from project files' },
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      { label: '$(trash) Clear All',             description: 'Wipe entire memory store' },
    ];
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'GrayMatter — choose an action',
      matchOnDescription: true
    });
    if (!picked || picked.kind === vscode.QuickPickItemKind.Separator) { return; }
    if (picked.label.includes('Add Memory'))           { vscode.commands.executeCommand('claudeBrain.addMemory'); }
    else if (picked.label.includes('Copy Relevant'))   { vscode.commands.executeCommand('claudeBrain.copyContext'); }
    else if (picked.label.includes('Distill'))         { vscode.commands.executeCommand('claudeBrain.distill'); }
    else if (picked.label.includes('Import'))          { vscode.commands.executeCommand('claudeBrain.importMemories'); }
    else if (picked.label.includes('Export as JSON'))   { vscode.commands.executeCommand('claudeBrain.exportMemories'); }
    else if (picked.label.includes('Write to context')) { vscode.commands.executeCommand('claudeBrain.writeToContextFile'); }
    else if (picked.label.includes('Scan Workspace'))  { vscode.commands.executeCommand('claudeBrain.scanWorkspace'); }
    else if (picked.label.includes('Clear All'))       { vscode.commands.executeCommand('claudeBrain.clearAll'); }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('claudeBrain.inspectMemory', (memory: Memory) => {
    if (!memory) { return; }

    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const meta = REGION_META[memory.region];
    const pct = Math.round(memory.importance * 100);
    const createdDate = new Date(memory.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const createdTime = new Date(memory.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Source attribution
    let sourceLabel: string;
    let sourceBadgeClass: string;
    if (memory.model) {
      sourceLabel = memory.model.replace(/^claude-/, '').replace(/-\d{8}$/, '');
      sourceBadgeClass = 'badge-model';
    } else if (memory.source) {
      sourceLabel = memory.source.replace(/^(claude-code|chatgpt|markdown|rules):/, '');
      sourceBadgeClass = 'badge-import';
    } else {
      sourceLabel = 'added manually';
      sourceBadgeClass = 'badge-manual';
    }

    const tagsHtml = memory.tags.length
      ? memory.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')
      : '<span class="no-tags">no tags</span>';

    const panel = vscode.window.createWebviewPanel(
      'memoryDetail',
      memory.summary.length > 40 ? memory.summary.slice(0, 40) + '…' : memory.summary,
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: false }
    );

    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Space Grotesk', var(--vscode-font-family), sans-serif;
    font-size: 13px;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    padding: 32px 24px;
  }

  .card {
    width: 100%; max-width: 520px;
    background: var(--vscode-sideBar-background, #1e1e1e);
    border: 1px solid var(--vscode-panel-border, #3c3c3c);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  }

  /* Category header stripe */
  .card-header {
    padding: 18px 22px 16px;
    border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
    display: flex; align-items: center; gap: 10px;
  }
  .category-dot {
    width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
    box-shadow: 0 0 8px ${meta.color}80;
  }
  .category-label {
    font-size: 11px; font-weight: 600; letter-spacing: 0.8px;
    text-transform: uppercase; color: ${meta.color};
  }
  .category-desc {
    font-size: 11px; color: var(--vscode-descriptionForeground, #888);
    margin-left: auto; text-align: right; max-width: 200px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* Main content */
  .card-body { padding: 20px 22px; }

  .summary {
    font-size: 16px; font-weight: 600; line-height: 1.35;
    color: var(--vscode-foreground); margin-bottom: 12px;
  }

  .content-block {
    font-size: 13px; line-height: 1.6;
    color: var(--vscode-descriptionForeground, #aaa);
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border, #3c3c3c);
    border-radius: 6px; padding: 12px 14px; margin-bottom: 18px;
  }

  /* Importance */
  .importance-row { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .importance-label { font-size: 11px; color: var(--vscode-descriptionForeground, #888); width: 70px; flex-shrink: 0; }
  .importance-track {
    flex: 1; height: 5px; background: var(--vscode-panel-border, #3c3c3c);
    border-radius: 3px; overflow: hidden;
  }
  .importance-fill {
    height: 100%; border-radius: 3px; width: ${pct}%;
    background: linear-gradient(90deg, ${meta.color}88, ${meta.color});
    transition: width 0.4s ease;
  }
  .importance-pct { font-size: 12px; font-weight: 600; color: ${meta.color}; min-width: 34px; text-align: right; }

  /* Tags */
  .tags-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }
  .tag {
    font-size: 11px; padding: 3px 8px; border-radius: 100px;
    background: var(--vscode-badge-background, #2d2d2d);
    color: var(--vscode-badge-foreground, #ccc);
    border: 1px solid var(--vscode-panel-border, #3c3c3c);
    letter-spacing: 0.2px;
  }
  .no-tags { font-size: 11px; color: var(--vscode-descriptionForeground, #666); font-style: italic; }

  /* Source badge + date row */
  .meta-row {
    display: flex; align-items: center; justify-content: space-between;
    padding-top: 14px;
    border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
  }
  .badge {
    font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 4px;
    letter-spacing: 0.5px; text-transform: uppercase;
  }
  .badge-model  { background: #1a2a3a; color: #6ab0f5; border: 1px solid #2a4a6a; }
  .badge-import { background: #1a2a2a; color: #4ecdc4; border: 1px solid #2a4a4a; }
  .badge-manual { background: #2a2a1a; color: #ffeaa7; border: 1px solid #4a4a2a; }

  .meta-date { font-size: 11px; color: var(--vscode-descriptionForeground, #666); }

  /* Footer actions */
  .card-footer {
    display: flex; gap: 8px; justify-content: flex-end;
    padding: 16px 22px;
    border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
    background: var(--vscode-editor-background);
  }
  button {
    font-family: inherit; font-size: 12px; font-weight: 500;
    padding: 7px 16px; border-radius: 6px; cursor: pointer;
    border: 1px solid transparent; transition: opacity 0.15s, background 0.15s;
  }
  button:active { opacity: 0.75; }

  .btn-close {
    background: var(--vscode-button-secondaryBackground, #3c3c3c);
    color: var(--vscode-button-secondaryForeground, #ccc);
    border-color: var(--vscode-panel-border, #555);
  }
  .btn-close:hover { background: var(--vscode-button-secondaryHoverBackground, #4a4a4a); }

  .btn-forget {
    background: #5a1a1a; color: #ff8080;
    border-color: #7a2a2a;
  }
  .btn-forget:hover { background: #6a2020; }
</style>
</head>
<body>
<div class="card">
  <div class="card-header">
    <div class="category-dot" style="background:${meta.color}"></div>
    <span class="category-label">${esc(meta.label)}</span>
    <span class="category-desc">${esc(meta.description)}</span>
  </div>

  <div class="card-body">
    <div class="summary">${esc(memory.summary)}</div>

    ${memory.content !== memory.summary ? `<div class="content-block">${esc(memory.content)}</div>` : ''}

    <div class="importance-row">
      <span class="importance-label">Importance</span>
      <div class="importance-track"><div class="importance-fill"></div></div>
      <span class="importance-pct">${pct}%</span>
    </div>

    <div class="tags-row">${tagsHtml}</div>

    <div class="meta-row">
      <span class="badge ${sourceBadgeClass}">${esc(sourceLabel)}</span>
      <span class="meta-date">${createdDate} · ${createdTime}</span>
    </div>
  </div>

  <div class="card-footer">
    <button class="btn-close" onclick="closePanel()">Close</button>
    <button class="btn-forget" onclick="forget()">Forget</button>
  </div>
</div>
<script>
  const vscode = acquireVsCodeApi();
  function forget() { vscode.postMessage({ type: 'forget' }); }
  function closePanel() { vscode.postMessage({ type: 'close' }); }
</script>
</body>
</html>`;

    panel.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'forget') {
        store.delete(memory.id);
        panel.dispose();
        vscode.window.showInformationMessage('Memory forgotten.');
      } else if (msg.type === 'close') {
        panel.dispose();
      }
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('claudeBrain.addMemory', async () => {
    const input = await vscode.window.showInputBox({
      prompt: 'What should GrayMatter remember?',
      placeHolder: 'e.g. "We use Postgres with row-level security"'
    });
    if (!input?.trim()) { return; }

    const categorized = await claude.categorize(input.trim());
    const now = new Date().toISOString();
    const memory: Memory = {
      id: crypto.randomUUID(),
      content: input.trim(),
      summary: categorized.summary,
      region: categorized.region,
      tags: categorized.tags,
      importance: categorized.importance,
      createdAt: now,
      updatedAt: now,
      model: vscode.workspace.getConfiguration('claudeBrain').get<string>('model') || 'claude-sonnet-4-20250514'
    };
    store.add(memory);
    vscode.window.showInformationMessage(`Memory added to ${categorized.region} region.`);

    // Background contradiction check
    (async () => {
      const existing = store.getAll().filter(m => m.id !== memory.id);
      const result = await claude.checkContradiction(memory.summary, existing.map(m => ({ id: m.id, summary: m.summary })));
      if (result.hasConflict) {
        const conflicting = existing.find(m => result.conflictIds.includes(m.id));
        const action = await vscode.window.showWarningMessage(
          `GrayMatter: Possible contradiction detected — "${result.explanation}"`,
          'Resolve with Opus',
          'Ignore'
        );
        if (action === 'Resolve with Opus' && conflicting) {
          const resolution = await claude.resolveContradiction(memory.summary, conflicting.summary);
          if (resolution) {
            vscode.window.showInformationMessage(`GrayMatter Resolution: ${resolution}`, { modal: true });
          }
        }
      }
    })();
  }));

  context.subscriptions.push(vscode.commands.registerCommand('claudeBrain.copyContext', async () => {
    const editor = vscode.window.activeTextEditor;
    const selection = editor?.document.getText(editor.selection);
    const defaultQuery = selection?.trim() || '';

    const input = await vscode.window.showInputBox({
      prompt: 'What are you working on? (GrayMatter will inject relevant memories)',
      placeHolder: 'e.g. "refactoring the auth layer"',
      value: defaultQuery
    });
    if (!input?.trim()) { return; }

    const ranked = claude.rankByRelevance(input.trim(), store.getAll());
    const formatted = claude.formatAsContext(ranked);
    await vscode.env.clipboard.writeText(formatted);
    vscode.window.showInformationMessage(`GrayMatter: Copied ${ranked.length} relevant memories to clipboard.`);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('claudeBrain.clearAll', async () => {
    const choice = await vscode.window.showWarningMessage(
      'Clear ALL memories? This cannot be undone.',
      { modal: true },
      'Clear All'
    );
    if (choice === 'Clear All') {
      store.clearAll();
      vscode.window.showInformationMessage('All memories cleared.');
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('claudeBrain.exportMemories', async () => {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('graymatter-export.json'),
      filters: { 'JSON': ['json'] }
    });
    if (uri) {
      fs.writeFileSync(uri.fsPath, store.exportToJSON(), 'utf-8');
      vscode.window.showInformationMessage(`Exported ${store.getAll().length} memories.`);
    }
  }));

  // ── Write to context file ──
  context.subscriptions.push(vscode.commands.registerCommand('claudeBrain.writeToContextFile', async () => {
    const memories = store.getAll();
    if (!memories.length) {
      vscode.window.showWarningMessage('GrayMatter: No memories to export.');
      return;
    }

    // Recall last used file path
    const lastPath = context.globalState.get<string>('graymatter.lastContextFilePath');
    const lastUri = lastPath ? vscode.Uri.file(lastPath) : undefined;

    // Let user pick the file to overwrite (or create new)
    const uri = await vscode.window.showSaveDialog({
      defaultUri: lastUri ?? (vscode.workspace.workspaceFolders?.[0]
        ? vscode.Uri.file(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'CLAUDE.md'))
        : undefined),
      filters: { 'Markdown / Rules': ['md', 'cursorrules', 'txt'], 'All files': ['*'] },
      title: 'Write memories to context file'
    });

    if (!uri) { return; }

    const existingContent = fs.existsSync(uri.fsPath)
      ? fs.readFileSync(uri.fsPath, 'utf-8')
      : '';

    // If file has a GrayMatter block, replace it. Otherwise append.
    const BLOCK_START = '<!-- graymatter:start -->';
    const BLOCK_END   = '<!-- graymatter:end -->';
    const roleId = context.globalState.get<string>('graymatter.roleId');
    const role = getRoleById(roleId ?? DEFAULT_ROLE_ID);
    const regionLabels = role
      ? Object.fromEntries(Object.entries(role.regions).map(([k, v]) => [k, (v as { label: string }).label])) as Record<string, string>
      : undefined;

    const rendered = renderMemoriesAsMarkdown(memories, regionLabels);
    const block = `${BLOCK_START}\n${rendered}${BLOCK_END}`;

    let newContent: string;
    if (existingContent.includes(BLOCK_START)) {
      // Replace existing block
      const re = new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}`, 'g');
      newContent = existingContent.replace(re, block);
    } else if (existingContent.trim()) {
      // Append to existing file with separator
      newContent = existingContent.trimEnd() + '\n\n' + block + '\n';
    } else {
      newContent = block + '\n';
    }

    fs.writeFileSync(uri.fsPath, newContent, 'utf-8');
    await context.globalState.update('graymatter.lastContextFilePath', uri.fsPath);

    const action = await vscode.window.showInformationMessage(
      `GrayMatter: Wrote ${memories.length} memories to ${path.basename(uri.fsPath)}`,
      'Open file'
    );
    if (action === 'Open file') {
      vscode.window.showTextDocument(uri);
    }
  }));

  // ── Workspace Scanner ──
  context.subscriptions.push(vscode.commands.registerCommand('claudeBrain.scanWorkspace', async () => {
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!ws) { vscode.window.showWarningMessage('GrayMatter: No workspace folder open.'); return; }

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'GrayMatter: Scanning workspace…', cancellable: false },
      async () => { return scanWorkspace(ws); }
    ).then(async (findings) => {
      if (!findings.length) {
        vscode.window.showInformationMessage('GrayMatter: Nothing new detected in this workspace.');
        return;
      }

      // Show quick-pick for user to confirm which findings to keep
      const items = findings.map(f => ({
        label: f.content,
        description: f.source,
        picked: true,
        finding: f
      }));

      const chosen = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        title: `GrayMatter detected ${findings.length} conventions — select to remember`,
        placeHolder: 'Space to toggle, Enter to confirm'
      });

      if (!chosen || chosen.length === 0) { return; }

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `GrayMatter: Adding ${chosen.length} memories…`, cancellable: false },
        async (progress) => {
          for (let i = 0; i < chosen.length; i++) {
            const item = chosen[i];
            progress.report({ message: `${i + 1}/${chosen.length}`, increment: 100 / chosen.length });
            const categorized = await claude.categorize(item.finding.content, item.finding.hint);
            const now = new Date().toISOString();
            store.add({
              id: crypto.randomUUID(),
              content: item.finding.content,
              summary: categorized.summary,
              region: categorized.region,
              tags: categorized.tags,
              importance: categorized.importance,
              createdAt: now,
              updatedAt: now,
              source: `scan:${item.finding.source}`
            });
          }
        }
      );

      vscode.window.showInformationMessage(`GrayMatter: Added ${chosen.length} workspace conventions.`);
    });
  }));

  // ── Import: JSON or Markdown ──
  context.subscriptions.push(vscode.commands.registerCommand('claudeBrain.importMemories', async () => {
    const uris = await vscode.window.showOpenDialog({
      filters: {
        'Memory files': ['json', 'md', 'txt', 'cursorrules'],
        'JSON': ['json'],
        'Markdown': ['md'],
        'Text': ['txt']
      },
      canSelectMany: true,
      title: 'Import memories — JSON or Markdown'
    });

    if (!uris || uris.length === 0) { return; }

    let totalImported = 0;
    let totalSkipped = 0;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'GrayMatter: Importing memories…',
        cancellable: false
      },
      async (progress) => {
        for (const uri of uris) {
          const ext = path.extname(uri.fsPath).toLowerCase();
          const filename = path.basename(uri.fsPath);
          const raw = fs.readFileSync(uri.fsPath, 'utf-8');

          try {
            if (ext === '.json') {
              // Native JSON format
              const count = store.importFromJSON(raw);
              totalImported += count;
              progress.report({ message: `${filename}: ${count} memories` });
            } else {
              // Markdown / text / cursorrules → parse then categorize
              const entries = parseMarkdownFile(raw, filename);
              if (entries.length === 0) {
                totalSkipped++;
                continue;
              }

              const autoSummarize = vscode.workspace
                .getConfiguration('claudeBrain')
                .get<boolean>('autoSummarize', true);

              const memories: Memory[] = [];
              for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                progress.report({
                  message: `${filename}: ${i + 1}/${entries.length}`,
                  increment: (1 / entries.length) * (100 / uris.length)
                });

                const categorized = autoSummarize
                  ? await claude.categorize(entry.content, entry.hint)
                  : claude.heuristicCategorize(entry.content, entry.hint);

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

              const count = store.importMemories(memories);
              totalImported += count;
            }
          } catch (err) {
            vscode.window.showWarningMessage(`GrayMatter: Failed to import ${filename}: ${err}`);
            totalSkipped++;
          }
        }
      }
    );

    if (totalImported > 0) {
      vscode.window.showInformationMessage(
        `GrayMatter: Imported ${totalImported} memor${totalImported === 1 ? 'y' : 'ies'}.` +
        (totalSkipped > 0 ? ` (${totalSkipped} file${totalSkipped > 1 ? 's' : ''} skipped)` : '')
      );
    } else {
      vscode.window.showWarningMessage('GrayMatter: No memories found in selected files.');
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('claudeBrain.distill', async () => {
    const all = store.getAll();
    if (all.length < 3) {
      vscode.window.showInformationMessage('GrayMatter: Need at least 3 memories to distill.');
      return;
    }
    const choice = await vscode.window.showWarningMessage(
      `Distill ${all.length} memories? Claude will merge redundant ones. This modifies your memory store.`,
      { modal: true },
      'Distill'
    );
    if (choice !== 'Distill') { return; }

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'GrayMatter: Distilling memories…', cancellable: false },
      async (progress) => {
        progress.report({ message: 'Analyzing with Claude…' });
        const result = await claude.distillMemories(all);

        let merged = 0;
        for (const group of result.merge) {
          // Delete the originals
          for (const id of group.ids) { store.delete(id); }
          // Add merged memory
          const representative = all.find(m => group.ids.includes(m.id));
          if (representative) {
            const now = new Date().toISOString();
            store.add({
              id: crypto.randomUUID(),
              content: group.newContent,
              summary: group.newSummary,
              region: representative.region,
              tags: representative.tags,
              importance: Math.max(...group.ids.map(id => all.find(m => m.id === id)?.importance ?? 0.5)),
              createdAt: representative.createdAt,
              updatedAt: now,
              source: representative.source,
              model: representative.model
            });
            merged += group.ids.length - 1;
          }
        }

        vscode.window.showInformationMessage(
          merged > 0
            ? `GrayMatter: Distilled — removed ${merged} redundant memor${merged === 1 ? 'y' : 'ies'}.`
            : 'GrayMatter: No redundant memories found — your store is already lean.'
        );
      }
    );
  }));

  // Auto-detect context files on first open (non-blocking)
  detectAndOfferContextFiles(context, store, claude).catch(console.error);

  console.log('[GrayMatter] Extension activated ✓');
}

export function deactivate(): void {}

// ── Context file auto-detection ───────────────────────────────────────────

const CONTEXT_FILE_PATTERNS = [
  'CLAUDE.md', 'claude.md',
  '.claude/MEMORY.md', '.claude/memory.md',
  'AGENTS.md', 'agents.md',
  '.cursorrules',
  'cursor_rules.md', 'cursor-rules.md',
  'MEMORY.md', 'memory.md',
  '.context.md', 'context.md',
  '.github/copilot-instructions.md',
  'copilot-instructions.md'
];

async function detectAndOfferContextFiles(
  context: vscode.ExtensionContext,
  store: MemoryStore,
  claude: ClaudeService
): Promise<void> {
  if (!vscode.workspace.workspaceFolders?.length) { return; }

  const offeredKey = 'graymatter.offeredFiles';
  const alreadyOffered = context.globalState.get<string[]>(offeredKey, []);

  const found: vscode.Uri[] = [];
  for (const pattern of CONTEXT_FILE_PATTERNS) {
    const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1);
    for (const uri of uris) {
      if (!alreadyOffered.includes(uri.fsPath) && !found.some(f => f.fsPath === uri.fsPath)) {
        found.push(uri);
      }
    }
  }

  if (found.length === 0) { return; }

  const fileNames = found.map(u => path.basename(u.fsPath)).join(', ');
  const choice = await vscode.window.showInformationMessage(
    `GrayMatter detected context file${found.length > 1 ? 's' : ''}: ${fileNames}. Import into your brain?`,
    'Import',
    'Skip'
  );

  // Always mark as offered so we don't prompt again for the same files
  await context.globalState.update(offeredKey, [...alreadyOffered, ...found.map(u => u.fsPath)]);

  if (choice !== 'Import') { return; }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'GrayMatter: Importing context files…', cancellable: false },
    async (progress) => {
      let totalImported = 0;
      const autoSummarize = vscode.workspace.getConfiguration('claudeBrain').get<boolean>('autoSummarize', true);

      for (const uri of found) {
        const filename = path.basename(uri.fsPath);
        progress.report({ message: filename });

        try {
          const raw = fs.readFileSync(uri.fsPath, 'utf-8');
          const entries = parseMarkdownFile(raw, filename);
          if (entries.length === 0) { continue; }

          const memories: Memory[] = [];
          for (const entry of entries) {
            const categorized = autoSummarize
              ? await claude.categorize(entry.content, entry.hint)
              : claude.heuristicCategorize(entry.content, entry.hint);

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
              source: entry.source ?? `file:${filename}`
            });
          }

          totalImported += store.importMemories(memories);
        } catch (err) {
          console.error(`[GrayMatter] Failed to import ${uri.fsPath}:`, err);
        }
      }

      vscode.window.showInformationMessage(
        `GrayMatter: Imported ${totalImported} memor${totalImported === 1 ? 'y' : 'ies'} from context files.`
      );
    }
  );
}

