---
summary: Critical patterns for content scripts, messaging, and storage
read_when: ['adding content script features', 'implementing cross-context communication', 'storing extension data']
---

# Critical Patterns

## Content Script UI

When injecting UI into pages:

```typescript
export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui', // Required for Tailwind in content scripts
  async main(ctx) {
    // Cleanup on extension reload/update
    ctx.onInvalidated(() => {
      // Remove DOM elements, stop animations
    })
  }
})
```

## Messaging

Background ↔ Content ↔ Sidepanel communication:

```typescript
// Send message
browser.runtime.sendMessage({ type: 'MY_ACTION', payload: {} })

// Receive (in background.ts)
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'MY_ACTION') {
    // Handle
    sendResponse({ success: true })
  }
  return true // Keep channel open for async
})
```

## Storage with WXT

```typescript
import { storage } from 'wxt/utils/storage'

const settings = storage.defineItem<number>('local:settings', {
  defaultValue: {}
})
```

## UI Components

Located in `src/components/ui/`. Built with:

- **Radix UI** primitives (Slot, Switch, Label, Separator, Dialog, Tooltip, etc.)
- **Tailwind CSS 4** with CSS variables (see `src/assets/index.css`)
- **class-variance-authority** for component variants
- **lucide-react** for icons

## Entrypoints (WXT Convention)

All entrypoints live in `src/entrypoints/` and are auto-discovered by WXT:

- **`background.ts`** - Service worker. Use `browser.runtime.onMessage` for cross-context communication. Keep listeners synchronous at top level.
- **`content.ts`** - Injected into pages. Uses `defineContentScript({ matches: ['<all_urls>'] })`. CSS injected via `cssInjectionMode: 'ui'`.
- **`sidepanel/`** - Chrome side panel UI. React app mounted at `index.html` → `main.tsx` → `App.tsx`.

## State Management

- Use `browser.storage` (WXT wraps this) for persistent settings
- React state for ephemeral UI state
