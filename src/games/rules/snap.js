import { LiveObject } from '../../liveblocks.config'
import { dealAll } from '../../engine/table'
import { beginTurns } from '../../engine/turns'
import { clearAnnouncements } from '../../engine/announce'

// How long after the first SNAP everyone else still has to get theirs in.
// The drumroll plays for this long, then the fastest reaction wins.
export const SNAP_WINDOW_MS = 2000

// Set up Snap: deal the whole deck out as face-down stacks and start turns.
//
// Storage `snap` holds:
//   claim:Name → { match, ms }  — Name hit SNAP on the match whose top card is
//                                 `match`, `ms` after it appeared on THEIR phone
//   result     → { match, winner, count, times: [{ name, ms }] } — the last
//                                 snap decided, so every phone shows the reveal
// Everyone writes only their own claim key, so two snaps at once can never
// wipe each other out (one shared "winner" key did — last write won, which
// meant the SLOWEST snap to reach the server took the pile).
export function setupSnap({ storage, playerIds }) {
  dealAll(storage, playerIds)
  beginTurns(storage, playerIds)
  storage.set('snap', new LiveObject({}))
  clearAnnouncements(storage)
}

// Everyone who snapped on one match, fastest first (a dead heat goes to
// whoever's earlier in the play order). `snap` is a plain object.
export function claimsFor(snap, match, order = []) {
  if (match == null) return []
  const seat = (name) => { const i = order.indexOf(name); return i < 0 ? order.length : i }
  return Object.entries(snap ?? {})
    .filter(([key, claim]) => key.startsWith('claim:') && claim?.match === match)
    .map(([key, claim]) => ({ name: key.slice('claim:'.length), ms: claim.ms }))
    .sort((a, b) => a.ms - b.ms || seat(a.name) - seat(b.name))
}

// 0.312s
export const secs = (ms) => `${(ms / 1000).toFixed(3)}s`
