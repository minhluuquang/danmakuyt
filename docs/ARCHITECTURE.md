---
summary: System architecture, data flow, and key design decisions for DanmakuYT
read_when: ['new to project', 'understanding data flow', 'architectural changes']
---

# Architecture

## Overview

DanmakuYT is a browser extension that captures YouTube live stream chat messages and renders them as danmaku (bullet comments) overlay on the video player. It uses a **DOM-based approach** to read chat messages without intercepting network requests, ensuring stability and avoiding conflicts with YouTube's video player.

## Components

```
┌─────────────────────────────────────────────────────────────┐
│                    YouTube Live Stream                       │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │   Main Page         │  │  Live Chat Iframe            │  │
│  │   (Video Player)    │  │  ┌────────────────────────┐  │  │
│  │  ┌───────────────┐  │  │  │ yt-live-chat-app     │  │  │
│  │  │ PixiJS Canvas │  │  │  │  ├─ chat messages    │  │  │
│  │  │  Overlay      │  │  │  │  ├─ new messages     │  │  │
│  │  │  • Danmaku    │  │  │  │  └─ (DOM mutations)  │  │  │
│  │  │    texts      │  │  │  └────────────────────────┘  │  │
│  │  └───────────────┘  │  └──────────────────────────────┘  │
│  └─────────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
                               │
                               │ MutationObserver watches DOM
                               │ (NO network interception)
                               ▼
                     ┌─────────────────────┐
                     │  yt-chat-inject.js  │
                     │  (Injected Script)  │
                     │                     │
                     │  • Watches DOM      │
                     │  • Extracts msgs    │
                     │  • Detects types    │
                     │    (member/mod/SC)  │
                     │  • Sends via        │
                     │    postMessage      │
                     └─────────────────────┘
                               │
                               │ window.postMessage()
                               ▼
                     ┌─────────────────────┐
                     │   content.ts        │
                     │   (Content Script)  │
                     │   (iframe only)     │
                     │                     │
                     │  • Receives msgs    │
                     │  • Forwards to      │
                     │    background       │
                     └─────────────────────┘
                               │
                               │ browser.runtime.sendMessage()
                               ▼
                     ┌─────────────────────┐
                     │   background.ts     │
                     │  (Service Worker)   │
                     │                     │
                     │  • Stores in memory │
                     │  • Routes to        │
                     │    video page       │
                     └─────────────────────┘
                               │
                               │ browser.tabs.sendMessage()
                               ▼
                     ┌─────────────────────┐
                     │  overlay.content/ │
                     │  (Content Script)   │
                     │  (video page only)  │
                     │                     │
                     │  • PixiJS overlay   │
                     │  • BitmapText       │
                     │  • Lane management  │
                     └─────────────────────┘
```

## Data Flow

### 1. Message Detection (DOM-Based)

**Location:** `public/yt-chat-inject.js` in live chat iframe

```
YouTube renders chat message
        ↓
DOM element created: <yt-live-chat-text-message-renderer>
        ↓
MutationObserver detects DOM change
        ↓
extractMessages() reads from DOM:
  - author (from #author-name)
  - text (from #message)
  - avatar (from #img)
  - type (standard/member/moderator/superchat)
  - timestamp (current time)
```

**Key Points:**
- Uses standard `MutationObserver` API
- Reads already-rendered DOM elements
- No network interception or fetch override
- Deduplicates using element IDs
- Detects message types (member, moderator, superchat)

### 2. Message Transmission

**Injected Script → Content Script:**

```javascript
// In yt-chat-inject.js
window.postMessage({
  source: 'DANMAKUYT_CHAT',
  type: 'CHAT_MESSAGES',
  payload: {
    url: window.location.href,
    videoId: new URLSearchParams(window.location.search).get('v'),
    messages: messages,  // includes type: 'text' | 'member' | 'moderator' | 'superchat'
    timestamp: Date.now()
  }
}, '*');
```

**Content Script → Background:**

```javascript
// In content.ts
browser.runtime.sendMessage({
  type: 'YOUTUBE_CHAT_MESSAGES',
  payload: event.data.payload
});
```

**Background → Overlay Content Script:**

```javascript
// In background.ts
browser.tabs.sendMessage(tabId, {
  type: 'YOUTUBE_CHAT_MESSAGES',
  payload: { tabId, messages }
});
```

### 3. Danmaku Rendering (PixiJS)

**Location:** `src/entrypoints/overlay.content/index.ts`

```
Receive message from background
        ↓
Check settings (enabled? type allowed?)
        ↓
Create BitmapText with styling:
  - Color based on type (white/green/blue/gold)
  - Drop shadow for readability
  - Font: Inter/system-ui
        ↓
Position in available lane
        ↓
Animate: x -= speed each frame
        ↓
Remove when off-screen
```

**Lane Management:**
- Messages flow in horizontal lanes
- Each lane can have one message at a time
- Prevents overlapping text
- Random lane assignment when all occupied

## File Structure

