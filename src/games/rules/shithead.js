import { rankOf, buildShuffledDeck } from '../../lib/cards'
import { beginTurns } from '../../engine/turns'

// ── Shithead ───────────────────────────────────────────────
// A "beating" game: get rid of all your cards (hand, then your 3 face-up, then
// your 3 face-down blind cards). You must play a card equal to or higher than
// the top of the pile — or pick the whole pile up. Magic cards keep it spicy:
//   2  — resets the pile (play on anything, anything plays next)
//   10 — burns the pile out of the game; play again
//   7  — the next player must go LOWER than 7
//   four of the same rank in a row also burns the pile.
// The last player still holding cards is the Shithead!

// Card power: 4 is the floor, Ace is the ceiling. 2, 3 and 10 are magic
// (handled specially), but still get a value for completeness.
const SHED_ORDER = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 }
export function shedVal(card) { return SHED_ORDER[rankOf(card)] }

// The card you actually have to beat. A 3 is a "glass" card — invisible — so
// you see straight through any 3s on top to the first solid card beneath.
// Returns null if the pile is empty (or only 3s).
export function effectiveTop(pile) {
  if (!pile) return null
  for (let i = pile.length - 1; i >= 0; i--) {
    if (rankOf(pile[i]) !== '3') return pile[i]
  }
  return null
}

// Can `card` be legally played, given the effective top card (3s seen through;
// null if the pile is empty)?
export function canPlay(card, top) {
  const r = rankOf(card)
  if (r === '2' || r === '3') return true // 2 resets, 3 is glass — always playable
  if (r === '10') return !(top && rankOf(top) === '7') // 10 burns anything except a 7
  if (!top) return true
  const tr = rankOf(top)
  if (tr === '2') return true // anything goes on a 2
  if (tr === '7') return shedVal(card) < 7 // must go lower than a 7
  return shedVal(card) >= shedVal(top)
}

export function canPlayAny(cards, top) {
  return (cards || []).some((c) => canPlay(c, top))
}

// How many cards on top of the pile share the top card's rank (used to spot a
// four-of-a-kind, which burns the pile).
export function topRankRun(pile) {
  if (!pile || pile.length === 0) return 0
  const r = rankOf(pile[pile.length - 1])
  let n = 0
  for (let i = pile.length - 1; i >= 0; i--) {
    if (rankOf(pile[i]) === r) n++
    else break
  }
  return n
}

// Read the discard (the live pile) out as a plain array, top card last.
export function readPile(storage) {
  const discard = storage.get('discardPile')
  const arr = []
  for (let i = 0; i < discard.length; i++) arr.push(discard.get(i))
  return arr
}

// Deal everyone 3 face-down (blind), 3 face-up (on top of them), and 3 in hand.
// The rest is the draw pile. Players then get to swap hand/face-up cards before
// play begins, so the game starts in the 'swap' phase.
export function setupShithead({ storage, playerIds }) {
  const deck = buildShuffledDeck()
  const hands = storage.get('hands')
  const faceUp = {}
  const faceDown = {}
  let i = 0
  for (const p of playerIds) {
    faceDown[p] = deck.slice(i, i + 3); i += 3
    faceUp[p] = deck.slice(i, i + 3); i += 3
    hands.set(p, deck.slice(i, i + 3)); i += 3
  }
  const deckList = storage.get('deck')
  deck.slice(i).forEach((c) => deckList.push(c))

  beginTurns(storage, playerIds)
  const shed = storage.get('shed')
  shed.set('phase', 'swap')
  shed.set('faceDown', faceDown) // only ever changed on a player's own turn
  shed.set('finished', [])
  shed.set('burned', 0)
  // Face-up cards and readiness are tracked as one key per player (`fu:Name`,
  // `ready:Name`) so simultaneous swaps/ready-ups in the swap phase — when every
  // player acts at once — can't clobber each other.
  for (const p of playerIds) {
    shed.set(`fu:${p}`, faceUp[p])
    shed.set(`ready:${p}`, false)
  }
  storage.set('currentTurn', '') // chosen once everyone's ready

  const la = storage.get('lastAction')
  la.set('message', '')
  la.set('id', 0)
}

// Whoever holds the lowest ordinary card starts (a 3 if anyone has one, else a
// 4, …). Magic 2s and 10s don't count as a starting card.
export function findStarter(storage, playerIds) {
  const hands = storage.get('hands')
  let best = null
  for (const p of playerIds) {
    for (const c of (hands.get(p) ?? [])) {
      const r = rankOf(c)
      if (r === '2' || r === '10') continue
      const v = shedVal(c)
      if (best === null || v < best.v) best = { p, v }
    }
  }
  return best ? best.p : (playerIds[0] ?? '')
}
