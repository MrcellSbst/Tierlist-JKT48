import React, { useState } from 'react'
import './HardRefreshButton.css'

/**
 * Floating hard-refresh button — appears on every page.
 * Clears the service worker and all Cache Storage entries before
 * reloading so Cloudflare always serves the latest assets.
 */
export default function HardRefreshButton() {
  const [state, setState] = useState('idle') // idle | refreshing | done

  const handleRefresh = async () => {
    if (state === 'refreshing') return
    setState('refreshing')

    try {
      // 1. Unregister all service workers (PWA cache)
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map(r => r.unregister()))
      }

      // 2. Wipe every Cache Storage bucket (workbox, image caches, etc.)
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }

      // 3. Hard-reload — browser fetches fresh HTML from Cloudflare
      window.location.reload(true)
    } catch (err) {
      // Fallback: plain reload even if SW / cache APIs fail
      window.location.reload(true)
    }
  }

  return (
    <button
      id="hard-refresh-btn"
      className={`hard-refresh-btn hard-refresh-btn--${state}`}
      onClick={handleRefresh}
      aria-label="Hard refresh page"
      title="Hard Refresh — fetch latest update from server"
      disabled={state === 'refreshing'}
    >
      <span className="hard-refresh-icon" aria-hidden="true">
        {state === 'refreshing' ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" strokeOpacity="0.3"/>
            <path d="M12 3a9 9 0 0 1 9 9" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        )}
      </span>
      <span className="hard-refresh-label">
        {state === 'refreshing' ? 'Refreshing…' : 'Hard Refresh'}
      </span>
    </button>
  )
}
