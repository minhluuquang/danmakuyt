(function() {
  'use strict';
  
  // Only run in live chat iframe
  if (!window.location.href.includes('live_chat')) return;
  if (window.__danmakuytInstalled) return;
  window.__danmakuytInstalled = true;
  
  let lastProcessedId = '';
  
  function extractMessages() {
    const messages = [];
    const chatItems = document.querySelectorAll('yt-live-chat-text-message-renderer');
    
    let foundNew = false;
    
    for (const item of chatItems) {
      const id = item.id || '';
      
      // Skip already processed
      if (id && id === lastProcessedId) {
        foundNew = true;
        continue;
      }
      
      // If we found the last processed one, everything after is new
      if (foundNew || !lastProcessedId) {
        const author = item.querySelector('#author-name')?.textContent?.trim() || '';
        const text = item.querySelector('#message')?.textContent?.trim() || '';
        const avatar = item.querySelector('#img')?.src || '';
        
        if (author && text) {
          messages.push({
            type: 'text',
            text: text,
            author: author,
            avatar: avatar,
            timestamp: Date.now(),
            channelId: '',
            id: id
          });
        }
        
        // Remember the last item we processed
        if (!lastProcessedId || messages.length === 1) {
          lastProcessedId = id;
        }
      }
    }
    
    return messages;
  }
  
  function sendMessages(messages) {
    if (messages.length === 0) return;
    
    try {
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
    } catch (e) {}
  }
  
  // Wait for chat to load, then observe
  function init() {
    const chatContainer = document.querySelector('yt-live-chat-app');
    if (!chatContainer) {
      setTimeout(init, 1000);
      return;
    }
    
    // Extract initial messages
    const initialMessages = extractMessages();
    if (initialMessages.length > 0) {
      sendMessages(initialMessages);
    }
    
    // Watch for new messages
    const observer = new MutationObserver(() => {
      const newMessages = extractMessages();
      if (newMessages.length > 0) {
        sendMessages(newMessages);
      }
    });
    
    observer.observe(chatContainer, {
      childList: true,
      subtree: true
    });
  }
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
