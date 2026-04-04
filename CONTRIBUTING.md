# Contributing to GrayMatter

Thanks for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/lucilehan/graymatter.git
cd graymatter
npm install
```

Open in VS Code and press `F5` to launch the extension in a new Extension Development Host window.

## Project Structure

```
src/
  extension.ts          # Entry point, registers commands and providers
  brainWebviewProvider.ts  # WebGL brain visualization panel
  memoryTreeProvider.ts    # Sidebar memory list tree view
  memoryStore.ts           # Persistent JSON storage
  claudeService.ts         # Anthropic API integration
  types.ts                 # Shared type definitions
webview/
  brain.html            # WebGL raymarching + halftone rendering
media/
  icon.png              # Extension icon
```

## Building

```bash
npm run compile       # One-time build
npm run watch         # Watch mode
```

## Packaging

```bash
npx @vscode/vsce package --no-dependencies
```

## Submitting Changes

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Open a pull request against `main`

## Releasing

Releases are automated — push a version tag and GitHub Actions handles the rest:

```bash
git tag v0.2.0
git push origin --tags
```

This requires `VSCE_PAT` (VS Code Marketplace) and `OVSX_PAT` (Open VSX) secrets configured in the repo settings.
