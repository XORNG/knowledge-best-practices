# XORNG Best Practices Knowledge Provider

A knowledge retrieval sub-agent for the XORNG framework that provides coding standards, patterns, and best practices.

## Overview

This provider enables AI agents to retrieve relevant coding standards and practices:

- **Multi-Format Support** - Load from Markdown or structured JSON/YAML
- **Category Filtering** - Filter by naming, architecture, security, etc.
- **Severity Levels** - Distinguish between must-follow and suggestions
- **Code Examples** - Good and bad examples for each practice
- **Lint Rule Mapping** - Connect practices to ESLint/other lint rules

## Installation

```bash
npm install
npm run build
```

## Usage

### As MCP Server

```bash
# Set practices path
export PRACTICES_PATH=/path/to/practices

# Start server
npm start
```

### Configuration

Create a config file or use environment variables:

```json
{
  "sources": [
    {
      "name": "team-standards",
      "type": "local",
      "path": "./practices",
      "format": "markdown",
      "language": "typescript"
    },
    {
      "name": "structured-rules",
      "type": "local",
      "path": "./rules",
      "format": "yaml"
    }
  ],
  "chunkSize": 1000,
  "chunkOverlap": 200,
  "maxResults": 10,
  "minScore": 0.3
}
```

```bash
export XORNG_PRACTICES_CONFIG=/path/to/config.json
npm start
```

## Practice Document Formats

### Markdown Format

```markdown
---
language: typescript
framework: react
---

# TypeScript Best Practices

## Use explicit return types for public functions

Functions that are exported or part of a public API should have explicit return types for better documentation and type safety.

**Rationale:** Explicit types catch refactoring errors and improve IDE support.

Good:
```typescript
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

Bad:
```typescript
export function calculateTotal(items: Item[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

Related lint rules: @typescript-eslint/explicit-function-return-type
```

### Structured Format (YAML)

```yaml
name: TypeScript Style Guide
version: "1.0"
language: typescript
practices:
  - id: explicit-return-types
    title: Use explicit return types for public functions
    description: Functions that are exported should have explicit return types
    category: architecture
    severity: warning
    goodExample: |
      export function getUser(id: string): User {
        return db.findUser(id);
      }
    badExample: |
      export function getUser(id: string) {
        return db.findUser(id);
      }
    rationale: Explicit types catch refactoring errors
    lintRules:
      - "@typescript-eslint/explicit-function-return-type"
    tags:
      - types
      - public-api
```

## Available Tools

### `search-practices`
Search practices with advanced filtering.

```json
{
  "query": "error handling async",
  "category": "error-handling",
  "language": "typescript",
  "severity": "error",
  "limit": 5
}
```

### `get-category-practices`
Get all practices for a category.

```json
{
  "category": "security",
  "language": "javascript",
  "limit": 20
}
```

### `get-examples`
Get code examples for practices.

```json
{
  "query": "async error handling",
  "language": "typescript",
  "goodOnly": false
}
```

### `get-lint-rule-practices`
Get practices for a lint rule.

```json
{
  "ruleId": "@typescript-eslint/no-floating-promises"
}
```

### `list-categories`
List categories with practice counts.

```json
{
  "language": "typescript"
}
```

### `get-practice`
Get specific practice by ID.

```json
{
  "practiceId": "team-standards:naming.md#use-descriptive-names"
}
```

### Standard Knowledge Tools
- `search` - Basic search
- `retrieve` - Get by ID
- `list-sources` - List sources
- `sync` - Re-sync
- `stats` - Statistics

## Practice Categories

| Category | Description |
|----------|-------------|
| `naming` | Naming conventions |
| `formatting` | Code formatting, indentation |
| `architecture` | Design patterns, structure |
| `testing` | Test practices, coverage |
| `security` | Security best practices |
| `performance` | Optimization practices |
| `documentation` | Comments, docs |
| `error-handling` | Exception handling |
| `logging` | Logging practices |
| `dependency-management` | Package management |
| `general` | General practices |

## Severity Levels

| Level | Meaning |
|-------|---------|
| `error` | Must follow - violations are bugs |
| `warning` | Should follow - strong recommendation |
| `suggestion` | Could follow - nice to have |
| `info` | Informational - context only |

## Docker

```bash
# Build
docker build -t xorng/knowledge-best-practices .

# Run with mounted practices
docker run -v /path/to/practices:/practices xorng/knowledge-best-practices
```

## Example Output

### Search Results

```json
{
  "chunks": [
    {
      "chunk": {
        "id": "team-standards:error-handling.md#always-catch-async-errors",
        "content": "# Always catch async errors\n\nAsync functions...",
        "metadata": {
          "category": "error-handling",
          "severity": "error",
          "language": "typescript",
          "lintRules": ["@typescript-eslint/no-floating-promises"]
        }
      },
      "score": 0.92
    }
  ],
  "totalCount": 3
}
```

### Examples Output

```json
{
  "examples": [
    {
      "practice": "Handle all Promise rejections",
      "goodExample": "await doSomething().catch(handleError);",
      "badExample": "doSomething();",
      "language": "typescript"
    }
  ]
}
```

## License

MIT
