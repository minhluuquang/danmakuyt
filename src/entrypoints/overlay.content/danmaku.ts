import 'pixi.js/unsafe-eval'
import { Application, BitmapText, Container, Ticker, BitmapFont, Sprite, Texture } from 'pixi.js'
import { storage } from 'wxt/utils/storage'

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ChatMessage {
  type: 'text' | 'member' | 'moderator' | 'superchat'
  text: string
  author: string
  authorId?: string
  avatar?: string
  timestamp: number
  channelId: string
  id: string
  receivedAt: number
  videoId?: string
  amount?: string
  images?: string[]
}

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

interface ActiveComment {
  container: Container
  speed: number
  width: number
}

// ============================================================================
// Constants
// ============================================================================

const LANE_HEIGHT = 36
const FONT_SIZE = 24
const STROKE_WIDTH = 3

// Pre-installed font names
const FONT_STANDARD = 'danmaku-standard'
const FONT_MEMBER = 'danmaku-member'
const FONT_MODERATOR = 'danmaku-moderator'
const FONT_SUPERCHAT = 'danmaku-superchat'

// ============================================================================
// Debug Logging
// ============================================================================

const DEBUG = false
const LOG_PREFIX = '[DanmakuYT]'

function debug(...args: any[]) {
  if (DEBUG) {
    console.log(LOG_PREFIX, ...args)
  }
}

// ============================================================================
// Font Setup
// ============================================================================

function installDanmakuFonts() {
  const baseStyle = {
    fontSize: FONT_SIZE,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    stroke: { color: '#000000', width: STROKE_WIDTH },
    dropShadow: { color: '#000000', blur: 4, distance: 0 },
  }

  BitmapFont.install({
    name: FONT_STANDARD,
    style: { ...baseStyle, fill: 0xffffff },
  })

  BitmapFont.install({
    name: FONT_MEMBER,
    style: { ...baseStyle, fill: 0x22c55e },
  })

  BitmapFont.install({
    name: FONT_MODERATOR,
    style: { ...baseStyle, fill: 0x3b82f6 },
  })

  BitmapFont.install({
    name: FONT_SUPERCHAT,
    style: { ...baseStyle, fill: 0xeab308 },
  })

  debug('Bitmap fonts installed')
}

function getFontName(type: ChatMessage['type']): string {
  switch (type) {
    case 'member': return FONT_MEMBER
    case 'moderator': return FONT_MODERATOR
    case 'superchat': return FONT_SUPERCHAT
    default: return FONT_STANDARD
  }
}

// ============================================================================
// Main Danmaku Renderer
// ============================================================================

export class DanmakuRenderer {
  private app: Application | null = null
  private container: Container | null = null
  private videoContainer: HTMLElement | null = null
  private canvas: HTMLCanvasElement | null = null
  
  // State
  private settings: DanmakuSettings = defaultSettings
  private activeComments: Set<ActiveComment> = new Set()
  private messageQueue: ChatMessage[] = []
  private isInitialized = false
  private ticker: Ticker | null = null
  
  // Lane tracking
  private laneYPositions: number[] = []
  private laneLastEndTime: number[] = []
  private nextLaneIndex = 0

  constructor() {}

  async init(videoContainer: HTMLElement) {
    if (this.isInitialized) {
      debug('init() called but already initialized, skipping')
      return
    }

    debug('Initializing DanmakuRenderer...')
    this.videoContainer = videoContainer
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
    
    const computedStyle = window.getComputedStyle(videoContainer)
    if (computedStyle.position === 'static') {
      videoContainer.style.position = 'relative'
    }
    
    videoContainer.insertBefore(this.canvas, videoContainer.firstChild)

    try {
      // Pre-install bitmap fonts to avoid creating them dynamically
      installDanmakuFonts()

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

      this.container = new Container()
      this.app.stage.addChild(this.container)

      this.updateLanePositions()

      this.ticker = this.app.ticker
      this.ticker.add(() => this.animate())

      this.isInitialized = true
      debug('DanmakuRenderer initialized successfully!')
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to initialize PixiJS:', error)
    }
  }

