// ── 👀 Spectator mode ──────────────────────────────────────
//
// Once you're out of a game (or just watching the room), you can ask to see
// someone's hand and follow it live. They get a pop-up and say yes or no —
// and they can stop you watching any time. Watching a 🤖 bot needs no
// permission.
//
// Storage `watch` (a LiveObject), one key per person so nobody overwrites
// anybody else:
//   req:Viewer → { target, id }   written only by the viewer (ask / stop)
//   ans:Viewer → { id, ok, stopped }  written only by the target (yes / no / stop)
// An answer only counts if its `id` matches the viewer's current request, so
// an old "yes" can't leak into a new request.
// resetTable() wipes it at the start of every game.
// The UI is components/Spectate.jsx; who counts as "out" is games/spectateRules.js.

import { LiveObject } from '../liveblocks.config'

function watchObj(storage) {
  if (!storage.get('watch')) storage.set('watch', new LiveObject({})) // rooms made before spectating existed
  return storage.get('watch')
}

export function resetWatch(storage) {
  storage.set('watch', new LiveObject({}))
}

export function requestWatch(storage, viewer, target) {
  watchObj(storage).set(`req:${viewer}`, { target, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` })
}

export function stopWatching(storage, viewer) {
  watchObj(storage).delete(`req:${viewer}`)
}

// The target says yes / no to a viewer's request — or stops them later
// (stopped: true, so the viewer sees "stopped watching", not "said no").
export function answerWatch(storage, target, viewer, ok, stopped = false) {
  const w = watchObj(storage)
  const req = w.get(`req:${viewer}`)
  if (!req || req.target !== target) return
  w.set(`ans:${viewer}`, { id: req.id, ok, stopped })
}

// Where a viewer's request stands (from a plain snapshot): null if they
// haven't asked, else { target, state: 'waiting' | 'yes' | 'no' | 'stopped' }.
export function watchState(watch, viewer, bots = {}) {
  const req = watch?.[`req:${viewer}`]
  if (!req) return null
  if (bots[req.target]) return { target: req.target, state: 'yes' } // bots don't mind
  const ans = watch?.[`ans:${viewer}`]
  if (!ans || ans.id !== req.id) return { target: req.target, state: 'waiting' }
  return { target: req.target, state: ans.ok ? 'yes' : ans.stopped ? 'stopped' : 'no' }
}
