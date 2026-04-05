import tailwindcss from '@tailwindcss/vite'
import { mkdirSync } from 'node:fs'
import { defineConfig } from 'wxt'

const chromeProfile = '.wxt/chrome-data'
mkdirSync(chromeProfile, { recursive: true })

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  webExt: {
    chromiumProfile: chromeProfile,
    keepProfileChanges: true,
    chromiumArgs: ['--hide-crash-restore-bubble'],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    define: {
      __VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
    },
    optimizeDeps: {
      force: true,
    },
    build: {
      minify: false,
      chunkSizeWarningLimit: 2000,
      cssCodeSplit: true,
      rollupOptions: {
        onwarn: function (message, handler) {
          if (message.code === 'EVAL') return
          handler(message)
        },
      },
    },
  }),
  zip: {
    artifactTemplate: 'danmakuyt-{{version}}-{{browser}}.zip',
  },
  manifest: {
    default_locale: 'en',
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    permissions: ['tabs', 'storage'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      64: 'icon-64.png',
      128: 'icon-128.png',
    },
    action: {
      default_title: '__MSG_extActionTitle__',
      default_popup: 'popup/index.html',
    },
    web_accessible_resources: [{
      resources: ['yt-chat-inject.js'],
      matches: ['*://www.youtube.com/*']
    }],
  },
})
