import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import {
  FileSource,
  type SourceContext,
  type SourceResult,
  type Document,
} from '@xorng/template-knowledge';
import type { SourceConfig, Practice, PracticeCategory, PracticeSeverity } from '../types/index.js';

/**
 * Source for loading markdown-based style guides and best practices
 */
export class MarkdownPracticeSource extends FileSource {
  private config: SourceConfig;
  private documentCache: Map<string, Document> = new Map();

  constructor(config: SourceConfig) {
    super(config.name, `Markdown practices from ${config.path}`, config.path);
    this.config = config;
  }

  async connect(context: SourceContext): Promise<void> {
    try {
      await fs.access(this.basePath);
      this.connected = true;
      context.logger.info({ path: this.basePath }, 'Connected to markdown practices source');
    } catch {
      throw new Error(`Practice source path not found: ${this.basePath}`);
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.documentCache.clear();
  }

  async fetchDocuments(context: SourceContext): Promise<SourceResult> {
    const documents: Document[] = [];
    
    const files = await glob('**/*.md', {
      cwd: this.basePath,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });

    context.logger.info({ fileCount: files.length }, 'Found practice files');

    for (const file of files) {
      try {
        const docs = await this.loadPracticeDocument(file, context);
        documents.push(...docs);
      } catch (error) {
        context.logger.warn({ file, error }, 'Failed to load practice document');
      }
    }

    return { documents };
  }

  async fetchDocument(id: string, context: SourceContext): Promise<Document | null> {
    if (this.documentCache.has(id)) {
      return this.documentCache.get(id)!;
    }
    return null;
  }

  async getDocumentCount(): Promise<number> {
    return this.documentCache.size;
  }

  /**
   * Load and parse a markdown practice document
   * Each H2 section becomes a separate practice
   */
  private async loadPracticeDocument(
    filePath: string,
    context: SourceContext
  ): Promise<Document[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(this.basePath, filePath);
    
    const { content: body, data: frontmatter } = matter(content);
    
    // Parse document into practices based on H2 sections
    const practices = this.parsePractices(body, frontmatter);
    const documents: Document[] = [];

    // Create document for each practice
    for (const practice of practices) {
      const doc: Document = {
        id: this.generateId(relativePath, practice.id),
        type: 'practice',
        content: this.formatPracticeContent(practice),
        title: practice.title,
        metadata: {
          source: this.name,
          path: relativePath,
          practiceId: practice.id,
          category: practice.category,
          severity: practice.severity,
          language: practice.language || this.config.language || 'general',
          framework: practice.framework || this.config.framework,
          tags: practice.tags || [],
          hasGoodExample: !!practice.goodExample,
          hasBadExample: !!practice.badExample,
          lintRules: practice.lintRules || [],
        },
      };

      documents.push(doc);
      this.documentCache.set(doc.id, doc);
    }

    // Also create a document for the whole file for overview searches
    const overviewDoc: Document = {
      id: `${this.name}:${relativePath}`,
      type: 'style-guide',
      content: body,
      title: frontmatter.title || path.basename(filePath, '.md'),
      metadata: {
        source: this.name,
        path: relativePath,
        language: frontmatter.language || this.config.language || 'general',
        framework: frontmatter.framework || this.config.framework,
        practiceCount: practices.length,
        categories: [...new Set(practices.map(p => p.category))],
      },
    };
    
    documents.push(overviewDoc);
    this.documentCache.set(overviewDoc.id, overviewDoc);

    return documents;
  }

  /**
   * Parse markdown content into individual practices
   */
  private parsePractices(content: string, frontmatter: Record<string, unknown>): Practice[] {
    const practices: Practice[] = [];
    
    // Split by H2 headers
    const sections = content.split(/\n(?=## )/);
    
    for (const section of sections) {
      const match = section.match(/^## (.+)\n/);
      if (!match) continue;

      const title = match[1].trim();
      const sectionContent = section.slice(match[0].length);

      // Generate ID from title
      const id = this.slugify(title);

      // Extract category from section or infer from title/content
      const category = this.extractCategory(title, sectionContent, frontmatter);
      
      // Extract severity from markers in content
      const severity = this.extractSeverity(sectionContent, frontmatter);

      // Extract code examples
      const { goodExample, badExample } = this.extractExamples(sectionContent);

      // Extract description (first paragraph)
      const description = this.extractDescription(sectionContent);

      // Extract rationale if present
      const rationale = this.extractSection(sectionContent, 'rationale');

      // Extract lint rules from content
      const lintRules = this.extractLintRules(sectionContent);

      // Extract tags from frontmatter or content
      const tags = this.extractTags(sectionContent, frontmatter);

      practices.push({
        id,
        title,
        description,
        category,
        severity,
        language: frontmatter.language as string || 'general',
        framework: frontmatter.framework as string,
        goodExample,
        badExample,
        rationale,
        lintRules,
        tags,
      });
    }

    return practices;
  }

  /**
   * Extract category from content
   */
  private extractCategory(
    title: string,
    content: string,
    frontmatter: Record<string, unknown>
  ): PracticeCategory {
    // Check frontmatter
    if (frontmatter.category) {
      return frontmatter.category as PracticeCategory;
    }

    // Infer from title or content keywords
    const text = (title + ' ' + content).toLowerCase();
    
    if (text.includes('naming') || text.includes('convention')) return 'naming';
    if (text.includes('format') || text.includes('indent') || text.includes('spacing')) return 'formatting';
    if (text.includes('architect') || text.includes('pattern') || text.includes('structure')) return 'architecture';
    if (text.includes('test') || text.includes('spec') || text.includes('mock')) return 'testing';
    if (text.includes('security') || text.includes('vulnerab') || text.includes('auth')) return 'security';
    if (text.includes('performance') || text.includes('optimize') || text.includes('memory')) return 'performance';
    if (text.includes('document') || text.includes('comment') || text.includes('readme')) return 'documentation';
    if (text.includes('error') || text.includes('exception') || text.includes('throw')) return 'error-handling';
    if (text.includes('log') || text.includes('trace') || text.includes('debug')) return 'logging';
    if (text.includes('depend') || text.includes('package') || text.includes('import')) return 'dependency-management';

    return 'general';
  }

  /**
   * Extract severity from content markers
   */
  private extractSeverity(
    content: string,
    frontmatter: Record<string, unknown>
  ): PracticeSeverity {
    if (frontmatter.severity) {
      return frontmatter.severity as PracticeSeverity;
    }

    const lower = content.toLowerCase();
    
    if (lower.includes('must') || lower.includes('required') || lower.includes('always')) return 'error';
    if (lower.includes('should') || lower.includes('recommended')) return 'warning';
    if (lower.includes('could') || lower.includes('consider') || lower.includes('may')) return 'suggestion';
    
    return 'suggestion';
  }

  /**
   * Extract good and bad examples from content
   */
  private extractExamples(content: string): { goodExample?: string; badExample?: string } {
    let goodExample: string | undefined;
    let badExample: string | undefined;

    // Look for labeled code blocks
    const goodMatch = content.match(/(?:good|correct|do|preferred|recommended)[:\s]*\n```[\w]*\n([\s\S]*?)```/i);
    const badMatch = content.match(/(?:bad|incorrect|don'?t|avoid|wrong)[:\s]*\n```[\w]*\n([\s\S]*?)```/i);

    if (goodMatch) {
      goodExample = goodMatch[1].trim();
    }
    if (badMatch) {
      badExample = badMatch[1].trim();
    }

    // If no labeled examples, try to extract consecutive code blocks
    if (!goodExample && !badExample) {
      const codeBlocks = [...content.matchAll(/```[\w]*\n([\s\S]*?)```/g)];
      if (codeBlocks.length >= 2) {
        // Assume first is bad, second is good (common convention)
        const beforeFirst = content.slice(0, content.indexOf(codeBlocks[0][0])).toLowerCase();
        if (beforeFirst.includes('avoid') || beforeFirst.includes('bad') || beforeFirst.includes('don\'t')) {
          badExample = codeBlocks[0][1].trim();
          goodExample = codeBlocks[1][1].trim();
        } else {
          goodExample = codeBlocks[0][1].trim();
          if (codeBlocks.length > 1) {
            badExample = codeBlocks[1][1].trim();
          }
        }
      } else if (codeBlocks.length === 1) {
        goodExample = codeBlocks[0][1].trim();
      }
    }

    return { goodExample, badExample };
  }

  /**
   * Extract description (first paragraph after header)
   */
  private extractDescription(content: string): string {
    const paragraphs = content.split(/\n\n+/);
    
    for (const para of paragraphs) {
      const trimmed = para.trim();
      // Skip code blocks and headers
      if (!trimmed.startsWith('```') && !trimmed.startsWith('#') && trimmed.length > 0) {
        return trimmed;
      }
    }

    return content.slice(0, 200).trim();
  }

  /**
   * Extract a named section
   */
  private extractSection(content: string, sectionName: string): string | undefined {
    const regex = new RegExp(`### ${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n###|$)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Extract lint rules from content
   */
  private extractLintRules(content: string): string[] {
    const rules: string[] = [];
    
    // Common patterns for lint rules
    const patterns = [
      /@typescript-eslint\/[\w-]+/g,
      /eslint:?\s*([\w-]+)/gi,
      /\[`?([@\w/-]+)`?\]\s*rule/gi,
    ];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        rules.push(match[1] || match[0]);
      }
    }

    return [...new Set(rules)];
  }

  /**
   * Extract tags from content
   */
  private extractTags(content: string, frontmatter: Record<string, unknown>): string[] {
    const tags = new Set<string>();

    if (Array.isArray(frontmatter.tags)) {
      frontmatter.tags.forEach((t: unknown) => tags.add(String(t).toLowerCase()));
    }

    // Extract language identifiers from code blocks
    const langMatches = content.matchAll(/```(\w+)/g);
    for (const match of langMatches) {
      if (match[1] && match[1] !== 'text') {
        tags.add(match[1].toLowerCase());
      }
    }

    return Array.from(tags);
  }

  /**
   * Format practice into searchable content
   */
  private formatPracticeContent(practice: Practice): string {
    const parts: string[] = [
      `# ${practice.title}`,
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
      parts.push('', '## Bad Example', '```', practice.badExample, '```');
    }

    if (practice.lintRules && practice.lintRules.length > 0) {
      parts.push('', '## Related Lint Rules', practice.lintRules.join(', '));
    }

    return parts.join('\n');
  }

  /**
   * Generate URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Generate unique ID
   */
  protected generateId(relativePath: string, practiceId: string): string {
    return `${this.name}:${relativePath}#${practiceId}`;
  }
}
