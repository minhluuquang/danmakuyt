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
    let resizeTimeout: number | null = null
    const resizeHandler = () => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }
      resizeTimeout = window.setTimeout(() => {
        if (renderer) {
          renderer.resize()
        }
      }, 100)
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
    let reinitTimeout: number | null = null
    
    const urlObserver = new MutationObserver(() => {
      const currentUrl = location.href
      if (currentUrl !== lastUrl) {
        const oldUrl = lastUrl
        lastUrl = currentUrl
        
        // Only reinitialize on significant URL changes (different video)
        const isWatchPage = currentUrl.includes('/watch')
        const isSameVideo = oldUrl.split('v=')[1]?.split('&')[0] === currentUrl.split('v=')[1]?.split('&')[0]
        
        // Skip if it's just a hash change or same video
        if (!isWatchPage || isSameVideo) {
          return
        }
        
        // Debounce rapid URL changes
        if (reinitTimeout) {
          clearTimeout(reinitTimeout)
        }
        
        reinitTimeout = window.setTimeout(() => {
          // Clean up old renderer
          if (renderer) {
            renderer.destroy()
            renderer = null
          }
          initAttempts = 0
          // Re-initialize
          initDanmaku()
        }, 1000)
      }
    })
    urlObserver.observe(document.body, { childList: true, subtree: true })

    // Cleanup on extension reload/update
    ctx.onInvalidated(() => {
      isActive = false
      urlObserver.disconnect()
      if (resizeTimeout) clearTimeout(resizeTimeout)
      if (reinitTimeout) clearTimeout(reinitTimeout)
      window.removeEventListener('resize', resizeHandler)
      browser.runtime.onMessage.removeListener(messageListener)
      if (renderer) {
        renderer.destroy()
        renderer = null
      }
    })
  },
})
