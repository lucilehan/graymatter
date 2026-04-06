# GrayMatter

> Agent memory traces — visualized as an interactive 3D brain.

GrayMatter lets you see, explore, and manage what your AI agent remembers. Memories are mapped to anatomical brain regions and rendered as a raymarched halftone dot-art brain you can rotate, zoom, and click.

---

## Features

### Core
- **3D Brain Visualization** — WebGL raymarched brain with halftone dot-art rendering, sparkle effects, and smooth rotation/zoom
- **Six Memory Regions** — Decisions & Planning, Technical Knowledge, Events & History, Visual & Design, Habits & Workflows, Preferences & Style
- **Auto-Categorization** — Add a memory and Claude sorts it into the right brain region with a summary, tags, and importance score
- **Click to Explore** — Click a category or brain region to browse stored memories; the brain rotates to face the selected region
- **Forget** — Hover any memory card and click "forget" to remove it (with confirmation)
- **Import / Export** — Back up or share memories as JSON; import from Claude Code, ChatGPT, Cursor, Copilot, and generic markdown formats
- **Resizable Panels** — Drag the grip handle between the brain and memory list

### Multi-Agent & Multi-Model Workflows

**Cross-Agent Memory Sync**
GrayMatter watches `memories.json` for external writes. Any agent or tool that writes to the same storage path — Claude Code, Cursor, a custom script — automatically triggers a live reload in the brain view. Set a shared path in settings to give every agent in your stack access to the same memory store.

**Memory-Augmented Context Injection**
Run `GrayMatter: Copy Relevant Context` (or select text in the editor first) to rank your stored memories against what you're currently working on and copy the top matches as a formatted prompt block to your clipboard. Paste into any LLM chat to give it instant project context.

**Contradiction Detection**
Every new memory is automatically checked against existing ones by a fast model (Haiku). If a conflict is detected, a warning appears with the explanation and a `Resolve with Opus` action — which sends both memories to a stronger model for a resolution suggestion.

**Memory Distillation**
Run `GrayMatter: Distill Memories` to send your full memory store to Claude. It identifies redundant or overlapping entries and merges them into tighter, higher-signal memories — keeping your store lean without losing information.

**Model Attribution**
Every memory is tagged with the model that created it. Attribution badges appear on memory cards in the brain view, and memories created by different agents or models can be traced back to their origin.

**Context File Auto-Detection**
On first open, GrayMatter scans your workspace for known AI context files (`CLAUDE.md`, `.cursorrules`, `AGENTS.md`, `MEMORY.md`, `.github/copilot-instructions.md`, and more). If found, it offers a one-click import to populate your brain immediately — no manual setup needed.

---

## Installation

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/lucilehan.graymatter?label=VS%20Code%20Marketplace&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=lucilehan.graymatter)
[![Open VSX](https://img.shields.io/open-vsx/v/lucilehan/graymatter?label=Open%20VSX&logo=vscodium)](https://open-vsx.org/extension/lucilehan/graymatter)

### VS Code Marketplace
[Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lucilehan.graymatter) — or search **"GrayMatter Memory"** in the Extensions sidebar.

### Open VSX (Gitpod, VSCodium, etc.)
[Install from Open VSX](https://open-vsx.org/extension/lucilehan/graymatter) — or search **"GrayMatter Memory"** in the Extensions sidebar.

### Manual
```
code --install-extension graymatter-0.1.1.vsix
```

---

## Usage

1. Open the **GrayMatter** panel in the Activity Bar
2. Click a **category tab** at the top or a **region on the brain** to explore memories
3. Hover any memory card to **forget** it; click **+ New Memory** to add one
4. Drag to rotate the brain, scroll to zoom
5. Use **Copy Relevant Context** before any LLM chat to inject what GrayMatter knows about your current task

---

## Commands

| Command | Description |
|---------|-------------|
| `GrayMatter: Open` | Focus the brain view |
| `GrayMatter: Add Memory` | Add a memory via input box |
| `GrayMatter: Copy Relevant Context` | Rank and copy memories relevant to current work |
| `GrayMatter: Distill Memories` | Merge redundant memories with Claude |
| `GrayMatter: Clear All Memories` | Wipe the memory store |
| `GrayMatter: Export Memories` | Export to JSON |
| `GrayMatter: Import Memories` | Import from JSON or markdown |

---

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `claudeBrain.apiKey` | Anthropic API key | — |
| `claudeBrain.model` | Model for categorization and distillation | `claude-sonnet-4-20250514` |
| `claudeBrain.fastModel` | Model for contradiction detection | `claude-haiku-4-5-20251001` |
| `claudeBrain.strongModel` | Model for contradiction resolution | `claude-opus-4-6` |
| `claudeBrain.storagePath` | Custom storage path (share across agents by pointing to the same path) | `.claude-brain/` in workspace |
| `claudeBrain.autoSummarize` | Auto-categorize new memories with Claude | `true` |

---

## Building from Source

```bash
git clone https://github.com/lucilehan/graymatter.git
cd graymatter
npm install
npm run compile
```

To package:
```bash
npx @vscode/vsce package --no-dependencies
```

---

## Releasing

Automated via GitHub Actions on tag push:

```bash
git tag v0.1.0
git push origin --tags
```

Publishes to both VS Code Marketplace and Open VSX. Requires `VSCE_PAT` and `OVSX_PAT` secrets.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[MIT](LICENSE)

---

*Made with 🍸 by [lucilehan](https://github.com/lucilehan)*
