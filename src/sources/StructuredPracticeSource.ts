import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import * as yaml from 'js-yaml';
import {
  BaseSource,
  type SourceContext,
  type SourceResult,
  type Document,
} from '@xorng/template-knowledge';
import { PracticeSchema, StyleGuideSchema, type SourceConfig, type Practice, type StyleGuide } from '../types/index.js';

/**
 * Source for loading structured practice definitions from JSON/YAML files
 */
export class StructuredPracticeSource extends BaseSource {
  private config: SourceConfig;
  private documentCache: Map<string, Document> = new Map();
  private basePath: string;

  constructor(config: SourceConfig) {
    super(config.name, `Structured practices from ${config.path}`);
    this.config = config;
    this.basePath = config.path;
  }

  async connect(context: SourceContext): Promise<void> {
    try {
      await fs.access(this.basePath);
      this.connected = true;
      context.logger.info({ path: this.basePath }, 'Connected to structured practices source');
    } catch {
      throw new Error(`Structured source path not found: ${this.basePath}`);
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.documentCache.clear();
  }

  async fetchDocuments(context: SourceContext): Promise<SourceResult> {
    const documents: Document[] = [];
    
    const patterns = this.config.format === 'yaml' 
      ? ['**/*.yaml', '**/*.yml']
      : ['**/*.json'];

    const files: string[] = [];
    for (const pattern of patterns) {
      const found = await glob(pattern, {
        cwd: this.basePath,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**'],
      });
      files.push(...found);
    }

    context.logger.info({ fileCount: files.length }, 'Found structured practice files');

    for (const file of files) {
      try {
        const docs = await this.loadStructuredFile(file, context);
        documents.push(...docs);
      } catch (error) {
        context.logger.warn({ file, error }, 'Failed to load structured file');
      }
    }

    return { documents };
  }

  async fetchDocument(id: string, context: SourceContext): Promise<Document | null> {
    return this.documentCache.get(id) || null;
  }

  async getDocumentCount(): Promise<number> {
    return this.documentCache.size;
  }

  /**
   * Load and parse a structured file (JSON or YAML)
   */
  private async loadStructuredFile(
    filePath: string,
    context: SourceContext
  ): Promise<Document[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(this.basePath, filePath);
    const ext = path.extname(filePath).toLowerCase();

    let data: unknown;
    try {
      if (ext === '.yaml' || ext === '.yml') {
        data = yaml.load(content);
      } else {
        data = JSON.parse(content);
      }
    } catch (error) {
      context.logger.warn({ file: filePath, error }, 'Failed to parse file');
      return [];
    }

    // Try to parse as StyleGuide first
    const styleGuideResult = StyleGuideSchema.safeParse(data);
    if (styleGuideResult.success) {
      return this.processStyleGuide(styleGuideResult.data, relativePath);
    }

    // Try as array of practices
    if (Array.isArray(data)) {
      const practices: Practice[] = [];
      for (const item of data) {
        const result = PracticeSchema.safeParse(item);
        if (result.success) {
          practices.push(result.data);
        }
      }
      if (practices.length > 0) {
        return this.processPractices(practices, relativePath, {});
      }
    }

    // Try as single practice
    const practiceResult = PracticeSchema.safeParse(data);
    if (practiceResult.success) {
      return this.processPractices([practiceResult.data], relativePath, {});
    }

    context.logger.warn({ file: filePath }, 'Unknown file format');
    return [];
  }

  /**
   * Process a style guide document
   */
  private processStyleGuide(guide: StyleGuide, relativePath: string): Document[] {
    const documents: Document[] = [];

    // Process each practice
    const practiceDefaults = {
      language: guide.language,
      framework: guide.framework,
    };

    const practiceDocs = this.processPractices(guide.practices, relativePath, practiceDefaults);
    documents.push(...practiceDocs);

    // Create overview document
    const overview: Document = {
      id: `${this.name}:${relativePath}`,
      type: 'style-guide',
      content: this.formatStyleGuideOverview(guide),
      title: guide.name,
      metadata: {
        source: this.name,
        path: relativePath,
        language: guide.language,
        framework: guide.framework,
        version: guide.version,
        practiceCount: guide.practices.length,
        categories: [...new Set(guide.practices.map(p => p.category))],
      },
    };

    documents.push(overview);
    this.documentCache.set(overview.id, overview);

    return documents;
  }

  /**
   * Process array of practices
   */
  private processPractices(
    practices: Practice[],
    relativePath: string,
    defaults: { language?: string; framework?: string }
  ): Document[] {
    const documents: Document[] = [];

    for (const practice of practices) {
      const doc: Document = {
        id: `${this.name}:${relativePath}#${practice.id}`,
        type: 'practice',
        content: this.formatPracticeContent(practice),
        title: practice.title,
        metadata: {
          source: this.name,
          path: relativePath,
          practiceId: practice.id,
          category: practice.category,
          severity: practice.severity,
          language: practice.language || defaults.language || 'general',
          framework: practice.framework || defaults.framework,
          tags: practice.tags || [],
          hasGoodExample: !!practice.goodExample,
          hasBadExample: !!practice.badExample,
          lintRules: practice.lintRules || [],
          relatedPractices: practice.relatedPractices || [],
        },
      };

      documents.push(doc);
      this.documentCache.set(doc.id, doc);
    }

    return documents;
  }

  /**
   * Format practice into searchable content
   */
  private formatPracticeContent(practice: Practice): string {
    const parts: string[] = [
      `# ${practice.title}`,
      '',
      `**Category:** ${practice.category}`,
      `**Severity:** ${practice.severity}`,
      `**Language:** ${practice.language}`,
      '',
      practice.description,
    ];

    if (practice.rationale) {
      parts.push('', '## Rationale', practice.rationale);
    }

    if (practice.goodExample) {
      parts.push('', '## Good Example', '```', practice.goodExample, '```');
    }

    if (practice.badExample) {
      parts.push('', '## Bad Example (Avoid)', '```', practice.badExample, '```');
    }

    if (practice.exceptions && practice.exceptions.length > 0) {
      parts.push('', '## Exceptions', practice.exceptions.map(e => `- ${e}`).join('\n'));
    }

    if (practice.lintRules && practice.lintRules.length > 0) {
      parts.push('', '## Related Lint Rules', practice.lintRules.map(r => `- ${r}`).join('\n'));
    }

    if (practice.references && practice.references.length > 0) {
      parts.push('', '## References', practice.references.map(r => `- ${r}`).join('\n'));
    }

    return parts.join('\n');
  }

  /**
   * Format style guide overview
   */
  private formatStyleGuideOverview(guide: StyleGuide): string {
    const parts: string[] = [
      `# ${guide.name}`,
      '',
      `**Language:** ${guide.language}`,
    ];

    if (guide.framework) {
      parts.push(`**Framework:** ${guide.framework}`);
    }
    if (guide.version) {
      parts.push(`**Version:** ${guide.version}`);
    }

    if (guide.description) {
      parts.push('', guide.description);
    }

    parts.push('', '## Practices', '');

    // Group by category
    const byCategory = new Map<string, Practice[]>();
    for (const practice of guide.practices) {
      const cat = practice.category;
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(practice);
    }

    for (const [category, practices] of byCategory) {
      parts.push(`### ${category}`, '');
      for (const p of practices) {
        parts.push(`- **${p.title}** [${p.severity}]: ${p.description.slice(0, 100)}...`);
      }
      parts.push('');
    }

    return parts.join('\n');
  }
}
