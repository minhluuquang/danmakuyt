// Content script - only injects in live chat iframe
export default defineContentScript({
  matches: ['*://www.youtube.com/*'],
  runAt: 'document_start',
  allFrames: true,

  async main(ctx) {
    // Only inject in live chat iframe, not main page
    if (!window.location.href.includes('live_chat')) {
      return;
    }
    
    injectChatInterceptor();
    
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.data?.source !== 'DANMAKUYT_CHAT') return;
      
      if (event.data.type === 'CHAT_MESSAGES') {
        browser.runtime.sendMessage({
          type: 'YOUTUBE_CHAT_MESSAGES',
          payload: event.data.payload
        }).catch(() => {});
      }
    });
  },
});

function injectChatInterceptor() {
  if (document.getElementById('danmakuyt-chat-injector')) {
    return;
  }
  
  const script = document.createElement('script');
  script.id = 'danmakuyt-chat-injector';
  script.src = browser.runtime.getURL('yt-chat-inject.js');
  script.type = 'text/javascript';
  
  const target = document.documentElement || document.head || document.body;
  if (target && target.firstChild) {
    target.insertBefore(script, target.firstChild);
  } else if (target) {
    target.appendChild(script);
  }
}
