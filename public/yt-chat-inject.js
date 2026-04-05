(function() {
  'use strict';
  
  // Only run in live chat iframe
  if (!window.location.href.includes('live_chat')) return
  if (window.__danmakuytInstalled) return
  
  window.__danmakuytInstalled = true
  
  const processedIds = new Set()
  
  function getMessageType(item) {
    // Check for superchat / paid message
    if (item.tagName === 'YT-LIVE-CHAT-PAID-MESSAGE-RENDERER' || 
        item.tagName === 'YT-LIVE-CHAT-PAID-STICKER-RENDERER' ||
        item.querySelector('#purchase-amount, .purchase-amount, [class*="purchase"]')) {
      return 'superchat'
    }
    
    // Check for membership
    var itemClasses = item.getAttribute('class') || ''
    if (itemClasses.includes('member') || 
        itemClasses.includes('sponsor') ||
        item.querySelector('#header-sub-text, .member, .sponsor, [class*="member"], [class*="sponsor"]')) {
      return 'member'
    }
    
    // Check for moderator
    var authorName = item.querySelector('#author-name')
    if (authorName) {
      var authorClasses = authorName.getAttribute('class') || ''
      if (authorClasses.includes('moderator') || 
          authorClasses.includes('owner') ||
          item.querySelector('[src*="moderator"], [src*="owner"], .moderator, .owner')) {
        return 'moderator'
      }
    }
    
    return 'text'
  }
  
  function extractMessages() {
    var messages = []
    
    // Query both regular messages and paid messages
    var chatItems = document.querySelectorAll('yt-live-chat-text-message-renderer, yt-live-chat-paid-message-renderer, yt-live-chat-paid-sticker-renderer, yt-live-chat-membership-item-renderer')
    
    if (chatItems.length === 0) return messages
    
    var newItems = []
    
    for (var i = 0; i < chatItems.length; i++) {
      var item = chatItems[i]
      var id = item.id || item.getAttribute('id') || ''
      
      // Skip if already processed or no id
      if (!id || processedIds.has(id)) continue
      
      // Collect new items
      newItems.push(item)
      processedIds.add(id)
      
      // Limit set size
      if (processedIds.size > 500) {
        var iterator = processedIds.values()
        var first = iterator.next().value
        if (first) processedIds.delete(first)
      }
    }
    
    // Process new items
    for (var j = 0; j < newItems.length; j++) {
      var item = newItems[j]
      var id = item.id || item.getAttribute('id') || ''
      var type = getMessageType(item)
      
      var author = ''
      var text = ''
      var avatar = ''
      var amount = ''
      
      if (type === 'superchat') {
        // Super chat extraction
        author = (item.querySelector('#author-name')?.textContent?.trim()) || 
                 (item.querySelector('#author-name-chip')?.textContent?.trim()) || 
                 (item.querySelector('[id*="author"]')?.textContent?.trim()) || ''
        text = (item.querySelector('#message')?.textContent?.trim()) || 
               (item.querySelector('#content')?.textContent?.trim()) || 
               (item.querySelector('[id*="message"]')?.textContent?.trim()) || ''
        avatar = (item.querySelector('#author-photo img, #img, [id*="photo"] img')?.getAttribute('src')) || ''
        amount = (item.querySelector('#purchase-amount, .purchase-amount, [class*="purchase"]')?.textContent?.trim()) || ''
      } else {
        // Regular message extraction
        author = (item.querySelector('#author-name')?.textContent?.trim()) || 
                 (item.querySelector('[id*="author"]')?.textContent?.trim()) || ''
        text = (item.querySelector('#message')?.textContent?.trim()) || 
               (item.querySelector('[id*="message"]')?.textContent?.trim()) || ''
        avatar = (item.querySelector('#author-photo img, #img, [id*="photo"] img')?.getAttribute('src')) || ''
      }
      
      if (author && text) {
        messages.push({
          type: type,
          text: text,
          author: author,
          avatar: avatar,
          timestamp: Date.now(),
          channelId: '',
          id: id,
          amount: amount || undefined
        })
      }
    }
    
    return messages
  }
  
  function sendMessages(messages) {
    if (messages.length === 0) return
    
    try {
      var payload = {
        source: 'DANMAKUYT_CHAT',
        type: 'CHAT_MESSAGES',
        payload: {
          url: window.location.href,
          videoId: new URLSearchParams(window.location.search).get('v'),
          messages: messages,
          timestamp: Date.now()
        }
      }
      
      window.postMessage(payload, '*')
    } catch (e) {}
  }
  
  // Wait for chat to load, then observe
  function init() {
    var chatContainer = document.querySelector('yt-live-chat-app, yt-live-chat-renderer')
    if (!chatContainer) {
      setTimeout(init, 1000)
      return
    }
    
    // Extract initial messages
    var initialMessages = extractMessages()
    if (initialMessages.length > 0) {
      sendMessages(initialMessages)
    }
    
    // Watch for new messages
    var throttleTimer = null
    var pendingMessages = []
    var batchTimer = null
    
    function processBatch() {
      batchTimer = null
      if (pendingMessages.length > 0) {
        var toSend = pendingMessages.slice()
        pendingMessages = []
        sendMessages(toSend)
      }
    }
    
    var observer = new MutationObserver(function(mutations) {
      // Check if any mutation added nodes
      var hasNewNodes = false
      for (var k = 0; k < mutations.length; k++) {
        if (mutations[k].addedNodes.length > 0) {
          hasNewNodes = true
          break
        }
      }
      
      if (!hasNewNodes) return
      if (throttleTimer) return
      
      throttleTimer = setTimeout(function() {
        throttleTimer = null
        var newMessages = extractMessages()
        if (newMessages.length > 0) {
          for (var m = 0; m < newMessages.length; m++) {
            pendingMessages.push(newMessages[m])
          }
          
          // Batch send
          if (!batchTimer) {
            batchTimer = setTimeout(processBatch, 300)
          }
        }
      }, 50)
    })
    
    observer.observe(chatContainer, {
      childList: true,
      subtree: true
    })
    
    // Also set up a periodic check to catch any missed messages
    setInterval(function() {
      var messages = extractMessages()
      if (messages.length > 0) {
        sendMessages(messages)
      }
    }, 2000)
  }
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
