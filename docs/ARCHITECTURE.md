---
summary: System architecture, data flow, and key design decisions for DanmakuYT
read_when: ['new to project', 'understanding data flow', 'architectural changes']
---

# Architecture

## Overview

DanmakuYT is a browser extension that captures YouTube live stream chat messages and displays them in a Chrome sidepanel. It uses a **DOM-based approach** to read chat messages without intercepting network requests, ensuring stability and avoiding conflicts with YouTube's video player.

## Components

```
┌─────────────────────────────────────────────────────────────┐
│                    YouTube Live Stream                       │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │   Main Page         │  │  Live Chat Iframe            │  │
│  │   (Video Player)    │  │  ┌────────────────────────┐  │  │
│  │                     │  │  │ yt-live-chat-app     │  │  │
│  │                     │  │  │  ├─ chat messages    │  │  │
│  │                     │  │  │  ├─ new messages     │  │  │
│  │                     │  │  │  └─ (DOM mutations)  │  │  │
│  └─────────────────────┘  │  └────────────────────────┘  │  │
│                           └──────────────────────────────┘  │
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
                    │  • Sends via        │
                    │    postMessage      │
                    └─────────────────────┘
                              │
                              │ window.postMessage()
                              ▼
                    ┌─────────────────────┐
                    │   content.ts          │
                    │   (Content Script)    │
                    │                       │
                    │  • Receives msgs      │
                    │  • Forwards to        │
                    │    background         │
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
                    │    sidepanel        │
                    └─────────────────────┘
                              │
                              │ browser.runtime.sendMessage()
                              ▼
                    ┌─────────────────────┐
                    │   sidepanel/          │
                    │   (React UI)          │
                    │                     │
                    │  • Displays msgs    │
                    │  • User interface   │
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
  - timestamp (current time)
```

**Key Points:**
- Uses standard `MutationObserver` API
- Reads already-rendered DOM elements
- No network interception or fetch override
- Deduplicates using element IDs

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
    messages: messages,
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

**Background → Sidepanel:**

```javascript
// In background.ts
browser.runtime.sendMessage({
  type: 'NEW_CHAT_MESSAGES',
  payload: { tabId, messages }
});
```

### 3. State Management

**Background Script (In-Memory Storage):**

```
Map<tabId, messages[]>
  • Stores up to 100 messages per tab
  • Clears on tab navigation/close
  • Routes messages to sidepanel
```

**Sidepanel (React State):**

```
useState<messages[]>
  • Appends new messages
  • Keeps last 50 in UI
  • Auto-scrolls to bottom
```

## File Structure

```
src/
├── entrypoints/
│   ├── content.ts          # Content script (iframe only)
│   ├── background.ts       # Service worker
│   └── sidepanel/
│       ├── index.html      # Sidepanel HTML
│       └── App.tsx         # Sidepanel React UI
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

### 2. Iframe-Only Injection

**Why only inject in live chat iframe:**
- Main page has sensitive video player
- Live chat iframe is isolated and safe
- Reduces resource usage

### 3. No Console Logging in Production

**Removed:**
- No `console.log` spam
- No debug output on every message
- Silent operation

### 4. In-Memory Storage

**Why not use browser.storage:**
- Chat messages are transient
- High write frequency would wear out storage
- Memory is faster for real-time updates

## Security Considerations

1. **Content Security Policy:** Works within browser extension sandbox
2. **No External Requests:** Extension doesn't make network calls
3. **Read-Only:** Only reads DOM, doesn't modify YouTube
4. **Origin Isolation:** Content script runs in isolated world

## Performance

### Optimizations:

1. **Minimal DOM Queries:** Uses `querySelectorAll` with specific selectors
2. **Deduplication:** Tracks last processed element ID
3. **Batched Updates:** Sends messages in batches
4. **Memory Limits:** Keeps only last 100 messages (background) / 50 (UI)

### Resource Usage:

- **CPU:** Low (MutationObserver is efficient)
- **Memory:** ~1-2MB for message storage
- **Network:** Zero (doesn't make API calls)

## Future Improvements

### Potential Enhancements:

1. **Danmaku Overlay:** Render messages over video using Canvas/WebGL
2. **Message Filtering:** Filter by keywords, users, message types
3. **Export:** Save chat history to file
4. **Translation:** Auto-translate messages
5. **Sentiment Analysis:** Highlight positive/negative messages

### Technical Debt:

1. **DOM Selectors:** May break if YouTube changes structure
2. **No Persistence:** Messages lost on extension reload
3. **Single Tab:** Currently tracks one stream at a time

## References

- **WXT:** https://wxt.dev/
- **Chrome Extension API:** https://developer.chrome.com/docs/extensions/
- **MutationObserver:** https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
