import { useState, useEffect, useCallback } from 'react'
import { storage } from 'wxt/utils/storage'
import { MessageSquare, Crown, Shield, Sparkles, X, Settings, PanelRight } from 'lucide-react'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

// Settings storage key
const SETTINGS_KEY = 'local:danmakuSettings'

// Default settings
const defaultSettings = {
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
  density: 'medium', // low, medium, high
  speed: 'normal', // slow, normal, fast
}

type Settings = typeof defaultSettings

export default function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)

  // Load settings from storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await storage.getItem<Settings>(SETTINGS_KEY)
        if (savedSettings) {
          setSettings({ ...defaultSettings, ...savedSettings })
        }
      } catch (error) {
        // Silent fail
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [])

  // Save settings to storage
  const saveSettings = useCallback(async (newSettings: Settings) => {
    try {
      await storage.setItem(SETTINGS_KEY, newSettings)
      // Notify content scripts about settings change
      browser.tabs.query({ url: '*://www.youtube.com/*' }).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, {
              type: 'DANMAKU_SETTINGS_UPDATED',
              payload: newSettings
            }).catch(() => {})
          }
        })
      })
    } catch (error) {
      // Silent fail
    }
  }, [])

  // Update a single setting
  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    saveSettings(newSettings)
  }, [settings, saveSettings])

  if (isLoading) {
    return (
      <div className="w-[360px] h-[480px] flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="w-[360px] bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-primary" />
          <h1 className="font-semibold text-lg">Danmaku Settings</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Enable Danmaku */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <MessageSquare className="size-5 text-primary" />
            <Label htmlFor="enable-danmaku" className="font-medium cursor-pointer">
              Enable Danmaku
            </Label>
          </div>
          <Switch
            id="enable-danmaku"
            checked={settings.enabled}
            onCheckedChange={(checked) => updateSetting('enabled', checked)}
          />
        </div>

        {/* Theme & Roles Section */}
        <div className="rounded-lg border">
          <div className="px-3 py-2 bg-muted/30 border-b">
            <h2 className="font-medium text-sm">Theme & Roles</h2>
          </div>
          <div className="p-3 space-y-3">
            {/* Standard */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  <span className="text-foreground">Standard:</span>{' '}
                  <span className="text-muted-foreground">[User123] Hello!</span>
                </span>
              </div>
              <Switch
                checked={settings.showStandard}
                onCheckedChange={(checked) => updateSetting('showStandard', checked)}
              />
            </div>

            {/* Member */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  <span className="text-green-500">Member:</span>{' '}
                  <span className="text-green-500">[Member456]</span>{' '}
                  <span className="text-muted-foreground">Good stream!</span>
                </span>
              </div>
              <Switch
                checked={settings.showMember}
                onCheckedChange={(checked) => updateSetting('showMember', checked)}
              />
            </div>

            {/* Moderator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  <span className="text-blue-500">Moderator:</span>{' '}
                  <span className="text-blue-500">[Mod789]</span>{' '}
                  <span className="text-muted-foreground">Welcome everyone.</span>
                </span>
              </div>
              <Switch
                checked={settings.showModerator}
                onCheckedChange={(checked) => updateSetting('showModerator', checked)}
              />
            </div>

            {/* Super Chat */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  <span className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 bg-clip-text text-transparent font-medium">
                    Super Chat:
                  </span>{' '}
                  <span className="text-muted-foreground">[SuperFan] Awesome!</span>
                </span>
              </div>
              <Switch
                checked={settings.showSuperChat}
                onCheckedChange={(checked) => updateSetting('showSuperChat', checked)}
              />
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="rounded-lg border">
          <div className="px-3 py-2 bg-muted/30 border-b">
            <h2 className="font-medium text-sm">Filter</h2>
          </div>
          <div className="p-3 grid grid-cols-2 gap-3">
            {/* Hide Standard Chat */}
            <div className="flex items-center justify-between">
              <Label htmlFor="hide-standard" className="text-xs cursor-pointer">
                Hide Standard Chat
              </Label>
              <Switch
                id="hide-standard"
                checked={settings.hideStandard}
                onCheckedChange={(checked) => updateSetting('hideStandard', checked)}
              />
            </div>

            {/* Hide Member Chat */}
            <div className="flex items-center justify-between">
              <Label htmlFor="hide-member" className="text-xs cursor-pointer">
                Hide Member Chat
              </Label>
              <Switch
                id="hide-member"
                checked={settings.hideMember}
                onCheckedChange={(checked) => updateSetting('hideMember', checked)}
              />
            </div>

            {/* Hide Moderator Chat */}
            <div className="flex items-center justify-between">
              <Label htmlFor="hide-moderator" className="text-xs cursor-pointer">
                Hide Moderator Chat
              </Label>
              <Switch
                id="hide-moderator"
                checked={settings.hideModerator}
                onCheckedChange={(checked) => updateSetting('hideModerator', checked)}
              />
            </div>

            {/* Hide Super Chat */}
            <div className="flex items-center justify-between">
              <Label htmlFor="hide-superchat" className="text-xs cursor-pointer">
                Hide Super Chat
              </Label>
              <Switch
                id="hide-superchat"
                checked={settings.hideSuperChat}
                onCheckedChange={(checked) => updateSetting('hideSuperChat', checked)}
              />
            </div>
          </div>
        </div>

        {/* Show Chat Sidebar */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <PanelRight className="size-5 text-primary" />
            <Label htmlFor="show-sidebar" className="font-medium cursor-pointer">
              Show Chat Sidebar
            </Label>
          </div>
          <Switch
            id="show-sidebar"
            checked={settings.showChatSidebar}
            onCheckedChange={(checked) => updateSetting('showChatSidebar', checked)}
          />
        </div>

        {/* Density & Speed Controls */}
        <div className="rounded-lg border">
          <div className="px-3 py-2 bg-muted/30 border-b">
            <h2 className="font-medium text-sm">Display Options</h2>
          </div>
          <div className="p-3 space-y-3">
            {/* Density */}
            <div className="space-y-2">
              <Label className="text-xs">Message Density</Label>
              <div className="flex gap-1">
                {(['low', 'medium', 'high'] as const).map((density) => (
                  <button
                    key={density}
                    onClick={() => updateSetting('density', density)}
                    className={`flex-1 py-1.5 px-2 text-xs rounded-md transition-colors ${
                      settings.density === density
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {density.charAt(0).toUpperCase() + density.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Speed */}
            <div className="space-y-2">
              <Label className="text-xs">Scroll Speed</Label>
              <div className="flex gap-1">
                {(['slow', 'normal', 'fast'] as const).map((speed) => (
                  <button
                    key={speed}
                    onClick={() => updateSetting('speed', speed)}
                    className={`flex-1 py-1.5 px-2 text-xs rounded-md transition-colors ${
                      settings.speed === speed
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {speed.charAt(0).toUpperCase() + speed.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          DanmakuYT • Reload YouTube to apply changes
        </p>
      </div>
    </div>
  )
}
