import { useEffect } from 'react'

// ── Keep the screen awake while you're in a game ───────────
// When a phone's screen locks, it drops its connection to the game — and when
// it unlocks it has to reconnect and catch up, which feels like a big delay.
// The browser's "wake lock" asks the phone not to auto-lock while the game is
// open. The phone lets go of it whenever you leave the app, so we ask again
// each time you come back. Phones that don't support it just ignore this.
export function useKeepAwake() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock = null
    let stopped = false

    async function grab() {
      if (stopped || document.visibilityState !== 'visible' || (lock && !lock.released)) return
      try {
        const newLock = await navigator.wakeLock.request('screen')
        if (stopped) newLock.release()
        else lock = newLock
      } catch {
        // Not allowed right now (e.g. low battery mode) — try again on the next tap
      }
    }

    grab()
    document.addEventListener('visibilitychange', grab)
    document.addEventListener('pointerdown', grab)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', grab)
      document.removeEventListener('pointerdown', grab)
      lock?.release()
    }
  }, [])
}
