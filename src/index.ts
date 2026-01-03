import { startKnowledgeProvider } from '@xorng/template-knowledge';
import { createLogger } from '@xorng/template-base';
import { BestPracticesProvider } from './provider/BestPracticesProvider.js';
import type { ProviderConfig } from './types/index.js';

const logger = createLogger('info', 'knowledge-best-practices');

// Default configuration
const defaultConfig: ProviderConfig = {
  sources: [
    {
      name: 'local-practices',
      type: 'local',
      path: process.env.PRACTICES_PATH || './practices',
      format: 'markdown',
    },
  ],
  chunkSize: 1000,
  chunkOverlap: 200,
  maxResults: 10,
  minScore: 0.3,
  syncOnStart: true,
};

// Load configuration
async function loadConfig(): Promise<ProviderConfig> {
  const configPath = process.env.XORNG_PRACTICES_CONFIG;
  
  if (configPath) {
    try {
      // Dynamic import for JSON/JS config (ES module compatible)
      const fs = await import('fs/promises');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      logger.info({ configPath }, 'Loaded configuration from file');
      return { ...defaultConfig, ...config };
    } catch (error) {
      logger.warn({ configPath, error }, 'Failed to load config, using defaults');
    }
  }

  // Check for additional sources
  const additionalSources = process.env.XORNG_PRACTICES_SOURCES;
  if (additionalSources) {
    try {
      const sources = JSON.parse(additionalSources);
      return { ...defaultConfig, sources: [...defaultConfig.sources, ...sources] };
    } catch (error) {
      logger.warn('Failed to parse XORNG_PRACTICES_SOURCES');
    }
  }

  return defaultConfig;
}

// Main entry point
async function main(): Promise<void> {
  const config = await loadConfig();
  
  logger.info({
    sourceCount: config.sources.length,
    sources: config.sources.map(s => s.name),
  }, 'Starting best practices knowledge provider');

  const provider = new BestPracticesProvider(config);
  
  await startKnowledgeProvider(provider);
}

main().catch((error) => {
  logger.error(error, 'Failed to start best practices provider');
  process.exit(1);
});

// Export for programmatic use
export { BestPracticesProvider } from './provider/BestPracticesProvider.js';
export { MarkdownPracticeSource, StructuredPracticeSource } from './sources/index.js';
export * from './types/index.js';
