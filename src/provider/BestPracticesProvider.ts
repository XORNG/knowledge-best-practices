import {
  BaseKnowledgeProvider,
  type KnowledgeQuery,
  type KnowledgeResult,
  type KnowledgeProviderConfig,
  type Document,
} from '@xorng/template-knowledge';
import { createToolHandler, type SubAgentMetadata, type SubAgentConfig } from '@xorng/template-base';
import { z } from 'zod';
import type { ProviderConfig, PracticeQuery, SourceConfig, Practice, PracticeCategory, PracticeSeverity } from '../types/index.js';
import { MarkdownPracticeSource } from '../sources/MarkdownPracticeSource.js';
import { StructuredPracticeSource } from '../sources/StructuredPracticeSource.js';

/**
 * Best Practices Knowledge Provider
 * 
 * Provides coding standards, patterns, and guidelines retrieval:
 * - Searches across multiple style guide sources
 * - Supports markdown and structured (JSON/YAML) formats
 * - Filters by category, language, severity
 * - Returns actionable practices with examples
 */
export class BestPracticesProvider extends BaseKnowledgeProvider {
  private practiceConfig: ProviderConfig;

  constructor(
    config: ProviderConfig,
    metadata?: Partial<SubAgentMetadata>,
    subAgentConfig?: SubAgentConfig
  ) {
    const fullMetadata: SubAgentMetadata = {
      name: 'knowledge-best-practices',
      version: '0.1.0',
      description: 'Best practices knowledge provider for coding standards and patterns',
      capabilities: ['retrieve', 'search'],
      ...metadata,
    };

    const knowledgeConfig: KnowledgeProviderConfig = {
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
      maxResults: config.maxResults,
      minScore: config.minScore,
    };

    super(fullMetadata, subAgentConfig, knowledgeConfig);
    
    this.practiceConfig = config;

    // Register sources
    this.setupSources(config.sources);

    // Register practice-specific tools
    this.registerPracticeTools();
  }

  /**
   * Initialize sources from configuration
   */
  private setupSources(sources: SourceConfig[]): void {
    for (const sourceConfig of sources) {
      let source;
      
      switch (sourceConfig.format || 'markdown') {
        case 'markdown':
          source = new MarkdownPracticeSource(sourceConfig);
          break;
        case 'json':
        case 'yaml':
          source = new StructuredPracticeSource(sourceConfig);
          break;
        default:
          this.logger.warn({ source: sourceConfig.name }, 'Unknown format, defaulting to markdown');
          source = new MarkdownPracticeSource(sourceConfig);
      }

      this.registerSource(source);
    }
  }

  /**
   * Search practices with filters
   */
  async searchPractices(query: PracticeQuery): Promise<KnowledgeResult> {
    // Build filters from query
    const filters: KnowledgeQuery['filters'] = {};
    
    if (query.language) {
      filters.language = query.language;
    }

    // Perform base search
    const result = await this.search({
      query: query.query,
      filters,
      limit: query.limit || this.practiceConfig.maxResults,
    });

    // Additional filtering by category/severity
    if (query.category || query.severity || query.framework) {
      result.chunks = result.chunks.filter(item => {
        const meta = item.chunk.metadata;
        if (query.category && meta.category !== query.category) {
          return false;
        }
        if (query.severity && meta.severity !== query.severity) {
          return false;
        }
        if (query.framework && meta.framework !== query.framework) {
          return false;
        }
        return true;
      });
      result.totalCount = result.chunks.length;
    }

    return result;
  }

  /**
   * Get practices for a specific category
   */
  async getPracticesByCategory(
    category: PracticeCategory,
    language?: string,
    options?: { limit?: number; severity?: PracticeSeverity }
  ): Promise<Document[]> {
    const allDocs = this.store.all();
    
    return allDocs.filter(doc => {
      if (doc.type !== 'practice') return false;
      if (doc.metadata.category !== category) return false;
      if (language && doc.metadata.language !== language && doc.metadata.language !== 'general') return false;
      if (options?.severity && doc.metadata.severity !== options.severity) return false;
      return true;
    }).slice(0, options?.limit || 20);
  }

  /**
   * Get practices related to specific lint rules
   */
  async getPracticesForLintRule(ruleId: string): Promise<Document[]> {
    const allDocs = this.store.all();
    
    return allDocs.filter(doc => {
      const lintRules = doc.metadata.lintRules as string[] || [];
      return lintRules.some(rule => 
        rule.toLowerCase().includes(ruleId.toLowerCase())
      );
    });
  }

