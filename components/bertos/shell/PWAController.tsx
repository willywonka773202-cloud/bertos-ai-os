'use client'

import { useEffect } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

declare global {
  interface Window {
    __bertosInstallPrompt?: BeforeInstallPromptEvent
  }
}

export function PWAController() {
  useEffect(() => {
    const installPromptHandler = (event: Event) => {
      event.preventDefault()
      window.__bertosInstallPrompt = event as BeforeInstallPromptEvent
      window.dispatchEvent(new CustomEvent('bertos-pwa-installable'))
    }

    const installedHandler = () => {
      window.__bertosInstallPrompt = undefined
      window.localStorage.setItem('bertos-pwa-installed-at', new Date().toISOString())
      window.dispatchEvent(new CustomEvent('bertos-pwa-installed'))
    }

    window.addEventListener('beforeinstallprompt', installPromptHandler)
    window.addEventListener('appinstalled', installedHandler)

    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        window.dispatchEvent(new CustomEvent('bertos-pwa-sw-error'))
      })
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', installPromptHandler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  return null
}
