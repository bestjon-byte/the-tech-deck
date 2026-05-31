import { rankOf } from '../../lib/cards'

// ── Go Fish rule: completing a "book" ──────────────────────
// A book is all four cards of one rank (four Kings, four 7s...). When a hand
// contains a full set, those cards leave the hand and the rank is "laid down".
// Returns the hand with any books removed, plus the ranks that were completed.
export function extractBooks(hand) {
  const counts = {}
  for (const card of hand) {
    const rank = rankOf(card)
    counts[rank] = (counts[rank] || 0) + 1
  }
  const bookRanks = Object.entries(counts).filter(([, n]) => n === 4).map(([r]) => r)
  return {
    newHand: hand.filter((c) => !bookRanks.includes(rankOf(c))),
    bookRanks,
  }
}
