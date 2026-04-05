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

## Danmaku System Architecture

The danmaku renderer uses a simple queue-based system:

```
┌──────────────────────────────────────────────────────────────┐
│                    DanmakuRenderer                           │
├──────────────────────────────────────────────────────────────┤
│  Message Queue                                               │
│  └── Simple FIFO queue for incoming messages                 │
├──────────────────────────────────────────────────────────────┤
│  Pre-installed BitmapFonts                                   │
│  ├── danmaku-standard (white)                                │
│  ├── danmaku-member (green)                                  │
│  ├── danmaku-moderator (blue)                                │
│  └── danmaku-superchat (gold)                                │
├──────────────────────────────────────────────────────────────┤
│  Image Cache                                                 │
│  └── Map<url, Texture> for emoji reuse                       │
├──────────────────────────────────────────────────────────────┤
│  Round-robin Lane Assignment                                 │
│  └── Simple lane cycling (no collision detection)            │
└──────────────────────────────────────────────────────────────┘
```

## Simple Queue-Based Flow

### Processing Logic

```typescript
// 1. Add message to queue
addMessage(message: ChatMessage) {
  this.messageQueue.push(message)
}

// 2. Process one message per frame
processQueue() {
  const message = this.messageQueue.shift()
  if (message) {
    this.renderComment(message)
  }
}

// 3. Animate all comments
animate() {
  this.processQueue() // Process one message
  
  // Move all comments left
  for (const comment of this.activeComments) {
    comment.container.x -= comment.speed
    
    // Remove if off-screen
    if (comment.container.x < -comment.width - 50) {
      comment.container.destroy()
      this.activeComments.delete(comment)
    }
  }
}
```

## Lane Assignment

### Simple Round-Robin

```typescript
// No collision detection - just cycle through lanes
const laneIndex = this.nextLaneIndex
this.nextLaneIndex = (this.nextLaneIndex + 1) % totalLanes

// Position based on lane index
comment.y = laneIndex * LANE_HEIGHT + 12
```

### Lane Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Lane height | 36px | Vertical spacing |
| Lane count | Based on video height | Minimum 3 lanes |
| Assignment | Round-robin | Simple cycling |

## Image Caching

### Cache System

```typescript
class DanmakuRenderer {
  private imageCache = new Map<string, Texture>()
  private pendingLoads = new Map<string, Promise<Texture>>()

  async getCachedTexture(imgUrl: string): Promise<Texture | null> {
    // Return cached if available
    if (this.imageCache.has(imgUrl)) {
      return this.imageCache.get(imgUrl)!
    }
    
    // Return pending promise if loading
    if (this.pendingLoads.has(imgUrl)) {
      return this.pendingLoads.get(imgUrl)!
    }
    
    // Start new load
    const promise = this.loadImageTexture(imgUrl)
    this.pendingLoads.set(imgUrl, promise)
    
    const texture = await promise
    this.imageCache.set(imgUrl, texture)
    this.pendingLoads.delete(imgUrl)
    return texture
  }
}
```

### Benefits

- Images only downloaded once per URL
- Shared textures reduce GPU memory
- Faster rendering for repeated emojis

## Pre-installed BitmapFonts

### Font Setup

```typescript
function installDanmakuFonts() {
  const baseStyle = {
    fontSize: 24,
    fontFamily: 'Inter, system-ui, sans-serif',
    stroke: { color: '#000000', width: 3 },
    dropShadow: { color: '#000000', blur: 4, distance: 0 },
  }

  BitmapFont.install({
    name: 'danmaku-standard',
    style: { ...baseStyle, fill: 0xffffff },
  })
  
  BitmapFont.install({
    name: 'danmaku-member',
    style: { ...baseStyle, fill: 0x22c55e },
  })
  
  // ... etc
}
```

### Using Pre-installed Fonts

```typescript
const textSprite = new BitmapText({
  text: displayText,
  style: { fontFamily: 'danmaku-standard' },
})
```

**Benefits:**
- No dynamic font creation (avoids warnings)
- Faster text rendering
- Consistent styling

## Animation Loop

### Frame Processing

```typescript
app.ticker.add(() => {
  // 1. Process one message from queue
  processQueue()
  
  // 2. Move all comments
  for (const comment of activeComments) {
    comment.container.x -= comment.speed
    
    // 3. Remove off-screen
    if (comment.container.x < -comment.width - 50) {
      comment.container.destroy()
      activeComments.delete(comment)
    }
  }
  
  // 4. Periodic resize check
  if (frameCount % 30 === 0) {
    updateLanePositions()
  }
})
```

## Example: Basic Danmaku Setup

```typescript
import { Application, BitmapText, Container, BitmapFont } from 'pixi.js'

// Pre-install fonts
BitmapFont.install({
  name: 'danmaku-font',
  style: { fontSize: 24, fill: 0xffffff },
})

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
  const text = new BitmapText({
    text: message,
    style: { fontFamily: 'danmaku-font' }
  })
  text.x = app.screen.width
  text.y = Math.random() * app.screen.height
  danmakuLayer.addChild(text)
}
```

## Full Implementation

See `src/entrypoints/overlay.content/danmaku.ts` for the complete implementation including:

- **Queue System** - Simple FIFO message processing
- **BitmapFont Pre-installation** - Avoids dynamic font creation
- **Image Caching** - Reuse textures by URL
- **Round-robin Lanes** - Simple lane assignment
```

## Resources

- **PixiJS v8 Docs:** https://pixijs.com/llms.txt
- **WebGPU Support:** Requires Chrome 113+ with WebGPU enabled
