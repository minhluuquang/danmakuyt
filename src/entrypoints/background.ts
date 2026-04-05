// Background script - handles chat message routing

// Store recent chat messages in memory
const recentMessages = new Map<number, any[]>() // tabId -> messages

export default defineBackground(() => {
  // Listen for messages from content scripts
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const tabId = sender.tab?.id
    
    switch (message.type) {
      case 'YOUTUBE_CHAT_MESSAGES':
        handleChatMessages(message.payload, tabId)
        sendResponse({ success: true })
        break
        
      case 'PING':
        sendResponse({ success: true, message: 'pong' })
        break
        
      case 'GET_CHAT_MESSAGES':
        sendResponse({ 
          success: true, 
          messages: tabId && recentMessages.has(tabId) 
            ? recentMessages.get(tabId) 
            : [] 
        })
        break
        
      case 'CLEAR_MESSAGES':
        if (tabId) {
          recentMessages.delete(tabId)
        }
        sendResponse({ success: true })
        break
    }
    
    return true
  })
  
  // Handle tab updates to clear old messages
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      recentMessages.delete(tabId)
    }
  })
  
  // Clean up when tabs are closed
  browser.tabs.onRemoved.addListener((tabId) => {
    recentMessages.delete(tabId)
  })
})

function handleChatMessages(payload: any, tabId?: number) {
  if (!tabId) return
  
  const { messages, url, videoId, timestamp } = payload
  
  if (!recentMessages.has(tabId)) {
    recentMessages.set(tabId, [])
  }
  
  const tabMessages = recentMessages.get(tabId)!
  
  for (const msg of messages) {
    tabMessages.push({
      ...msg,
      receivedAt: timestamp,
      videoId
    })
  }
  
  if (tabMessages.length > 100) {
    tabMessages.splice(0, tabMessages.length - 100)
  }
  
  // Forward to sidepanel if open
  forwardToSidepanel(tabId, messages)
}

async function forwardToSidepanel(tabId: number, messages: any[]) {
  try {
    await browser.runtime.sendMessage({
      type: 'NEW_CHAT_MESSAGES',
      payload: {
        tabId,
        messages
      }
    })
  } catch (e) {
    // Sidepanel might not be open - that's okay
  }
}
