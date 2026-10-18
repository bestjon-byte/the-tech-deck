// ── Who's in charge? ───────────────────────────────────────
//
// Some moves happen *by themselves* a moment after something else — clearing
// a finished trick, starting Shithead once everyone's ready, handing out a
// snapped pile. Exactly ONE phone should do each of these, or two phones could
// do it twice.
//
// Before, that was always one particular phone (e.g. the trick winner's). If
// that phone was locked, out of signal or closed, everyone else got stuck
// waiting for it. Now:
//
//   • The `preferred` player's phone does it, if they're online.
//   • If they're not, the first online player in `order` takes over.
//   • A phone only does it while it's properly connected — so a phone waking
//     up with old, out-of-date cards can't redo something already done.

import { useOthers, useStatus } from '../liveblocks.config'

export function useInCharge(myId, preferred, order) {
  const status = useStatus()
  const others = useOthers()
  if (status !== 'connected') return false

  const online = new Set([myId, ...others.map((o) => o.presence.playerId)])
  const boss = online.has(preferred) ? preferred : order.find((p) => online.has(p))
  return boss === myId
}
