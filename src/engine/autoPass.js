// ── Auto-pass ⏭ ────────────────────────────────────────────
//
// When the player whose turn it is has NO legal move, nobody should have to
// wait for them to notice. After a short countdown (so everyone can see why),
// the turn passes by itself.
//
//   stuck — true when the current player can't move (every phone can work
//           this out, because everyone's cards are in shared storage)
//   act   — a useMutation(currentTurn) that RE-CHECKS they're still stuck,
//           then passes / draws / picks up for them
//
// Like every automatic move, exactly ONE phone does it: the stuck player's own
// phone, or the next online player's if theirs is away (see inCharge.js).

import { useEffect } from 'react'
import { useInCharge } from './inCharge'

export const AUTO_PASS_MS = 2200

export function useAutoPass({ myId, currentTurn, order, stuck, act, watch }) {
  const iDoIt = useInCharge(myId, currentTurn, order)
  useEffect(() => {
    if (!stuck || !iDoIt || !currentTurn) return
    const t = setTimeout(() => act(currentTurn), AUTO_PASS_MS)
    return () => clearTimeout(t)
  }, [stuck, iDoIt, currentTurn, act, watch])
}