  /**
   * Get code examples for a practice
   */
  async getExamples(practiceQuery: string, options?: {
    language?: string;
    goodOnly?: boolean;
  }): Promise<Array<{ 
    practice: string;
    goodExample?: string;
    badExample?: string;
    language: string;
  }>> {
    const result = await this.searchPractices({
      query: practiceQuery,
      language: options?.language,
      limit: 10,
    });

    return result.chunks
      .filter(item => item.chunk.metadata.hasGoodExample || item.chunk.metadata.hasBadExample)
      .map(item => {
        const content = item.chunk.content;
        const goodMatch = content.match(/## Good Example\s*```[\w]*\n([\s\S]*?)```/);
        const badMatch = content.match(/## Bad Example[^\n]*\s*```[\w]*\n([\s\S]*?)```/);

        return {
          practice: item.chunk.title || item.chunk.id,
          goodExample: goodMatch?.[1]?.trim(),
          badExample: options?.goodOnly ? undefined : badMatch?.[1]?.trim(),
          language: item.chunk.metadata.language as string,
        };
      })
      .filter(e => e.goodExample || (!options?.goodOnly && e.badExample));
  }

  /**
   * Register practice-specific MCP tools
   */
  private registerPracticeTools(): void {
    // Search practices tool
    this.registerTool(createToolHandler({
      name: 'search-practices',
      description: 'Search coding best practices and style guides',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        category: z.enum([
          'naming', 'formatting', 'architecture', 'testing', 'security',
          'performance', 'documentation', 'error-handling', 'logging',
          'dependency-management', 'general'
        ]).optional().describe('Filter by practice category'),
        language: z.string().optional().describe('Filter by programming language'),
        framework: z.string().optional().describe('Filter by framework'),
        severity: z.enum(['error', 'warning', 'suggestion', 'info']).optional()
          .describe('Filter by severity level'),
        limit: z.number().optional().describe('Maximum results'),
      }),
      handler: async (input) => {
        return this.searchPractices(input);
      },
    }));

    // Get category practices
    this.registerTool(createToolHandler({
      name: 'get-category-practices',
      description: 'Get all practices for a specific category',
      inputSchema: z.object({
        category: z.enum([
          'naming', 'formatting', 'architecture', 'testing', 'security',
          'performance', 'documentation', 'error-handling', 'logging',
          'dependency-management', 'general'
        ]).describe('Practice category'),
        language: z.string().optional().describe('Programming language'),
        severity: z.enum(['error', 'warning', 'suggestion', 'info']).optional(),
        limit: z.number().optional().default(20),
      }),
      handler: async (input) => {
        const practices = await this.getPracticesByCategory(
          input.category,
          input.language,
          { limit: input.limit, severity: input.severity }
        );
        return {
          practices: practices.map(p => ({
            id: p.id,
            title: p.title,
            description: p.content.slice(0, 200) + '...',
            severity: p.metadata.severity,
            language: p.metadata.language,
          })),
          count: practices.length,
        };
      },
    }));

    // Get examples
    this.registerTool(createToolHandler({
      name: 'get-examples',
      description: 'Get code examples (good and bad) for practices',
      inputSchema: z.object({
        query: z.string().describe('What you need examples for'),
        language: z.string().optional().describe('Programming language'),
        goodOnly: z.boolean().optional().default(false).describe('Only return good examples'),
      }),
      handler: async (input) => {
        const examples = await this.getExamples(input.query, {
          language: input.language,
          goodOnly: input.goodOnly,
        });
        return { examples };
      },
    }));

    // Get practices for lint rule
    this.registerTool(createToolHandler({
      name: 'get-lint-rule-practices',
      description: 'Get practices associated with a specific lint rule',
      inputSchema: z.object({
        ruleId: z.string().describe('Lint rule ID (e.g., "no-unused-vars", "@typescript-eslint/explicit-function-return-type")'),
      }),
      handler: async (input) => {
        const practices = await this.getPracticesForLintRule(input.ruleId);
        return {
          practices: practices.map(p => ({
            id: p.id,
            title: p.title,
            content: p.content,
            category: p.metadata.category,
            severity: p.metadata.severity,
          })),
          count: practices.length,
        };
      },
    }));

    // List available categories
    this.registerTool(createToolHandler({
      name: 'list-categories',
      description: 'List all practice categories with counts',
      inputSchema: z.object({
        language: z.string().optional().describe('Filter by language'),
      }),
      handler: async (input) => {
        const allDocs = this.store.all().filter(d => d.type === 'practice');
        const filtered = input.language 
          ? allDocs.filter(d => d.metadata.language === input.language || d.metadata.language === 'general')
          : allDocs;

        const categories = new Map<string, { count: number; severities: Record<string, number> }>();

        for (const doc of filtered) {
          const cat = doc.metadata.category as string;
          const sev = doc.metadata.severity as string;
          
          if (!categories.has(cat)) {
            categories.set(cat, { count: 0, severities: {} });
          }
          
          const catData = categories.get(cat)!;
          catData.count++;
          catData.severities[sev] = (catData.severities[sev] || 0) + 1;
        }

        return {
          categories: Array.from(categories.entries()).map(([name, data]) => ({
            name,
            ...data,
          })),
          totalPractices: filtered.length,
        };
      },
    }));

    // Get practice by ID
    this.registerTool(createToolHandler({
      name: 'get-practice',
      description: 'Get a specific practice by ID',
      inputSchema: z.object({
        practiceId: z.string().describe('The practice ID'),
      }),
      handler: async (input) => {
        const doc = this.store.get(input.practiceId);
        if (!doc) {
          return { error: 'Practice not found', practiceId: input.practiceId };
        }
        return {
          id: doc.id,
          title: doc.title,
          content: doc.content,
          category: doc.metadata.category,
          severity: doc.metadata.severity,
          language: doc.metadata.language,
          framework: doc.metadata.framework,
          lintRules: doc.metadata.lintRules,
          tags: doc.metadata.tags,
        };
      },
    }));
  }
}
