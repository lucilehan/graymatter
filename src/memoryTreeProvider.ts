import * as vscode from 'vscode';
import { MemoryStore } from './memoryStore';
import { Memory, BrainRegion, REGION_META } from './types';

class RegionItem extends vscode.TreeItem {
  constructor(readonly region: BrainRegion, count: number) {
    const meta = REGION_META[region];
    super(
      `${meta.label} (${count})`,
      count > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    this.tooltip = meta.description;
    this.iconPath = new vscode.ThemeIcon('circle-filled');
    this.contextValue = 'region';
  }
}

class MemoryItem extends vscode.TreeItem {
  constructor(readonly memory: Memory) {
    super(memory.summary, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${memory.content}\n\nImportance: ${(memory.importance * 100).toFixed(0)}%\nTags: ${memory.tags.join(', ')}`;
    this.description = new Date(memory.createdAt).toLocaleDateString();
    this.iconPath = new vscode.ThemeIcon('symbol-constant');
    this.contextValue = 'memory';
    this.command = {
      command: 'claudeBrain.inspectMemory',
      title: 'Inspect Memory',
      arguments: [memory]
    };
  }
}

type TreeNode = RegionItem | MemoryItem;

export class MemoryTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly store: MemoryStore) {
    store.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      const regions: BrainRegion[] = [
        'frontal', 'temporal', 'parietal', 'occipital', 'cerebellum', 'limbic'
      ];
      return regions.map(r => new RegionItem(r, this.store.getByRegion(r).length));
    }
    if (element instanceof RegionItem) {
      return this.store.getByRegion(element.region).map(m => new MemoryItem(m));
    }
    return [];
  }
}
