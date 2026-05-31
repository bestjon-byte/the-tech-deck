import { SUITS, VALUES, rankOf, suitOf } from '../../lib/cards'
import { dealAll } from '../../engine/table'
import { beginTurns } from '../../engine/turns'

// Set up Sevens: deal the whole deck out and start turns. The table (the
// discard pile) starts empty — someone has to play a 7 first.
export function setupSevens({ storage, playerIds }) {
  dealAll(storage, playerIds)
  beginTurns(storage, playerIds)
  const la = storage.get('lastAction')
  la.set('message', '')
  la.set('id', 0)
}

const ORDER = Object.fromEntries(VALUES.map((v, i) => [v, i]))
const SEVEN = ORDER['7']

// Work out, for each suit, the lowest and highest card value currently on the
// table. Returns e.g. { '♥': { min: 4, max: 9 }, ... } using value positions
// (A=0 … K=12). A suit with no entry hasn't been started yet.
export function suitRanges(tableauCards) {
  const ranges = {}
  for (const card of tableauCards) {
    const s = suitOf(card)
    const o = ORDER[rankOf(card)]
    if (!ranges[s]) ranges[s] = { min: o, max: o }
    else {
      ranges[s].min = Math.min(ranges[s].min, o)
      ranges[s].max = Math.max(ranges[s].max, o)
    }
  }
  return ranges
}

// Can this card be played onto the table right now?
//  • A 7 starts its suit.
//  • Otherwise it must sit right next to its suit's current run (one above the
//    top card, or one below the bottom card).
export function canPlay(card, ranges) {
  const o = ORDER[rankOf(card)]
  const r = ranges[suitOf(card)]
  if (!r) return o === SEVEN
  return o === r.min - 1 || o === r.max + 1
}

// Does this player have any legal move? If not, they must pass.
export function hasAnyMove(hand, ranges) {
  return hand.some((card) => canPlay(card, ranges))
}

// The suits in display order, handy for laying out the four rows.
export const SUIT_ROWS = SUITS
