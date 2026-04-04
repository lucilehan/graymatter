/**
 * WorkspaceScanner — inspects workspace files and infers coding conventions,
 * stack details, and structural patterns that can be stored as memories.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface DetectedMemory {
  content: string;
  hint: string;
  source: string;
}

export async function scanWorkspace(rootPath: string): Promise<DetectedMemory[]> {
  const findings: DetectedMemory[] = [];

  // ── package.json ──────────────────────────────────────────────────────────
  const pkgPath = path.join(rootPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Framework detection
      const frameworks: string[] = [];
      if (deps['next']) { frameworks.push('Next.js'); }
      if (deps['react'] && !deps['next']) { frameworks.push('React'); }
      if (deps['vue']) { frameworks.push('Vue'); }
      if (deps['svelte']) { frameworks.push('Svelte'); }
      if (deps['@angular/core']) { frameworks.push('Angular'); }
      if (deps['express'] || deps['fastify'] || deps['hono']) {
        frameworks.push(deps['fastify'] ? 'Fastify' : deps['hono'] ? 'Hono' : 'Express');
      }
      if (frameworks.length) {
        findings.push({ content: `Project uses ${frameworks.join(', ')}`, hint: 'stack', source: 'package.json' });
      }

      // Language
      if (deps['typescript'] || deps['@types/node']) {
        findings.push({ content: 'Project uses TypeScript', hint: 'stack', source: 'package.json' });
      }

      // Test framework
      const testFw = deps['vitest'] ? 'Vitest' : deps['jest'] ? 'Jest' : deps['mocha'] ? 'Mocha' : null;
      if (testFw) {
        findings.push({ content: `Test framework: ${testFw}`, hint: 'workflow', source: 'package.json' });
      }

      // Key scripts
      const scripts: Record<string, string> = pkg.scripts ?? {};
      const useful = ['lint', 'typecheck', 'test', 'build', 'dev', 'format'];
      const found = useful.filter(k => scripts[k]);
      if (found.length) {
        findings.push({
          content: `Available scripts: ${found.map(k => `npm run ${k}`).join(', ')}`,
          hint: 'workflow',
          source: 'package.json'
        });
      }

      // Package manager (lockfile presence)
      const pm = fs.existsSync(path.join(rootPath, 'pnpm-lock.yaml')) ? 'pnpm'
        : fs.existsSync(path.join(rootPath, 'yarn.lock')) ? 'yarn'
        : fs.existsSync(path.join(rootPath, 'bun.lockb')) ? 'bun'
        : 'npm';
      findings.push({ content: `Package manager: ${pm}`, hint: 'workflow', source: 'lockfile' });
    } catch { /* ignore parse errors */ }
  }

  // ── tsconfig.json ─────────────────────────────────────────────────────────
  const tscPath = path.join(rootPath, 'tsconfig.json');
  if (fs.existsSync(tscPath)) {
    try {
      const tsc = JSON.parse(fs.readFileSync(tscPath, 'utf-8').replace(/\/\/[^\n]*/g, ''));
      const co = tsc.compilerOptions ?? {};
      if (co.strict) {
        findings.push({ content: 'TypeScript strict mode is enabled', hint: 'stack', source: 'tsconfig.json' });
      }
      if (co.paths) {
        const aliases = Object.keys(co.paths).slice(0, 4).join(', ');
        findings.push({ content: `TypeScript path aliases: ${aliases}`, hint: 'stack', source: 'tsconfig.json' });
      }
    } catch { /* ignore */ }
  }

  // ── Prettier ──────────────────────────────────────────────────────────────
  const prettierFiles = ['.prettierrc', '.prettierrc.json', '.prettierrc.js', 'prettier.config.js'];
  for (const f of prettierFiles) {
    const p = path.join(rootPath, f);
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const cfg = f.endsWith('.js') ? {} : JSON.parse(raw);
        const rules: string[] = [];
        if (cfg.semi === false) { rules.push('no semicolons'); }
        if (cfg.semi === true)  { rules.push('semicolons required'); }
        if (cfg.singleQuote)    { rules.push('single quotes'); }
        if (cfg.printWidth)     { rules.push(`print width: ${cfg.printWidth}`); }
        if (cfg.tabWidth)       { rules.push(`${cfg.tabWidth}-space indent`); }
        if (cfg.trailingComma)  { rules.push(`trailing commas: ${cfg.trailingComma}`); }
        if (rules.length) {
          findings.push({ content: `Code style (Prettier): ${rules.join(', ')}`, hint: 'style', source: f });
        }
      } catch { /* ignore */ }
      break;
    }
  }

  // ── ESLint ────────────────────────────────────────────────────────────────
  const eslintFiles = ['.eslintrc', '.eslintrc.json', '.eslintrc.js', 'eslint.config.js', 'eslint.config.mjs'];
  for (const f of eslintFiles) {
    if (fs.existsSync(path.join(rootPath, f))) {
      findings.push({ content: `ESLint is configured (${f})`, hint: 'workflow', source: f });
      break;
    }
  }

  // ── Source file sampling — naming conventions ─────────────────────────────
  const conventions = await detectNamingConventions(rootPath);
  findings.push(...conventions);

  // ── Folder structure ──────────────────────────────────────────────────────
  const structure = detectFolderStructure(rootPath);
  if (structure) {
    findings.push({ content: structure, hint: 'structure', source: 'file system' });
  }

  return findings;
}