  private updateLanePositions() {
    if (!this.app) return
    
    const height = this.app.screen.height
    const laneCount = Math.max(3, Math.floor(height / LANE_HEIGHT))
    
    this.laneYPositions = []
    this.laneLastEndTime = []
    
    for (let i = 0; i < laneCount; i++) {
      this.laneYPositions.push(i * LANE_HEIGHT + 12)
      this.laneLastEndTime.push(0)
    }
    
    debug(`Updated lanes: ${laneCount}`)
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
      case 'slow': return 1.5 + Math.random() * 0.5
      case 'fast': return 3.5 + Math.random() * 0.5
      default: return 2.5 + Math.random() * 0.5
    }
  }

  // ============================================================================
  // Image Cache
  // ============================================================================
  
  private imageCache = new Map<string, Texture>()
  private pendingLoads = new Map<string, Promise<Texture>>()

  private async getCachedTexture(imgUrl: string): Promise<Texture | null> {
    // Return cached texture if available
    if (this.imageCache.has(imgUrl)) {
      return this.imageCache.get(imgUrl)!
    }

    // Return pending load promise if already loading
    if (this.pendingLoads.has(imgUrl)) {
      return this.pendingLoads.get(imgUrl)!
    }

    // Start loading
    const loadPromise = this.loadImageTexture(imgUrl)
    this.pendingLoads.set(imgUrl, loadPromise)

    try {
      const texture = await loadPromise
      this.imageCache.set(imgUrl, texture)
      this.pendingLoads.delete(imgUrl)
      return texture
    } catch (error) {
      this.pendingLoads.delete(imgUrl)
      return null
    }
  }

  private async loadImageTexture(imgUrl: string): Promise<Texture> {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    // Set a timeout to prevent hanging
    const timeoutMs = 5000
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Image load timeout'))
      }, timeoutMs)
      
      img.onload = () => {
        clearTimeout(timeoutId)
        try {
          // Draw image to canvas
          const canvas = document.createElement('canvas')
          canvas.width = FONT_SIZE
          canvas.height = FONT_SIZE
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }
          
          ctx.drawImage(img, 0, 0, FONT_SIZE, FONT_SIZE)
          const texture = Texture.from(canvas)
          resolve(texture)
        } catch (error) {
          reject(error)
        }
      }
      
      img.onerror = () => {
        clearTimeout(timeoutId)
        reject(new Error('Image failed to load'))
      }
      
      img.src = imgUrl
    })
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

  addMessage(message: ChatMessage) {
    // Filter messages with no content
    const hasContent = (message.text && message.text.trim().length > 0) || 
                       (message.images && message.images.length > 0)
    if (!hasContent) return
    
    if (!this.shouldShowMessage(message)) return

    debug(`addMessage: ${message.author}: ${message.text?.substring(0, 30)}...`)

    if (!this.isInitialized) {
      this.messageQueue.push(message)
      return
    }

    this.messageQueue.push(message)
    
    // Limit queue size
    if (this.messageQueue.length > 100) {
      this.messageQueue.shift()
    }
  }

  private processQueue() {
    if (!this.container || !this.app) return
    if (this.messageQueue.length === 0) return

    // Process one message per frame for smooth animation
    const message = this.messageQueue.shift()
    if (!message) return

    // Fire and forget - don't await, let animation continue
    this.renderComment(message)
  }

  private renderComment(message: ChatMessage) {
    if (!this.container || !this.app) return

    const speed = this.getSpeed()
    const fontName = getFontName(message.type)

    // Create container
    const commentContainer = new Container()
    let currentX = 0
    const emojiSize = FONT_SIZE
    const emojiSpacing = 4
    const textSpacing = 8

    // Add text if present
    if (message.text && message.text.trim().length > 0) {
      const displayText = `[${message.author}] ${message.text}`
      const textSprite = new BitmapText({
        text: displayText,
        style: { fontFamily: fontName },
      })
      textSprite.x = currentX
      commentContainer.addChild(textSprite)
      currentX += textSprite.width + textSpacing
    } else if (message.images && message.images.length > 0) {
      // No text but has images - still show author name
      const authorText = `[${message.author}] `
      const authorSprite = new BitmapText({
        text: authorText,
        style: { fontFamily: fontName },
      })
      authorSprite.x = currentX
      commentContainer.addChild(authorSprite)
      currentX += authorSprite.width + textSpacing
    }

    // Calculate initial width (without images)
    let totalWidth = currentX

    // Find a lane with simple round-robin
    const laneIndex = this.nextLaneIndex
    this.nextLaneIndex = (this.nextLaneIndex + 1) % this.laneYPositions.length

    // Position and add to stage immediately (don't wait for images)
    commentContainer.x = this.app.screen.width
    commentContainer.y = this.laneYPositions[laneIndex]

    this.container.addChild(commentContainer)

    const comment: ActiveComment = {
      container: commentContainer,
      speed,
      width: totalWidth,
    }

    this.activeComments.add(comment)

    // Load images asynchronously WITHOUT blocking - fire and forget
    if (message.images && message.images.length > 0) {
      // Limit images per message to prevent spam
      const imagesToLoad = message.images.slice(0, 10)
      
      // Don't await this - let it run in background
      this.loadImagesForComment(comment, commentContainer, imagesToLoad, currentX, emojiSize, emojiSpacing)
    }

    debug(`Rendered: ${message.author} on lane ${laneIndex} with ${Math.min(message.images?.length || 0, 10)} images`)
  }
  
  private async loadImagesForComment(
    comment: ActiveComment,
    container: Container,
    imageUrls: string[],
    startX: number,
    emojiSize: number,
    emojiSpacing: number
  ) {
    let currentX = startX
    
    for (const imgUrl of imageUrls) {
      try {
        const texture = await this.getCachedTexture(imgUrl)
        // Check comment still exists and container is still on stage
        if (texture && this.activeComments.has(comment) && container.parent) {
          const sprite = new Sprite(texture)
          sprite.x = currentX
          sprite.y = 0
          
          container.addChild(sprite)
          currentX += emojiSize + emojiSpacing
          
          // Update comment width
          comment.width = currentX
        }
      } catch (error) {
        debug(`Failed to load emoji image: ${imgUrl.substring(0, 60)}`)
      }
    }
  }

  private async animate() {
    if (!this.container || !this.app) return

    // Process queued messages - DON'T await to prevent blocking
    this.processQueue()

    // Move all comments
    for (const comment of this.activeComments) {
      comment.container.x -= comment.speed

      // Remove if off-screen
      if (comment.container.x < -comment.width - 50) {
        this.container.removeChild(comment.container)
        comment.container.destroy()
        this.activeComments.delete(comment)
      }
    }

    // Check for resize every 30 frames (~0.5s at 60fps)
    if (this.app.ticker.count % 30 === 0) {
      this.updateLanePositions()
    }
    
    // Check canvas is still in DOM every 60 frames (~1s at 60fps)
    if (this.app.ticker.count % 60 === 0) {
      this.ensureCanvasInDOM()
    }
  }
  
  private ensureCanvasInDOM() {
    if (!this.canvas || !this.videoContainer) return
    
    const isVisible = this.videoContainer.contains(this.canvas)
    
    if (!isVisible) {
      console.log(`[DanmakuYT] CANVAS_HIDDEN - re-inserting into DOM`)
      this.videoContainer.insertBefore(this.canvas, this.videoContainer.firstChild)
      console.log(`[DanmakuYT] CANVAS_VISIBLE - re-inserted successfully`)
    }
  }

  resize() {
    this.updateLanePositions()
  }

  destroy() {
    if (this.ticker) {
      this.ticker.stop()
    }

    for (const comment of this.activeComments) {
      comment.container.destroy()
    }
    this.activeComments.clear()

    if (this.app) {
      this.app.destroy(true)
    }

    if (this.canvas && this.canvas.parentElement) {
      this.canvas.remove()
    }

    this.isInitialized = false
    this.videoContainer = null
  }
}

// ============================================================================
// Default Settings
// ============================================================================

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
