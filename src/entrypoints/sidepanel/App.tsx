import { useState, useEffect, useCallback, useRef } from 'react'
import { Activity, Trash2, Play, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'

// Chat message type
interface ChatMessage {
  type: 'text' | 'superchat'
  text: string
  author: string
  avatar: string
  timestamp: number
  channelId: string
  id: string
  receivedAt: number
  videoId?: string
  amount?: string
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLive, setIsLive] = useState(false)
  const [currentTab, setCurrentTab] = useState<{ title?: string; url?: string; id?: number } | null>(null)
  const [isWatching, setIsWatching] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Get current tab info and set up listeners
  useEffect(() => {
    let messageListener: any
    let isInitialLoad = true
    
    const loadInitialMessages = async (tabId: number) => {
      try {
        const response = await browser.runtime.sendMessage({ type: 'GET_CHAT_MESSAGES' })
        if (response?.success && response.messages && response.messages.length > 0) {
          setMessages(response.messages)
        }
      } catch (error) {}
    }
    
    const refreshTabInfo = async () => {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
        if (tab) {
          setCurrentTab({ 
            title: tab.title, 
            url: tab.url,
            id: tab.id 
          })
          
          const isYouTubeLive = tab.url?.includes('youtube.com/watch') || false
          setIsLive(isYouTubeLive)
          
          if (isInitialLoad && isYouTubeLive && tab.id) {
            await loadInitialMessages(tab.id)
            isInitialLoad = false
          }
        }
      } catch (error) {}
    }
    
    // Listen for new messages from background
    messageListener = (message: any) => {
      if (message.type === 'NEW_CHAT_MESSAGES') {
        setMessages(prev => {
          const newMessages = [...prev, ...message.payload.messages]
          return newMessages.slice(-50)
        })
      }
    }
    
    browser.runtime.onMessage.addListener(messageListener)
    
    // Initial load
    refreshTabInfo()
    
    // Only refresh tab info periodically (not messages)
    const interval = setInterval(refreshTabInfo, 5000)
    
    return () => {
      clearInterval(interval)
      if (messageListener) {
        browser.runtime.onMessage.removeListener(messageListener)
      }
    }
  }, [])
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  // Format timestamp - handles both milliseconds and microseconds
  const formatTime = (timestamp: number) => {
    if (!timestamp || isNaN(timestamp)) return 'Invalid Date'
    
    // If timestamp is in microseconds (very large number), convert to milliseconds
    // YouTube timestamps are typically around 1775399667692454 (microseconds)
    // Normal JS timestamps are around 1775399667692 (milliseconds)
    let normalizedTimestamp = timestamp
    if (timestamp > 10000000000000) {
      // It's in microseconds, convert to milliseconds
      normalizedTimestamp = Math.floor(timestamp / 1000)
    }
    
    const date = new Date(normalizedTimestamp)
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date'
    }
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  
  // Clear all messages
  const handleClear = useCallback(async () => {
    setMessages([])
    try {
      await browser.runtime.sendMessage({ type: 'CLEAR_MESSAGES' })
    } catch (e) {
      console.error('Failed to clear messages:', e)
    }
  }, [])
  
  // Toggle watching state
  const handleToggleWatching = useCallback(() => {
    setIsWatching(prev => !prev)
  }, [])
  
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-primary" />
          <span className="text-sm font-medium">DanmakuYT</span>
          {isLive && (
            <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded">
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleClear}
            disabled={messages.length === 0}
            className="cursor-pointer"
            title="Clear messages"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </header>

      {/* Tab Info */}
      <div className="border-b px-3 py-2 bg-muted/30">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {isLive ? 'YouTube Live Stream' : 'Current Page'}
        </div>
        <div className="text-xs font-medium truncate" title={currentTab?.title}>
          {currentTab?.title || 'No active tab'}
        </div>
        {!isLive && (
          <div className="text-[10px] text-muted-foreground mt-1">
            Navigate to a YouTube live stream to see chat
          </div>
        )}
      </div>

      {/* Stats */}
      {isLive && (
        <div className="flex items-center justify-between px-3 py-2 border-b text-xs">
          <div className="text-muted-foreground">
            {messages.length} messages captured
          </div>
          <Button
            size="sm"
            variant={isWatching ? "default" : "outline"}
            onClick={handleToggleWatching}
            className="h-6 text-[10px] cursor-pointer"
          >
            {isWatching ? (
              <>
                <Square className="size-3 mr-1" />
                Stop
              </>
            ) : (
              <>
                <Play className="size-3 mr-1" />
                Watch
              </>
            )}
          </Button>
        </div>
      )}

      {/* Messages List */}
      <main className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <Activity className="size-8 mb-2 opacity-50" />
            <p className="text-sm">
              {isLive ? 'Waiting for chat messages...' : 'Navigate to a YouTube live stream'}
            </p>
            <p className="text-xs mt-1 text-center">
              {isLive 
                ? 'Chat messages will appear here automatically' 
                : 'Open a YouTube live stream to start capturing chat'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {messages.map((msg, index) => (
              <div
                key={`${msg.id}-${index}`}
                className={`p-3 text-sm ${msg.type === 'superchat' ? 'bg-yellow-50' : ''}`}
              >
                <div className="flex items-start gap-2">
                  {msg.avatar && (
                    <img
                      src={msg.avatar}
                      alt=""
                      className="size-6 rounded-full flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium truncate text-primary">
                        {msg.author}
                      </span>
                      {msg.type === 'superchat' && msg.amount && (
                        <span className="text-yellow-600 font-medium">
                          {msg.amount}
                        </span>
                      )}
                      <span className="text-muted-foreground ml-auto">
                        {formatTime(msg.receivedAt || msg.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1 break-words">{msg.text}</p>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>
    </div>
  )
}