async function detectNamingConventions(rootPath: string): Promise<DetectedMemory[]> {
  const findings: DetectedMemory[] = [];

  // Find up to 20 source files to sample
  const files = await collectSourceFiles(rootPath, ['ts', 'tsx', 'js', 'jsx'], 20);
  if (files.length === 0) { return findings; }

  let camelFunctions = 0, snakeFunctions = 0;
  let camelVariables = 0, snakeVariables = 0;
  let pascalComponents = 0;
  let hasBarrelFiles = false;

  const fnPattern    = /(?:function|const|let|var)\s+([a-z][a-zA-Z0-9_]*)\s*[=(]/g;
  const compPattern  = /(?:function|const)\s+([A-Z][a-zA-Z0-9]*)\s*[=(]/g;
  const indexPattern = /index\.(ts|tsx|js|jsx)$/;

  for (const file of files) {
    if (indexPattern.test(file)) { hasBarrelFiles = true; }
    try {
      const src = fs.readFileSync(file, 'utf-8').slice(0, 5000); // first 5k chars

      let m: RegExpExecArray | null;
      fnPattern.lastIndex = 0;
      while ((m = fnPattern.exec(src)) !== null) {
        const name = m[1];
        if (name.includes('_')) { snakeFunctions++; } else { camelFunctions++; }
      }

      compPattern.lastIndex = 0;
      while ((m = compPattern.exec(src)) !== null) {
        pascalComponents++;
      }

      // Variable declarations
      const varMatches = src.match(/(?:const|let|var)\s+([a-z][a-zA-Z0-9_]*)/g) ?? [];
      for (const v of varMatches) {
        const name = v.replace(/^(?:const|let|var)\s+/, '');
        if (name.includes('_')) { snakeVariables++; } else { camelVariables++; }
      }
    } catch { /* skip unreadable files */ }
  }

  // Naming convention: functions/variables
  const totalFn = camelFunctions + snakeFunctions;
  if (totalFn > 5) {
    const convention = snakeFunctions > camelFunctions * 2 ? 'snake_case' : 'camelCase';
    findings.push({
      content: `Function/variable naming convention: ${convention}`,
      hint: 'style',
      source: 'source files'
    });
  }

  if (pascalComponents > 3) {
    findings.push({
      content: 'Components/classes use PascalCase naming',
      hint: 'style',
      source: 'source files'
    });
  }

  if (hasBarrelFiles) {
    findings.push({
      content: 'Project uses barrel files (index.ts exports)',
      hint: 'structure',
      source: 'source files'
    });
  }

  // File extension convention
  const tsxCount = files.filter(f => f.endsWith('.tsx')).length;
  const jsxCount = files.filter(f => f.endsWith('.jsx')).length;
  if (tsxCount > jsxCount && tsxCount > 2) {
    findings.push({ content: 'Component files use .tsx extension', hint: 'style', source: 'source files' });
  }

  return findings;
}

async function collectSourceFiles(rootPath: string, exts: string[], limit: number): Promise<string[]> {
  const results: string[] = [];
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '.cache']);

  function walk(dir: string) {
    if (results.length >= limit) { return; }
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (results.length >= limit) { return; }
      if (e.isDirectory()) {
        if (!skip.has(e.name) && !e.name.startsWith('.')) { walk(path.join(dir, e.name)); }
      } else if (exts.some(ext => e.name.endsWith('.' + ext))) {
        results.push(path.join(dir, e.name));
      }
    }
  }

  // Prefer src/ directory
  const srcDir = path.join(rootPath, 'src');
  walk(fs.existsSync(srcDir) ? srcDir : rootPath);
  return results;
}

function detectFolderStructure(rootPath: string): string | null {
  const interesting: Record<string, string> = {
    'src/components': 'components in src/components/',
    'src/hooks':      'custom hooks in src/hooks/',
    'src/lib':        'shared utilities in src/lib/',
    'src/utils':      'utilities in src/utils/',
    'src/store':      'state store in src/store/',
    'src/services':   'services in src/services/',
    'src/api':        'API layer in src/api/',
    'src/types':      'shared types in src/types/',
    'src/app':        'app directory routing (Next.js app router)',
    'src/pages':      'pages directory routing',
    'packages':       'monorepo with packages/ directory',
    'apps':           'monorepo with apps/ directory',
  };

  const found: string[] = [];
  for (const [dir, desc] of Object.entries(interesting)) {
    if (fs.existsSync(path.join(rootPath, dir))) { found.push(desc); }
  }

  return found.length >= 2
    ? `Project structure: ${found.join('; ')}`
    : null;
}
