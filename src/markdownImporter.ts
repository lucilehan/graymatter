/**
 * GrayMatter — Markdown Importer
 *
 * Parses markdown files from various LLM memory formats into
 * raw content strings ready for categorization.
 *
 * Supported formats:
 *  - Claude Code   MEMORY.md / memory files with YAML frontmatter
 *  - ChatGPT       exported memory lists (numbered or bulleted)
 *  - Gemini        sectioned markdown (headers + prose)
 *  - Cursor        .cursorrules / plain instruction files
 *  - GitHub Copilot  copilot-instructions.md (headers + bullets)
 *  - Generic       any markdown — headers, bullets, paragraphs
 */

export interface ParsedEntry {
  content: string;
  /** Hint extracted from the source (e.g. frontmatter type, header name). */
  hint?: string;
  /** Original source label for provenance tracking. */
  source?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Strip markdown formatting characters from a string. */
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, '')          // headings
    .replace(/[*_`~]+/g, '')            // emphasis / code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // links → label
    .replace(/^\s*[-*+>]\s+/gm, '')     // list markers / blockquotes
    .replace(/^\s*\d+\.\s+/gm, '')      // numbered list markers
    .trim();
}

/** Return true when the string is non-empty after stripping whitespace. */
function nonEmpty(s: string): boolean {
  return s.trim().length > 2;
}

// ── Format detectors ───────────────────────────────────────────────────────

/** YAML frontmatter block at the top of a file. */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function parseFrontmatter(raw: string): Record<string, string> | null {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) { return null; }
  const result: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) { continue; }
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
    if (key) { result[key] = val; }
  }
  return result;
}

// ── Parsers ────────────────────────────────────────────────────────────────

/**
 * Claude Code memory files — single file per memory with YAML frontmatter.
 * Also handles a MEMORY.md index file (links are skipped; only body content
 * that is NOT an index entry is imported).
 *
 * Example:
 *   ---
 *   name: Prefer TypeScript
 *   description: user prefers TypeScript over JavaScript
 *   type: user
 *   ---
 *   The user has explicitly stated they prefer TypeScript for all new code.
 */
function parseClaudeCodeFormat(raw: string, filename: string): ParsedEntry[] {
  const fm = parseFrontmatter(raw);
  if (!fm) { return []; }

  const body = raw.replace(FRONTMATTER_RE, '').trim();
  const content = body || fm['description'] || fm['name'] || '';
  if (!nonEmpty(content)) { return []; }

  return [{
    content: content.trim(),
    hint: fm['type'] || fm['name'],
    source: `claude-code:${filename}`
  }];
}

/**
 * ChatGPT exported memory — numbered or bulleted list, one memory per line.
 *
 * Example:
 *   1. User prefers Python for scripting tasks
 *   2. User works at a startup in San Francisco
 *   - Always use functional React components
 */
function parseChatGPTFormat(raw: string, filename: string): ParsedEntry[] {
  const lines = raw.split('\n');
  const entries: ParsedEntry[] = [];
  for (const line of lines) {
    // Numbered: "1. content" or bulleted: "- content" / "* content"
    const m = line.match(/^\s*(?:\d+\.|[-*+•])\s+(.+)/);
    if (m && nonEmpty(m[1])) {
      entries.push({ content: m[1].trim(), source: `chatgpt:${filename}` });
    }
  }
  return entries;
}

/**
 * Sectioned markdown — headers become category hints, body paragraphs or
 * bullets become individual memories.
 * Used by Gemini notes, Notion AI exports, and general markdown docs.
 *
 * Example:
 *   ## Technical Preferences
 *   I prefer TypeScript. API is built with Express.
 *
 *   ## Habits
 *   - Always run tests before pushing
 */
function parseSectionedMarkdown(raw: string, filename: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const sections = raw.split(/^#{1,3}\s+/m);

  for (const section of sections) {
    if (!section.trim()) { continue; }
    const lines = section.split('\n');
    const heading = lines[0].trim();
    const rest = lines.slice(1).join('\n').trim();
    if (!nonEmpty(rest)) { continue; }

    // Try to split by bullets first
    const bullets = rest.match(/^\s*[-*+•\d+\.]\s+.+/gm);
    if (bullets && bullets.length > 0) {
      for (const b of bullets) {
        const text = stripMarkdown(b);
        if (nonEmpty(text)) {
          entries.push({ content: text, hint: heading, source: `markdown:${filename}` });
        }
      }
    } else {
      // Split into paragraphs
      const paragraphs = rest.split(/\n{2,}/);
      for (const para of paragraphs) {
        const text = stripMarkdown(para);
        if (nonEmpty(text)) {
          entries.push({ content: text, hint: heading, source: `markdown:${filename}` });
        }
      }
    }
  }
  return entries;
}

/**
 * Cursor .cursorrules / plain rules files — each non-empty line or
 * paragraph is a rule/memory.
 *
 * Example:
 *   You are an expert TypeScript developer.
 *   Always use functional components in React.
 *   Prefer const over let.
 */
function parsePlainText(raw: string, filename: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  // Split by sentence-ending punctuation or double newlines
  const chunks = raw.split(/(?<=[.!?])\s+|\n{2,}/);
  for (const chunk of chunks) {
    const text = chunk.replace(/\s+/g, ' ').trim();
    if (nonEmpty(text) && text.length < 1000) {
      entries.push({ content: text, source: `rules:${filename}` });
    }
  }
  return entries;
}

// ── Format detection ───────────────────────────────────────────────────────

type MarkdownFormat =
  | 'claude-code'
  | 'chatgpt'
  | 'sectioned'
  | 'plain';

function detectFormat(raw: string, filename: string): MarkdownFormat {
  const lower = filename.toLowerCase();

  // Claude Code: YAML frontmatter
  if (FRONTMATTER_RE.test(raw)) {
    return 'claude-code';
  }

  // Cursor rules files or GitHub Copilot instructions (plain prose/rules)
  if (
    lower.includes('cursorrules') ||
    lower.includes('copilot-instructions') ||
    lower.includes('rules') ||
    lower.includes('instructions')
  ) {
    // If it has headers, treat as sectioned; otherwise plain
    return /^#{1,3}\s+/m.test(raw) ? 'sectioned' : 'plain';
  }

  // ChatGPT: mostly numbered/bulleted list lines, little else
  const lines = raw.split('\n').filter(l => l.trim());
  const listLines = lines.filter(l => /^\s*(?:\d+\.|[-*+•])\s+/.test(l));
  if (lines.length > 0 && listLines.length / lines.length > 0.6) {
    return 'chatgpt';
  }

  // Has markdown headers → sectioned (Gemini notes, Notion, general docs)
  if (/^#{1,3}\s+/m.test(raw)) {
    return 'sectioned';
  }

  // Fallback: plain text
  return 'plain';
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse a markdown (or plain text) file and extract individual memory entries.
 *
 * @param raw      File contents as a string
 * @param filename Filename used for format detection and provenance
 * @returns        Array of parsed entries, ready for categorization
 */
export function parseMarkdownFile(raw: string, filename: string): ParsedEntry[] {
  const format = detectFormat(raw, filename);

  switch (format) {
    case 'claude-code': return parseClaudeCodeFormat(raw, filename);
    case 'chatgpt':     return parseChatGPTFormat(raw, filename);
    case 'sectioned':   return parseSectionedMarkdown(raw, filename);
    case 'plain':       return parsePlainText(raw, filename);
  }
}
