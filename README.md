# DanmakuYT

A browser extension built with **WXT**, **React**, **Radix UI**, and **Tailwind CSS**.

## Features

- 🚀 Built with modern web technologies
- 🎨 Beautiful UI with Radix UI primitives and Tailwind CSS
- 📦 TypeScript support
- 🔄 Hot reload during development
- 📱 Side panel interface
- 🔧 Content script injection
- ⚡ Powered by [Bun](https://bun.sh/) - fast JavaScript runtime & package manager

## Development

### Prerequisites

- [Bun](https://bun.sh/) 1.0+

### Installation

```bash
bun install
```

### Development

```bash
bun run dev
```

This will start the development server and open Chrome with the extension loaded.

### Build

```bash
bun run build
```

### Create Zip for Distribution

```bash
bun run zip
```

### Type Checking

```bash
bun run check
```

## Project Structure

```
├── src/
│   ├── assets/           # Static assets (CSS, images)
│   ├── components/       # React components
│   │   └── ui/          # UI components (Button, Input, etc.)
│   ├── entrypoints/     # WXT entrypoints
│   │   ├── background.ts    # Background script
│   │   ├── content.ts       # Content script
│   │   └── sidepanel/       # Side panel UI
│   │       ├── index.html
│   │       ├── main.tsx
│   │       └── App.tsx
│   ├── lib/            # Utility functions
│   └── types/          # TypeScript types
├── public/             # Public assets
│   └── _locales/       # Localization files
├── package.json
├── tsconfig.json
├── wxt.config.ts
└── components.json     # shadcn/ui config
```

## Technologies

- [WXT](https://wxt.dev/) - Web Extension Toolkit
- [React](https://react.dev/) - UI library
- [Radix UI](https://www.radix-ui.com/) - Headless UI components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Bun](https://bun.sh/) - Fast JavaScript runtime & package manager

## License

MIT
