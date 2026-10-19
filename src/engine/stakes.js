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

// Nobody can lose more chips than they've got, so a big loss is cut down to
// the loser's whole bank — and the winners share only what was really paid
// (so chips are never made out of thin air). Bots have no bank: they pay in full.
//   capToBanks({ Sam: 300, Dad: -300 }, { Dad: 120 }) → { chips: { Sam: 120, Dad: -120 }, capped: ['Dad'] }
export function capToBanks(raw, banks) {
  const chips = { ...raw }
  const capped = []
  let short = 0
  for (const [p, n] of Object.entries(raw)) {
    const has = banks[p]
    if (n < 0 && typeof has === 'number' && -n > has) {
      chips[p] = -has
      short += -n - has
      capped.push(p)
    }
  }
  if (!short) return { chips, capped }
  const winners = Object.keys(raw).filter((p) => raw[p] > 0).sort((a, b) => raw[b] - raw[a])
  const won = winners.reduce((t, p) => t + raw[p], 0)
  const toShare = won - short
  let given = 0
  for (const p of winners) { chips[p] = Math.floor(raw[p] * toShare / won); given += chips[p] }
  if (winners.length) chips[winners[0]] += toShare - given // odd chips to the biggest winner
  return { chips, capped }
}
