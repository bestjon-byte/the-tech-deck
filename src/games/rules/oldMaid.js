import { rankOf, buildShuffledDeck } from '../../lib/cards'
import { dealAll } from '../../engine/table'
import { beginTurns } from '../../engine/turns'

// Set up Old Maid: remove one Queen (so it can never be paired — that's the
// "Old Maid"), deal the rest out, then everyone throws away the pairs they were
// dealt.
export function setupOldMaid({ storage, playerIds }) {
  const deck = buildShuffledDeck().filter((c) => c.label !== 'Q♣')
  dealAll(storage, playerIds, deck)
  const hands = storage.get('hands')
  for (const pid of playerIds) {
    hands.set(pid, extractPairs(hands.get(pid) ?? []).newHand)
  }
  beginTurns(storage, playerIds)
  const la = storage.get('lastAction')
  la.set('message', '')
  la.set('id', 0)
}

// ── Old Maid rule: throw away pairs ────────────────────────
// Keep at most one card of each rank — every matching pair is discarded.
// Returns the hand with pairs removed and how many pairs went.
export function extractPairs(hand) {
  const byRank = {}
  for (const card of hand) {
    const r = rankOf(card)
    ;(byRank[r] = byRank[r] || []).push(card)
  }
  const newHand = []
  let pairsRemoved = 0
  for (const cards of Object.values(byRank)) {
    pairsRemoved += Math.floor(cards.length / 2)
    if (cards.length % 2 === 1) newHand.push(cards[cards.length - 1]) // keep the odd one
  }
  return { newHand, pairsRemoved }
}
