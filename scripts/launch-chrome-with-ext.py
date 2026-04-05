#!/usr/bin/env python3
"""
Launch Chrome with DanmakuYT extension pre-loaded for automated testing
"""
import subprocess
import os
import time
import sys

# Extension path
EXT_PATH = "/Users/leo/projects/danmakuyt/.output/chrome-mv3"

# Chrome profile path (use a dedicated test profile)
PROFILE_PATH = "/Users/leo/projects/danmakuyt/.wxt/chrome-test-profile"

# Ensure profile directory exists
os.makedirs(PROFILE_PATH, exist_ok=True)

# Chrome binary path (macOS)
CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Build Chrome arguments
chrome_args = [
    CHROME_PATH,
    f"--load-extension={EXT_PATH}",
    f"--user-data-dir={PROFILE_PATH}",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-default-apps",
    "--disable-extensions-file-access-check",
    "--remote-debugging-port=9222",  # Enable DevTools Protocol
    "--start-maximized",
    "--enable-logging",
    "--v=1",
    # Open YouTube live stream directly
    "https://www.youtube.com/watch?v=OXGHwyzFD4A"
]

print(f"Launching Chrome with extension: {EXT_PATH}")
print(f"Profile: {PROFILE_PATH}")
print(f"Command: {' '.join(chrome_args)}")

# Launch Chrome
process = subprocess.Popen(
    chrome_args,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

print(f"Chrome started with PID: {process.pid}")
print("Waiting for Chrome to initialize...")

# Wait for Chrome to start
time.sleep(5)

print("Chrome should be ready. Check if extension is loaded...")
print(f"Process status: {process.poll()}")
