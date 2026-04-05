#!/usr/bin/env python3
"""
Test DanmakuYT extension by directly injecting the interceptor script
This bypasses the need to load the extension through Chrome UI
"""
import json

# Read the yt-chat-inject.js file
with open('/Users/leo/projects/danmakuyt/.output/chrome-mv3/yt-chat-inject.js', 'r') as f:
    inject_script = f.read()

# Create a bookmarklet-style injection script
bookmarklet = f"""
javascript:(function(){{
    // Remove existing injector if present
    const existing = document.getElementById('danmakuyt-chat-injector');
    if (existing) existing.remove();
    
    // Create and inject script
    const script = document.createElement('script');
    script.id = 'danmakuyt-chat-injector';
    script.type = 'text/javascript';
    script.textContent = `{inject_script.replace('`', '\\`').replace('${', '\\${')}`;
    
    // Insert at document start
    (document.head || document.documentElement).appendChild(script);
    console.log('[DanmakuYT] Injected!');
}})();
"""

# Output the script for use
print("Extension injection script ready")
print(f"Script length: {len(inject_script)} characters")
print(f"\nTo test manually, copy this and paste in browser console:")
print("-" * 80)
print(bookmarklet[:500] + "..." if len(bookmarklet) > 500 else bookmarklet)
