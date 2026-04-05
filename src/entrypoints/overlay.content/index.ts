import 'pixi.js/unsafe-eval'
import { Application, BitmapText, Container, Ticker } from 'pixi.js'
import { storage } from 'wxt/utils/storage'

// Chat message type
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
}

// Settings type
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

const defaultSettings: DanmakuSettings = {
  enabled: true,
  showStandard: true,
  showMember: true,
  showModerator: true,
  showSuperChat: true,
  hideStandard: false,
  hideMember: false,
  hideModerator: false,
  hideSuperChat: false,
  showChatSidebar: true,
  density: 'medium',
  speed: 'normal',
}

// Danmaku lane management
class DanmakuLaneManager {
  private lanes: boolean[] = []
  private laneHeight: number = 30
  private containerHeight: number = 0

  constructor(laneCount: number) {
    this.lanes = new Array(laneCount).fill(false)
  }

  updateHeight(height: number) {
    this.containerHeight = height
    const laneCount = Math.floor(height / this.laneHeight)
    if (laneCount !== this.lanes.length) {
      this.lanes = new Array(Math.max(1, laneCount)).fill(false)
    }
  }

  acquireLane(): number {
    // Find first available lane
    for (let i = 0; i < this.lanes.length; i++) {
      if (!this.lanes[i]) {
        this.lanes[i] = true
        return i
      }
    }
    // All lanes occupied, pick random and overwrite
    const lane = Math.floor(Math.random() * this.lanes.length)
    this.lanes[lane] = true
    return lane
  }

  releaseLane(laneIndex: number) {
    if (laneIndex >= 0 && laneIndex < this.lanes.length) {
      this.lanes[laneIndex] = false
    }
  }

  getYPosition(laneIndex: number): number {
    return laneIndex * this.laneHeight + 10
  }

  getAvailableLanes(): number {
    return this.lanes.filter(occupied => !occupied).length
  }

  getTotalLanes(): number {
    return this.lanes.length
  }
}

// Danmaku renderer class
class DanmakuRenderer {
  private app: Application | null = null
  private container: Container | null = null
  private videoContainer: HTMLElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private laneManager: DanmakuLaneManager
  private settings: DanmakuSettings = defaultSettings
  private messageQueue: ChatMessage[] = []
  private activeTexts: Map<BitmapText, { lane: number; speed: number }> = new Map()
  private ticker: Ticker | null = null
  private isInitialized = false

  constructor() {
    this.laneManager = new DanmakuLaneManager(15)
  }

  async init(videoContainer: HTMLElement) {
    if (this.isInitialized) return

    this.videoContainer = videoContainer
    
    // Load settings
    await this.loadSettings()

    // Create canvas overlay
    this.canvas = document.createElement('canvas')
    this.canvas.id = 'danmakuyt-overlay'
    this.canvas.style.cssText = `
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
      background: transparent !important;
    `
    
    // Ensure video container has position
    const computedStyle = window.getComputedStyle(videoContainer)
    if (computedStyle.position === 'static') {
      videoContainer.style.position = 'relative'
    }
    
    // Insert as first child so it's behind controls but above video
    if (videoContainer.firstChild) {
      videoContainer.insertBefore(this.canvas, videoContainer.firstChild)
    } else {
      videoContainer.appendChild(this.canvas)
    }

    try {
      // Initialize PixiJS
      this.app = new Application()
      await this.app.init({
        canvas: this.canvas,
        resizeTo: videoContainer,
        backgroundAlpha: 0,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        preference: 'webgpu',
      })

      // Create container for danmaku
      this.container = new Container()
      this.app.stage.addChild(this.container)

      // Update lane manager with initial size
      this.laneManager.updateHeight(this.app.screen.height)

      // Start animation loop
      this.ticker = this.app.ticker
      this.ticker.add(() => this.animate())

      this.isInitialized = true
    } catch (error) {
      // Silent fail - PixiJS may not be supported
    }
  }

  private async loadSettings() {
    try {
      const saved = await storage.getItem<DanmakuSettings>('local:danmakuSettings')
      if (saved) {
        this.settings = { ...defaultSettings, ...saved }
      }
    } catch (error) {
      // Silent fail
    }
  }

  updateSettings(newSettings: DanmakuSettings) {
    this.settings = newSettings
  }

