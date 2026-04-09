# 🧠 GrayMatter

> Agent memory traces — visualized as an interactive 3D brain.

GrayMatter lives in your editor as a raymarched 3D brain. Every memory your AI agent stores gets mapped to an anatomical region — rotate, zoom, and click to explore what it knows.

<p align="center">
  <img src="media/1.%20Role.png"   width="31%" alt="Onboarding — pick your role" />
  &nbsp;
  <img src="media/2.%20Import.png" width="31%" alt="Onboarding — import context" />
  &nbsp;
  <img src="media/3.%20Brain.png"  width="31%" alt="Brain view with memories" />
</p>

---

## What it does

GrayMatter gives your AI agents a persistent, inspectable memory store — and lets you see it as a living brain.

- **3D Brain Visualization** — WebGL raymarched brain with halftone dot-art rendering, sparkle effects, and smooth rotation/zoom
- **Six Memory Regions** — Decisions & Planning, Technical Knowledge, Events & History, Visual & Design, Habits & Workflows, Preferences & Style
- **Auto-Categorization** — Add a memory and Claude sorts it into the right region with a summary, tags, and importance score
- **Click to Explore** — Click a category or brain region to browse stored memories; the brain rotates to face the selected region
- **Brain Health Score** — A live badge shows how well-populated your brain is across all six regions (Sparse → Growing → Healthy → Excellent)
- **Forget** — Hover any memory card and click "Forget" to remove it (with confirmation)
- **Import / Export** — Back up or share memories as JSON; import from Claude Code, ChatGPT, Cursor, Copilot, and generic markdown formats
- **Resizable Panels** — Drag the grip between the brain and memory list

---

## Multi-Agent & Multi-Model Workflows

**Cross-Agent Memory Sync**
GrayMatter watches `memories.json` for external writes. Any agent or tool that writes to the same storage path — Claude Code, Cursor, a custom script — automatically triggers a live reload in the brain view. Set a shared path in settings to give every agent in your stack access to the same memory store.

**Memory-Augmented Context Injection**
Run `GrayMatter: Copy Relevant Context` (or select text in the editor first) to rank your stored memories against what you're currently working on and copy the top matches as a formatted prompt block to your clipboard. Paste into any LLM chat to give it instant project context.

**Contradiction Detection**
Every new memory is automatically checked against existing ones by a fast model. If a conflict is detected, a warning appears with the explanation and a `Resolve` action — which sends both memories to a stronger model for a resolution suggestion.

**Memory Distillation**
Run `GrayMatter: Distill Memories` to send your full memory store to Claude. It identifies redundant or overlapping entries and merges them into tighter, higher-signal memories — keeping your store lean without losing information.

**Model Attribution**
Every memory is tagged with the model that created it. Attribution badges appear on memory cards in the brain view so you can trace memories back to their origin.

**Context File Auto-Detection**
On first open, GrayMatter scans your workspace for known AI context files (`CLAUDE.md`, `.cursorrules`, `AGENTS.md`, `MEMORY.md`, `.github/copilot-instructions.md`, and more) **as well as any `.md` file in the project** — design docs, general docs, anything markdown. If found, it offers a one-click import to populate your brain immediately — no manual setup needed.

**Proactive Memory Surface**
A status bar indicator (`⚡ N memories`) lights up whenever you switch to a file that matches memories in your store. Click it to see a ranked list of relevant memories for your current context — without leaving the editor.

**Team Brain Export**
Mark individual memories as shared (⬆ Share button on the memory card) and run `GrayMatter: Export Team Brain` to snapshot only those memories into a shareable JSON. If nothing is shared yet, you can export everything. Import the snapshot on another machine to share project context across your team.

**Sample Memories on First Launch**
If you skip importing a context file during onboarding, GrayMatter seeds six sample memories covering all brain regions so you can immediately see and explore a populated brain — delete them whenever you're ready to start fresh.

---

## Installation

### VS Code

Available on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lucilehan.graymatter) — search **"GrayMatter Memory"** in the Extensions sidebar.

Or install a `.vsix` manually:

```bash
code --install-extension graymatter-0.1.2.vsix
```

### Open VSX (Gitpod, VSCodium, etc.)

Available on the [Open VSX Registry](https://open-vsx.org/extension/lucilehan/graymatter) — search **"GrayMatter Memory"** in the Extensions sidebar.

---

## Usage

Open the **GrayMatter** panel from the Activity Bar — or use the command palette:

| Action | Command |
|--------|---------|
| Open brain view | `GrayMatter: Open` |
| Add a memory | `GrayMatter: Add Memory` |
| Copy relevant context | `GrayMatter: Copy Relevant Context` |
| Show relevant memories | `GrayMatter: Show Relevant Memories` |
| Distill memories | `GrayMatter: Distill Memories` |
| Export to JSON | `GrayMatter: Export Memories` |
| Export team brain | `GrayMatter: Export Team Brain` |
| Import from file | `GrayMatter: Import Memories` |
| Clear all memories | `GrayMatter: Clear All Memories` |

Click a **category tab** at the top or a **region on the brain** to filter memories. Drag to rotate the brain, scroll to zoom. Use **Copy Relevant Context** before any LLM chat to inject what GrayMatter knows about your current task.

---

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `claudeBrain.apiKey` | Anthropic API key | — |
| `claudeBrain.model` | Model for categorization and distillation | `claude-sonnet-4-20250514` |
| `claudeBrain.fastModel` | Model for contradiction detection | `claude-haiku-4-5-20251001` |
| `claudeBrain.strongModel` | Model for contradiction resolution | `claude-opus-4-6` |
| `claudeBrain.storagePath` | Custom path for `memories.json` — share across agents by pointing to the same file | `.claude-brain/` in workspace |
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

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

- **Bug reports / feature requests** — open an [Issue](https://github.com/lucilehan/graymatter/issues)
- **Code changes** — fork → branch → PR against `main`

---

## Changelog

### 0.1.3
- **Proactive Memory Surface** — status bar shows relevant memories for the active file; click to browse
- **Brain Health Score** — live badge (Sparse → Excellent) tracks coverage and depth across all six regions
- **Team Brain Export** — mark memories as shared and export a team snapshot with `Export Team Brain`
- **Broader .md scanning** — auto-detection now picks up ALL markdown files in the project (design docs, general docs, etc.) not just known filenames
- **Sample memories on onboarding** — skip import and get 6 demo memories covering all brain regions immediately
- Enhanced onboarding modal UI with step indicator and import drop zone

### 0.1.2
- Added VS Code Marketplace and Open VSX badges and install links to README
- Made Open VSX publish non-blocking in CI

### 0.1.1
- Initial public release on VS Code Marketplace
- Renamed display name to **GrayMatter Memory** to avoid marketplace conflict
- Dynamic GitHub Release titles using latest commit message

### 0.1.0
- First release: 3D WebGL brain, six memory regions, auto-categorization, contradiction detection, memory distillation, context injection, multi-agent sync, import/export

---

*Made with 🍸 by [lucilehan](https://github.com/lucilehan)*
