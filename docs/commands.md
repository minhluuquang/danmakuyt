---
summary: Available bun commands for development, building, and distribution
read_when:
  ["starting development", "building for production", "creating release"]
---

# Commands

## Development

```bash
# Install dependencies
bun install

# Development with hot reload (opens Chrome automatically)
bun run dev
```

## Building

```bash
# Type check only
bun run check

# Production build
bun run build

# Create distribution zip
bun run zip
```

## Documentation

```bash
# List all documentation with summaries
bun run docs:list
```

## Post-Install

After installing dependencies, WXT prepares types:

```bash
bun run postinstall
```

This generates the `.wxt/` directory with TypeScript configurations.