  private getSpeed(): number {
    switch (this.settings.speed) {
      case 'slow': return 1.5
      case 'fast': return 3.5
      default: return 2.5
    }
  }

  private getDensity(): number {
    switch (this.settings.density) {
      case 'low': return 3
      case 'high': return 8
      default: return 5
    }
  }

  private shouldShowMessage(message: ChatMessage): boolean {
    if (!this.settings.enabled) return false

    switch (message.type) {
      case 'text':
        return this.settings.showStandard && !this.settings.hideStandard
      case 'member':
        return this.settings.showMember && !this.settings.hideMember
      case 'moderator':
        return this.settings.showModerator && !this.settings.hideModerator
      case 'superchat':
        return this.settings.showSuperChat && !this.settings.hideSuperChat
      default:
        return true
    }
  }

  private getMessageColor(message: ChatMessage): number {
    switch (message.type) {
      case 'member':
        return 0x22c55e // Green
      case 'moderator':
        return 0x3b82f6 // Blue
      case 'superchat':
        return 0xeab308 // Yellow/gold
      default:
        return 0xffffff // White
    }
  }

  private createText(message: ChatMessage): BitmapText | null {
    if (!this.container || !this.app) return null

    const text = `[${message.author}] ${message.text}`
    const color = this.getMessageColor(message)

    try {
      // Use BitmapText with embedded font for performance
      const bitmapText = new BitmapText({
        text,
        style: {
          fontSize: 24,
          fill: color,
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          stroke: {
            color: '#000000',
            width: 3,
          },
          dropShadow: {
            color: '#000000',
            blur: 4,
            distance: 0,
          },
        },
      })

      // Position at right edge of screen
      bitmapText.x = this.app.screen.width
      
      // Get lane
      const lane = this.laneManager.acquireLane()
      bitmapText.y = this.laneManager.getYPosition(lane)

      // Check if any text already exists in this lane (overwrite case)
      for (const [existingText, existingData] of this.activeTexts) {
        if (existingData.lane === lane) {
          // Remove old text from this lane
          this.container.removeChild(existingText)
          existingText.destroy()
          this.activeTexts.delete(existingText)
          break
        }
      }

      this.container.addChild(bitmapText)
      
      const speed = this.getSpeed() + Math.random() * 0.5
      this.activeTexts.set(bitmapText, { lane, speed })

      return bitmapText
    } catch (error) {
      return null
    }
  }

  addMessage(message: ChatMessage) {
    if (!this.shouldShowMessage(message)) return

    if (!this.isInitialized) {
      this.messageQueue.push(message)
      return
    }

    // Limit queue size based on density
    const maxQueue = this.getDensity() * 2
    if (this.messageQueue.length >= maxQueue) {
      this.messageQueue.shift()
    }
    this.messageQueue.push(message)
    
    // Process immediately
    this.processQueue()
  }

  private processQueue() {
    if (this.messageQueue.length === 0) return
    
    // Process one message per frame to spread them out
    const message = this.messageQueue.shift()
    if (message) {
      this.createText(message)
    }
  }

  private animate() {
    if (!this.container || !this.app) return

    // Process messages continuously but at a controlled rate
    if (this.ticker && this.ticker.count % 3 === 0) {
      this.processQueue()
    }

    // Move all texts
    for (const [text, data] of this.activeTexts) {
      text.x -= data.speed

      // Remove if off-screen
      if (text.x < -text.width - 100) {
        this.container.removeChild(text)
        text.destroy()
        this.activeTexts.delete(text)
        this.laneManager.releaseLane(data.lane)
      }
    }

    // Update lane manager height on resize
    this.laneManager.updateHeight(this.app.screen.height)
  }

  resize() {
    if (this.app) {
      this.laneManager.updateHeight(this.app.screen.height)
    }
  }

  destroy() {
    if (this.ticker) {
      this.ticker.stop()
    }
    
    // Clean up all texts
    for (const [text, data] of this.activeTexts) {
      text.destroy()
    }
    this.activeTexts.clear()

    if (this.app) {
      this.app.destroy(true)
    }

    if (this.canvas && this.canvas.parentElement) {
      this.canvas.remove()
    }

    this.isInitialized = false
  }
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
