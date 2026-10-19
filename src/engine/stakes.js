// ── Playing for chips 💰 ───────────────────────────────────
//
// Any game (except poker, which IS chips) can be played for chips from
// everyone's bank (lib/bank.js). The host picks a stake in the lobby —
// Off, or 1 / 5 / 10 / 25 chips per "point" — and each game decides what a
// point is in its registry entry:
//
//   stakes: {
//     summary: ['Losers pay 1 point per card left', '…'],  // shown in the lobby + winner screen
//     settle(root) → null while the game's still going, or once it's over:
//       { points: { name: +/- points }, lines: ['Dad: 7 cards × 2 = 14', …] }
//   }
//
// Points must add up to zero — chips only move between players. Bots play
// for chips too (it's only pretend for them: they have no bank).
//
// Storage `stakes` (a LiveObject): { unit, id, result, plus tallies like
// `pass:Name` / `miss:Name` that some games count during play }.
//   • When a game ends, ONE phone works out the result and saves it.
//   • Then every phone adds its own share to its own bank — once (the game's
//     `id` is remembered on the phone, so rejoining can't pay you twice).

import { LiveObject } from '../liveblocks.config'

export const STAKE_LEVELS = [0, 1, 5, 10, 25] // 0 = not playing for chips

// Start (or restart) a game's stakes. Call from a game-starting mutation.
export function resetStakes(storage, unit) {
  storage.set('stakes', new LiveObject({ unit: unit > 0 ? unit : 0, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, result: null }))
}

// The stake per point of the game being set up (Play Again keeps it).
export function currentUnit(storage) {
  return storage.get('stakes')?.get('unit') ?? 0
}

// Count something during play (a pass, a mis-snap…) for the end-of-game
// payout. Does nothing when not playing for chips.
export function tallyStake(storage, key, by = 1) {
  const st = storage.get('stakes')
  if (!st || !(st.get('unit') > 0)) return
  st.set(key, (st.get(key) ?? 0) + by)
}

// Read a tally from a plain storage snapshot (in a settle function).
export const tallyOf = (root, key) => root.stakes?.[key] ?? 0

// Helper for settle functions: everyone in `payers` pays `amount(p)` points to `winner`.
export function payTo(winner, payers, amount) {
  const points = { [winner]: 0 }
  for (const p of payers) {
    if (p === winner) continue
    const n = amount(p)
    points[p] = (points[p] ?? 0) - n
    points[winner] += n
  }
  return points
}
