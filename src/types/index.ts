import { z } from 'zod';

/**
 * Practice category types
 */
export type PracticeCategory =
  | 'naming'
  | 'formatting'
  | 'architecture'
  | 'testing'
  | 'security'
  | 'performance'
  | 'documentation'
  | 'error-handling'
  | 'logging'
  | 'dependency-management'
  | 'general';

/**
 * Severity levels for practices
 */
export type PracticeSeverity =
  | 'error'      // Must follow
  | 'warning'    // Should follow
  | 'suggestion' // Could follow
  | 'info';      // For context only

/**
 * Programming language identifiers
 */
export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin'
  | 'general'; // Language-agnostic

/**
 * Schema for a single practice/rule
 */
export const PracticeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum([
    'naming', 'formatting', 'architecture', 'testing', 'security',
    'performance', 'documentation', 'error-handling', 'logging',
    'dependency-management', 'general'
  ]),
  severity: z.enum(['error', 'warning', 'suggestion', 'info']).default('suggestion'),
  language: z.string().default('general'),
  framework: z.string().optional(),
  goodExample: z.string().optional(),
  badExample: z.string().optional(),
  rationale: z.string().optional(),
  exceptions: z.array(z.string()).optional(),
  relatedPractices: z.array(z.string()).optional(),
  lintRules: z.array(z.string()).optional(),
  references: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export type Practice = z.infer<typeof PracticeSchema>;

/**
 * Schema for a style guide document
 */
export const StyleGuideSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  language: z.string(),
  framework: z.string().optional(),
  description: z.string().optional(),
  practices: z.array(PracticeSchema),
  metadata: z.record(z.unknown()).optional(),
});

export type StyleGuide = z.infer<typeof StyleGuideSchema>;

/**
 * Pattern schema for design patterns and architectural patterns
 */
export const PatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['creational', 'structural', 'behavioral', 'architectural', 'concurrency']),
  description: z.string(),
  problem: z.string(),
  solution: z.string(),
  applicability: z.array(z.string()),
  consequences: z.object({
    benefits: z.array(z.string()),
    drawbacks: z.array(z.string()),
  }),
  implementation: z.object({
    language: z.string(),
    code: z.string(),
  }).optional(),
  relatedPatterns: z.array(z.string()).optional(),
  references: z.array(z.string()).optional(),
});

export type Pattern = z.infer<typeof PatternSchema>;

/**
 * Source configuration for best practices
 */
export const SourceConfigSchema = z.object({
  name: z.string(),
  type: z.enum(['local', 'git', 'url']),
  path: z.string(),
  format: z.enum(['markdown', 'json', 'yaml']).default('markdown'),
  language: z.string().optional(),
  framework: z.string().optional(),
});

export type SourceConfig = z.infer<typeof SourceConfigSchema>;

/**
 * Provider configuration
 */
export const ProviderConfigSchema = z.object({
  sources: z.array(SourceConfigSchema),
  chunkSize: z.number().default(1000),
  chunkOverlap: z.number().default(200),
  maxResults: z.number().default(10),
  minScore: z.number().default(0.3),
  syncOnStart: z.boolean().default(true),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/**
 * Query for best practices
 */
export const PracticeQuerySchema = z.object({
  query: z.string(),
  category: z.enum([
    'naming', 'formatting', 'architecture', 'testing', 'security',
    'performance', 'documentation', 'error-handling', 'logging',
    'dependency-management', 'general'
  ]).optional(),
  language: z.string().optional(),
  framework: z.string().optional(),
  severity: z.enum(['error', 'warning', 'suggestion', 'info']).optional(),
  limit: z.number().optional(),
});

export type PracticeQuery = z.infer<typeof PracticeQuerySchema>;
