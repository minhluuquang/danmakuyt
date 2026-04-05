---
summary: PixiJS v8 WebGPU integration for rendering danmaku (bullet comments)
read_when: ['working with PixiJS', 'implementing danmaku rendering', 'adding canvas animation']
---

# PixiJS Integration

**CRITICAL: This project uses PixiJS v8 with WebGPU only.** Do not use WebGL fallback.

## Installation

```bash
bun add pixi.js@^8.0.0
```

## Renderer Setup

Use the `Application` class with **WebGPU only**:

```typescript
import { Application } from 'pixi.js'

const app = new Application({
  preferWebGLVersion: 2, // Force WebGPU
  // Never set webgl as fallback
})
```

## Canvas Integration

Append the canvas to the DOM in content script or sidepanel:

```typescript
const canvas = document.createElement('canvas')
// Configure Pixi application with the canvas
await app.init({
  canvas,
  // WebGPU specific options
})
container.appendChild(canvas)
```

## Lifecycle Management

Clean up on extension reload/update:

```typescript
export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const app = new Application()
    // ... setup
    
    ctx.onInvalidated(() => {
      app.destroy(true) // Remove DOM elements, stop animations
    })
  }
})
```

## Key PixiJS v8 Concepts

| Concept | Purpose |
|---------|---------|
| **Container** | Group display objects |
| **Text** / **BitmapText** | Render comment text |
| **Ticker** | Animation loop for moving comments |
| **ParticleContainer** | If rendering many simultaneous comments |

## Example: Basic Danmaku Setup

```typescript
import { Application, Text, Container } from 'pixi.js'

// Create app
const app = new Application()
await app.init({
  canvas: document.createElement('canvas'),
  resizeTo: window,
})

// Danmaku container
const danmakuLayer = new Container()
app.stage.addChild(danmakuLayer)

// Animation loop
app.ticker.add(() => {
  // Move all comments from right to left
  danmakuLayer.children.forEach(text => {
    text.x -= 2 // Speed
    if (text.x < -text.width) {
      text.destroy()
    }
  })
})

// Add comment
function addComment(message: string) {
  const text = new Text({
    text: message,
    style: { fontSize: 20, fill: 0xffffff }
  })
  text.x = app.screen.width
  text.y = Math.random() * app.screen.height
  danmakuLayer.addChild(text)
}
```

## Resources

- **PixiJS v8 Docs:** https://pixijs.com/llms.txt
- **WebGPU Support:** Requires Chrome 113+ with WebGPU enabled
