# DanmakuYT - Agent Instructions

Browser extension for YouTube danmaku (bullet comments) using WXT, React, Radix UI, Tailwind CSS, and PixiJS.

## Repository Information

- **Owner:** Leo
- **Tech Stack:** WXT, React, TypeScript, Tailwind CSS 4, Radix UI, PixiJS v8 (WebGPU)
- **Package Manager:** Bun
- **Extension Type:** Chrome browser extension with PixiJS canvas overlay

## Quick Start

```bash
# Install dependencies
bun install

# Development with hot reload (opens Chrome automatically)
bun run dev

# Type check only
bun run check

# Production build
bun run build

# Create distribution zip
bun run zip

# List documentation
bun run docs:list
```

## Documentation

Run `bun run docs:list` to see available documentation. Read relevant docs before coding:

- **New to project:** Read `docs/architecture.md`, `docs/commands.md`
- **Working with PixiJS:** Read `docs/pixijs.md`
- **Adding UI/components:** Read `docs/patterns.md`
- **Debugging issues:** Read `docs/common-issues.md`

## Path Aliases

- `@/` maps to `src/` (configured in `tsconfig.json` and `wxt.config.ts`)

## Configuration Files

| File | Purpose |
|------|---------|
| `wxt.config.ts` | WXT + Vite config. Chrome profile in `.wxt/chrome-data`. |
| `tsconfig.json` | Extends `.wxt/tsconfig.json`. Path alias `@/*` → `src/*`. |
| `components.json` | shadcn/ui config. New York style, CSS variables. |

## External Documentation

- **WXT:** https://wxt.dev/llms.txt
- **PixiJS:** https://pixijs.com/llms.txt
