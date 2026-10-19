import { useSyncExternalStore } from 'react'

// ── Animations on/off ✨ ───────────────────────────────────
// Some people at the table don't want flashing, shaking and flying cards.
// "Calm mode" turns them off on THIS phone only (saved on the phone, like mute):
//   isCalm() / setCalm(true) — the ✨ button in the top bar
//   useCalm()                — re-render when it changes
// It puts a `calm` class on <html>, and App.css stops every animation under it.
// Starts calm if the phone's own "Reduce Motion" setting is on.

const CALM_KEY = 'tech-deck-calm'
let calm = false
try {
  const saved = localStorage.getItem(CALM_KEY)
  calm = saved === null ? !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches : saved === '1'
} catch { /* private mode */ }

const listeners = new Set()
function apply() {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('calm', calm)
}
apply()

export const isCalm = () => calm
export function setCalm(value) {
  calm = value
  try { localStorage.setItem(CALM_KEY, value ? '1' : '0') } catch { /* ignore */ }
  apply()
  listeners.forEach((fn) => fn())
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const useCalm = () => useSyncExternalStore(subscribe, isCalm)