```
src/
├── entrypoints/
│   ├── content.ts          # Content script (iframe only)
│   ├── overlay.content/    # Danmaku overlay content script
│   │   └── index.ts        # PixiJS renderer
│   ├── background.ts       # Service worker
│   └── popup/              # Settings popup
│       ├── index.html
│       ├── main.tsx
│       └── App.tsx
├── components/
│   └── ui/                 # shadcn/ui components
├── assets/
│   └── index.css           # Tailwind styles
└── public/
    └── yt-chat-inject.js   # Injected DOM scraper

public/
├── icon-*.png              # Extension icons
└── yt-chat-inject.js       # (copied to dist)

docs/
├── architecture.md
├── commands.md
├── pixijs.md
├── patterns.md
└── common-issues.md
```

## Key Design Decisions

### 1. DOM-Based vs Network-Based

| Approach | Pros | Cons |
|----------|------|------|
| **DOM-Based** (Current) | Stable, safe, no crashes | Slight delay (render → detect) |
| **Network-Based** | Instant detection | Risk of breaking YouTube player |

**Why DOM-Based:**
- YouTube's video player is sensitive to fetch interception
- DOM reading is non-intrusive
- More reliable for production use

### 2. PixiJS BitmapText for Performance

**Why PixiJS with BitmapText:**
- Hardware-accelerated rendering via WebGPU
- BitmapText is faster than regular Text for dynamic content
- Efficient animation with requestAnimationFrame
- Low CPU overhead

**Renderer Configuration:**
- Canvas overlay positioned absolutely over video player
- Transparent background (backgroundAlpha: 0)
- Pointer-events: none (clicks pass through to video)
- Z-index: 1000 (above video, below controls)

### 3. Message Type Detection

**Types detected in yt-chat-inject.js:**
- `text`: Standard chat messages (white)
- `member`: Channel members (green)
- `moderator`: Chat moderators (blue)
- `superchat`: Paid messages (gold)

**Detection methods:**
- Element tag name (`yt-live-chat-paid-message-renderer`)
- Class names containing "member", "sponsor", "moderator"
- Badge icons in the author section

### 4. Settings Storage

**Persistent settings (browser.storage):**
- Enable/disable danmaku
- Show/hide per message type
- Filter options (hide specific types)
- Display options (density, speed)
- Show chat sidebar toggle

**Storage key:** `local:danmakuSettings`

### 5. In-Memory Message Storage

**Why not use browser.storage for messages:**
- Chat messages are transient
- High write frequency would wear out storage
- Memory is faster for real-time updates
- Background script maintains Map<tabId, messages[]>

## Security Considerations

1. **Content Security Policy:** Works within browser extension sandbox
2. **No External Requests:** Extension doesn't make network calls
3. **Read-Only:** Only reads DOM, doesn't modify YouTube
4. **Origin Isolation:** Content script runs in isolated world
5. **Pointer Events:** Danmaku overlay has `pointer-events: none` so it doesn't interfere with video controls

## Performance

### Optimizations:

1. **Minimal DOM Queries:** Uses `querySelectorAll` with specific selectors
2. **Deduplication:** Tracks processed element IDs in a Set (max 500)
3. **Batched Updates:** MutationObserver throttled to 100ms
4. **Memory Limits:** Keeps only last 100 messages (background)
5. **Lane Management:** Prevents text overlap, limits concurrent messages
6. **BitmapText:** Hardware-accelerated text rendering

### Resource Usage:

- **CPU:** Low (MutationObserver + PixiJS ticker)
- **Memory:** ~2-3MB for message storage + PixiJS buffers
- **Network:** Zero (doesn't make API calls)
- **GPU:** Minimal (2D text rendering)

## Settings UI

**Popup location:** `src/entrypoints/popup/`

**Features:**
- Enable/disable toggle
- Theme & roles configuration (per-type visibility)
- Filter options (hide specific types)
- Display options (density: low/medium/high, speed: slow/normal/fast)
- Show chat sidebar toggle

**Settings synchronization:**
- Settings saved to browser.storage
- Broadcasted to all YouTube tabs via messaging
- Applied immediately without page reload

## Future Improvements

### Potential Enhancements:

1. **Message Filtering:** Filter by keywords, users, regex patterns
2. **Export:** Save chat history to file
3. **Translation:** Auto-translate messages
4. **Sentiment Analysis:** Highlight positive/negative messages
5. **Custom Themes:** User-defined colors and fonts
6. **Position Control:** Top/bottom/sidebar danmaku areas

### Technical Debt:

1. **DOM Selectors:** May break if YouTube changes structure
2. **No Persistence:** Messages lost on extension reload
3. **Single Tab:** Currently tracks one stream at a time per tab
4. **Font Loading:** Inter font may not be available (fallback to system-ui)

## References

- **WXT:** https://wxt.dev/
- **Chrome Extension API:** https://developer.chrome.com/docs/extensions/
- **MutationObserver:** https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
- **PixiJS v8:** https://pixijs.com/llms.txt
- **WebGPU:** https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
