import * as vscode from 'vscode';
import { BrainRegion, Memory } from './types';

export interface CategorizationResult {
  region: BrainRegion;
  summary: string;
  tags: string[];
  importance: number;
}

/**
 * Service that calls the Anthropic API to categorize and summarize memories.
 * Falls back to heuristic categorization when no API key is configured.
 */
export class ClaudeService {
  private getApiKey(): string {
    return vscode.workspace.getConfiguration('claudeBrain').get<string>('apiKey') ?? '';
  }

  public getModel(): string {
    return (
      vscode.workspace.getConfiguration('claudeBrain').get<string>('model') ||
      'claude-sonnet-4-20250514'
    );
  }

  /**
   * Ask Claude to categorize raw text into a brain region,
   * generate a short summary, tags, and importance score.
   * Falls back to heuristic when no API key is set.
   */
  async categorize(content: string, hint?: string): Promise<CategorizationResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return this.heuristicCategorize(content, hint);
    }

    try {
      const hintClause = hint ? `\nCategory hint from source: "${hint}"` : '';
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.getModel(),
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `You are a memory categorization system. Analyze this memory and return ONLY valid JSON (no markdown, no backticks).

Memory: "${content}"${hintClause}

Brain regions:
- frontal: Planning, architecture decisions, goals, strategies
- temporal: Events, conversations, timeline-based info
- parietal: Technical knowledge, code patterns, structural info
- occipital: UI/UX patterns, visual design preferences
- cerebellum: Workflows, habits, repeated procedures
- limbic: User preferences, sentiments, personality traits

Return JSON:
{"region": "<region>", "summary": "<1-sentence summary>", "tags": ["tag1", "tag2"], "importance": <0.0-1.0>}`
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const text: string = data.content?.find((b: any) => b.type === 'text')?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      const validRegions: BrainRegion[] = ['frontal','temporal','parietal','occipital','cerebellum','limbic'];
      const region: BrainRegion = validRegions.includes(parsed.region) ? parsed.region : 'parietal';
      return {
        region,
        summary: parsed.summary || content.slice(0, 80),
        tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t: any) => typeof t === 'string') : [],
        importance: Math.max(0, Math.min(1, parsed.importance || 0.5))
      };
    } catch (err) {
      console.error('[GrayMatter] API categorization failed:', err);
      return this.heuristicCategorize(content, hint);
    }
  }

  /** Simple keyword-based fallback when no API key is set. */
  heuristicCategorize(content: string, hint?: string): CategorizationResult {
    const lower = (content + ' ' + (hint ?? '')).toLowerCase();
    let region: BrainRegion = 'parietal';

    if (/plan|goal|architect|strategy|design|decision/.test(lower)) {
      region = 'frontal';
    } else if (/yesterday|meeting|conversation|event|happened|told me/.test(lower)) {
      region = 'temporal';
    } else if (/ui|ux|color|layout|font|visual|css|style/.test(lower)) {
      region = 'occipital';
    } else if (/always|usually|workflow|habit|routine|every time/.test(lower)) {
      region = 'cerebellum';
    } else if (/prefer|like|hate|love|feel|want|enjoy/.test(lower)) {
      region = 'limbic';
    }

    const stopwords = new Set(['their','would','about','which','these','those','there','could','should','other','after','before','being','while','where','every','under','first','might','still','never','always','often','since','until','using','given','place','based','found','along','three','years','right','left','above','below','large','small','both','much','many','some','when','then','than','that','this','with','from','have','will','been','were','into','also','over','only','just','more','most','very','such','each','same','even']);
    const words = content.split(/\s+/)
      .map(w => w.toLowerCase().replace(/[^a-z]/g, ''))
      .filter(w => w.length > 4 && !stopwords.has(w))
      .slice(0, 3);
    return {
      region,
      summary: content.length > 80 ? content.slice(0, 77) + '...' : content,
      tags: words,
      importance: 0.5
    };
  }

  // ── Feature 2: Memory-Augmented Context Injection ─────

  rankByRelevance(query: string, memories: Memory[], topK = 8): Memory[] {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scored = memories.map(m => {
      const haystack = (m.summary + ' ' + m.content + ' ' + m.tags.join(' ')).toLowerCase();
      const matches = words.filter(w => haystack.includes(w)).length;
      return { m, score: matches * m.importance };
    });
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.m);
  }

  formatAsContext(memories: Memory[]): string {
    const lines = memories.map(m => {
      const pct = Math.round(m.importance * 100);
      return `- [${m.region}] ${m.summary} (importance: ${pct}%)`;
    });
    return [
      '## GrayMatter Context',
      'The following memories are relevant to your current task:',
      '',
      ...lines,
      '',
      '---'
    ].join('\n');
  }

  // ── Feature 3: Contradiction Detection ────────────────

  async checkContradiction(
    newSummary: string,
    existing: { id: string; summary: string }[]
  ): Promise<{ hasConflict: boolean; explanation: string; conflictIds: string[] }> {
    const apiKey = this.getApiKey();
    if (!apiKey || existing.length === 0) {
      return { hasConflict: false, explanation: '', conflictIds: [] };
    }
    try {
      const list = existing.map(m => `[${m.id.slice(0, 8)}] ${m.summary}`).join('\n');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `New memory: '${newSummary}'\n\nExisting memories:\n${list}\n\nDoes the new memory directly contradict any existing one? Reply ONLY with JSON: {"conflict": true/false, "ids": ["id-prefix"], "reason": "explanation or empty"}`
          }]
        })
      });
      const data = await response.json() as any;
      const text: string = data.content?.find((b: any) => b.type === 'text')?.text || '{}';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      const conflictIds = (parsed.ids ?? []).flatMap((prefix: string) => {
        const match = existing.find(m => m.id.startsWith(prefix));
        return match ? [match.id] : [];
      });
      return { hasConflict: !!parsed.conflict, explanation: parsed.reason ?? '', conflictIds };
    } catch {
      return { hasConflict: false, explanation: '', conflictIds: [] };
    }
  }

  async resolveContradiction(summaryA: string, summaryB: string): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) { return ''; }
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `Two agent memories conflict:\nA: '${summaryA}'\nB: '${summaryB}'\n\nIn 1-2 sentences, explain which is likely more current or how they coexist. Be direct and concise.`
          }]
        })
      });
      const data = await response.json() as any;
      return data.content?.find((b: any) => b.type === 'text')?.text || '';
    } catch {
      return '';
    }
  }

  // ── Feature 4: Memory Distillation ────────────────────

  async distillMemories(
    memories: Memory[]
  ): Promise<{ keep: string[]; merge: Array<{ ids: string[]; newSummary: string; newContent: string }> }> {
    const apiKey = this.getApiKey();
    if (!apiKey || memories.length < 3) {
      return { keep: memories.map(m => m.id), merge: [] };
    }
    try {
      const list = memories.map(m => `[${m.id.slice(0, 8)}] ${m.summary}`).join('\n');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.getModel(),
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `These are AI agent memories. Identify redundant or overlapping entries that can be merged without losing information. Return ONLY JSON (no markdown):\n${list}\n\nReturn: {"keep": ["id-prefix-list-to-keep-as-is"], "merge": [{"ids": ["id-prefix1", "id-prefix2"], "newSummary": "merged summary", "newContent": "full merged content"}]}`
          }]
        })
      });
      const data = await response.json() as any;
      const text: string = data.content?.find((b: any) => b.type === 'text')?.text || '{}';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      const expandIds = (prefixes: string[]): string[] =>
        prefixes.flatMap(prefix => {
          const match = memories.find(m => m.id.startsWith(prefix));
          return match ? [match.id] : [];
        });

      const mergeGroups = (parsed.merge ?? []).map((g: any) => ({
        ids: expandIds(g.ids ?? []),
        newSummary: g.newSummary ?? '',
        newContent: g.newContent ?? ''
      }));

      const mergedIds = new Set(mergeGroups.flatMap((g: { ids: string[] }) => g.ids));
      const keep = memories.filter(m => !mergedIds.has(m.id)).map(m => m.id);

      return { keep, merge: mergeGroups };
    } catch {
      return { keep: memories.map(m => m.id), merge: [] };
    }
  }

  /**
   * Generate a conversational recall of memories in a given region.
   */
  async describeRegion(memories: { summary: string; importance: number }[]): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey || memories.length === 0) {
      return memories.map(m => `• ${m.summary}`).join('\n');
    }

    try {
      const list = memories.map(m => `- ${m.summary} (importance: ${m.importance})`).join('\n');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.getModel(),
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `Summarize these memories in 2-3 natural sentences, as if you're recalling them:\n${list}`
          }]
        })
      });

      const data = await response.json() as any;
      return data.content?.find((b: any) => b.type === 'text')?.text || list;
    } catch {
      return memories.map(m => `• ${m.summary}`).join('\n');
    }
  }
}
