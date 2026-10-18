// ── Announcements: "what just happened" + its special effect ──
//
// Every move tells the table what happened with
//
//   announce(storage, 'Sam played 8♥', fx)
//
// The message shows as the little toast (useActionMessage). The optional `fx`
// is a special effect EVERY phone plays — a big "SNAP!", cards flying between
// players, a Go Fish speech bubble… — drawn by components/FXLayer.jsx.
// `fx` can be one effect or a list; an effect with `to: 'Sam'` only plays on
// Sam's phone (a private "Uh oh, a Queen!").
//
// Only the player making the move calls this, inside their mutation.

import { useState, useEffect } from 'react'
import { useStorage } from '../liveblocks.config'

export function announce(storage, message, fx = null) {
  const la = storage.get('lastAction')
  la.set('message', message)
  // A unique key so every phone plays each effect exactly once.
  la.set('fx', fx ? { key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, show: [].concat(fx) } : null)
  la.set('id', (la.get('id') ?? 0) + 1)
}

// Wipe the message (used when a game is set up).
export function clearAnnouncements(storage, message = '') {
  const la = storage.get('lastAction')
  la.set('message', message)
  la.set('fx', null)
  la.set('id', 0)
}

// The toast text for a board: shows each new message, hides it after a while.
export function useActionMessage(hideAfter = 3500) {
  const lastAction = useStorage((root) => root.lastAction)
  const [shownId, setShownId] = useState(0)
  const [message, setMessage] = useState('')

  // A brand-new action arrived → show it. (Adjusting state during render,
  // guarded by the id, is React's recommended way to react to new data.)
  if (lastAction && lastAction.id !== shownId && lastAction.message) {
    setShownId(lastAction.id)
    setMessage(lastAction.message)
  }

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), hideAfter)
    return () => clearTimeout(t)
  }, [message, shownId, hideAfter])

  return message
}
