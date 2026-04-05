import { DanmakuRenderer } from './danmaku'

// Chat message type (mirrored from danmaku.ts for type safety)
interface ChatMessage {
  type: 'text' | 'member' | 'moderator' | 'superchat'
  text: string
  author: string
  avatar?: string
  timestamp: number
  channelId: string
  id: string
  receivedAt: number
  videoId?: string
  amount?: string
  images?: string[] // Array of image URLs from emojis/stickers
}

// Settings type (mirrored from danmaku.ts)
interface DanmakuSettings {
  enabled: boolean
  showStandard: boolean
  showMember: boolean
  showModerator: boolean
  showSuperChat: boolean
  hideStandard: boolean
  hideMember: boolean
  hideModerator: boolean
  hideSuperChat: boolean
  showChatSidebar: boolean
  density: 'low' | 'medium' | 'high'
  speed: 'slow' | 'normal' | 'fast'
}

// Main content script
export default defineContentScript({
  matches: ['*://www.youtube.com/watch*'],
  cssInjectionMode: 'ui',
  
  async main(ctx) {
    let renderer: DanmakuRenderer | null = null
    let isActive = true
    let initAttempts = 0
    const MAX_INIT_ATTEMPTS = 30

    // Initialize danmaku overlay
    const initDanmaku = async () => {
      if (!isActive) return
      
      // Find video container - try multiple selectors
      const selectors = [
        '#movie_player',
        '#player-container-id',
        '.html5-video-player',
        'ytd-watch-flexy #player',
        '.ytd-player'
      ]
      
      let videoContainer: HTMLElement | null = null
      for (const selector of selectors) {
        videoContainer = document.querySelector(selector) as HTMLElement | null
        if (videoContainer) break
      }
      
      if (!videoContainer) {
        initAttempts++
        if (initAttempts < MAX_INIT_ATTEMPTS) {
          setTimeout(initDanmaku, 1000)
        }
        return
      }

      // Skip if already initialized
      if (renderer) return

      renderer = new DanmakuRenderer()
      await renderer.init(videoContainer)
    }

    // Listen for messages from background script
    const messageListener = (message: any) => {
      if (!isActive) return

      switch (message.type) {
        case 'YOUTUBE_CHAT_MESSAGES':
          if (renderer && message.payload?.messages) {
            message.payload.messages.forEach((msg: ChatMessage) => {
              renderer?.addMessage(msg)
            })
          }
          break

        case 'DANMAKU_SETTINGS_UPDATED':
          if (renderer) {
            renderer.updateSettings(message.payload)
          }
          break
      }
    }

    browser.runtime.onMessage.addListener(messageListener)

    // Handle window resize
    const resizeHandler = () => {
      if (renderer) {
        renderer.resize()
      }
    }
    window.addEventListener('resize', resizeHandler)

    // Initialize when video player is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDanmaku)
    } else {
      initDanmaku()
    }

    // Re-initialize on navigation (SPA navigation)
    let lastUrl = location.href
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href
        if (location.href.includes('/watch')) {
          // Clean up old renderer
          if (renderer) {
            renderer.destroy()
            renderer = null
          }
          initAttempts = 0
          // Re-initialize after a delay
          setTimeout(initDanmaku, 2000)
        }
      }
    })
    urlObserver.observe(document.body, { childList: true, subtree: true })

    // Cleanup on extension reload/update
    ctx.onInvalidated(() => {
      isActive = false
      urlObserver.disconnect()
      window.removeEventListener('resize', resizeHandler)
      browser.runtime.onMessage.removeListener(messageListener)
      if (renderer) {
        renderer.destroy()
        renderer = null
      }
    })
  },
})
