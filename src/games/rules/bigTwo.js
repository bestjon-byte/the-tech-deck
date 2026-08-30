import { rankOf, suitOf, buildShuffledDeck } from '../../lib/cards'
import { beginTurns } from '../../engine/turns'

// ── Big Two (a.k.a. Big 2 / Deuces) ───────────────────────────
// A climbing game: empty your hand first to win. Ranks run 3 (lowest) up to
// King, Ace, then 2 (highest) — suits break ties: ♦ < ♣ < ♥ < ♠. Whoever holds
// the 3♦ leads first and must play it. Each play must be a single, a pair, a
// triple, or a 5-card poker hand (straight/flush/full house/quad/straight
// flush) — and must beat the last play of the SAME size, or you pass. When
// everyone else passes, the table clears and you lead again with anything.

const RANK_ORDER = { '3': 0, '4': 1, '5': 2, '6': 3, '7': 4, '8': 5, '9': 6, '10': 7, 'J': 8, 'Q': 9, 'K': 10, 'A': 11, '2': 12 }
const SUIT_ORDER = { '♦': 0, '♣': 1, '♥': 2, '♠': 3 }
const RANK_NAME = { '2': 'Twos', '3': 'Threes', '4': 'Fours', '5': 'Fives', '6': 'Sixes', '7': 'Sevens', '8': 'Eights', '9': 'Nines', '10': 'Tens', 'J': 'Jacks', 'Q': 'Queens', 'K': 'Kings', 'A': 'Aces' }

export function cardRank(card) { return RANK_ORDER[rankOf(card)] }
export function cardSuit(card) { return SUIT_ORDER[suitOf(card)] }

// Compare two cards for who "wins" — higher rank first, suit breaks ties.
function compareCards(a, b) {
  if (cardRank(a) !== cardRank(b)) return cardRank(a) - cardRank(b)
  return cardSuit(a) - cardSuit(b)
}

// Sort low → high in Big Two's own order (not the generic A-first deck order).
export function sortForBigTwo(cards) {
  return [...cards].sort(compareCards)
}

function rankCounts(cards) {
  const counts = {}
  for (const c of cards) counts[rankOf(c)] = (counts[rankOf(c)] ?? 0) + 1
  return counts
}

// 5-card hand types, worst to best — a higher tier always beats a lower one
// regardless of rank (e.g. any flush beats any straight).
const TIER = { straight: 0, flush: 1, fullhouse: 2, quad: 3, straightflush: 4 }

function identifyFiveCardHand(cards) {
  const sorted = sortForBigTwo(cards)
  const ranks = sorted.map(cardRank)
  const suits = sorted.map(cardSuit)
  const isFlush = suits.every((s) => s === suits[0])
  const isStraight = new Set(ranks).size === 5 && ranks[4] - ranks[0] === 4 && ranks[4] !== 12 // no straight may reach the 2
  const counts = rankCounts(cards)
  const groups = Object.values(counts).sort((a, b) => b - a)
  const rankWithCount = (n) => RANK_ORDER[Object.keys(counts).find((k) => counts[k] === n)]
  const top = sorted[4] // highest card, used to compare straights/flushes

  if (isFlush && isStraight) return { type: 'straightflush', size: 5, key: TIER.straightflush * 100 + cardRank(top) * 4 + cardSuit(top) }
  if (groups[0] === 4) return { type: 'quad', size: 5, key: TIER.quad * 100 + rankWithCount(4) }
  if (groups[0] === 3 && groups[1] === 2) return { type: 'fullhouse', size: 5, key: TIER.fullhouse * 100 + rankWithCount(3) }
  if (isFlush) return { type: 'flush', size: 5, key: TIER.flush * 100 + cardRank(top) * 4 + cardSuit(top) }
  if (isStraight) return { type: 'straight', size: 5, key: TIER.straight * 100 + cardRank(top) * 4 + cardSuit(top) }
  return null
}

// Work out what kind of Big Two combo a set of selected cards forms. Returns
// null if it isn't a legal shape at all (e.g. 4 cards, or mismatched ranks).
export function identifyCombo(cards) {
  const n = cards.length
  if (n === 1) return { type: 'single', size: 1, key: cardRank(cards[0]) * 4 + cardSuit(cards[0]) }
  if (n === 2) {
    if (cardRank(cards[0]) !== cardRank(cards[1])) return null
    return { type: 'pair', size: 2, key: cardRank(cards[0]) * 4 + Math.max(cardSuit(cards[0]), cardSuit(cards[1])) }
  }
  if (n === 3) {
    if (cards.every((c) => cardRank(c) === cardRank(cards[0]))) return { type: 'triple', size: 3, key: cardRank(cards[0]) }
    return null
  }
  if (n === 5) return identifyFiveCardHand(cards)
  return null
}

// Does combo `a` beat the currently-live combo `b`? Both must already be
// identified (non-null) and the same size.
export function comboBeats(a, b) {
  if (a.size !== b.size) return false
  if (a.size === 5 && a.type !== b.type) return TIER[a.type] > TIER[b.type]
  if (a.size !== 5 && a.type !== b.type) return false
  return a.key > b.key
}

// Is this selection a legal play right now? `trickType` is the live combo to
// beat (null if the table is clear and this player is leading).
export function isLegalPlay(cards, trickType, mustStartWith3D) {
  const combo = identifyCombo(cards)
  if (!combo) return false
  if (mustStartWith3D && !cards.some((c) => rankOf(c) === '3' && suitOf(c) === '♦')) return false
  if (!trickType) return true
  return combo.size === trickType.size && comboBeats(combo, trickType)
}

// A friendly description of a combo, for action messages and the Play button.
export function describeCombo(combo, cards) {
  const r = (c) => rankOf(c)
  switch (combo.type) {
    case 'single': return cards[0].label
    case 'pair': return `a pair of ${RANK_NAME[r(cards[0])]}`
    case 'triple': return `three ${RANK_NAME[r(cards[0])]}`
    case 'straight': return `a straight (${sortForBigTwo(cards).map(r).join('-')})`
    case 'flush': return `a flush (${suitOf(cards[0])})`
    case 'fullhouse': {
      const counts = rankCounts(cards)
      const tripleRank = Object.keys(counts).find((k) => counts[k] === 3)
      const pairRank = Object.keys(counts).find((k) => counts[k] === 2)
      return `a full house (${RANK_NAME[tripleRank]} full of ${RANK_NAME[pairRank]})`
    }
    case 'quad': {
      const counts = rankCounts(cards)
      const quadRank = Object.keys(counts).find((k) => counts[k] === 4)
      return `FOUR ${RANK_NAME[quadRank]} 💣`
    }
    case 'straightflush': return `a straight flush (${sortForBigTwo(cards).map(r).join('-')}) 💣💣`
    default: return `${cards.length} cards`
  }
}

// Whoever holds the 3♦ leads first (the classic Big Two opening rule).
function findThreeDiamondHolder(storage, playerIds) {
  const hands = storage.get('hands')
  for (const p of playerIds) {
    if ((hands.get(p) ?? []).some((c) => rankOf(c) === '3' && suitOf(c) === '♦')) return p
  }
  return playerIds[0] ?? ''
}

// How many cards each player gets. The classic game is 4 players at 13 each;
// 2 and 3 players both get 17 so hands feel the same size either way. Any
// player count that doesn't divide evenly just leaves a few cards undealt.
function handSizeFor(n) {
  if (n === 4) return 13
  if (n === 2 || n === 3) return 17
  return Math.floor(52 / n) || 52
}

// Deal each player a fixed-size hand and set up the table for a fresh round.
// Whatever's left over after dealing sits out of play for the round (kept in
// the shared deck pile, though Big Two never draws from it).
export function setupBigTwo({ storage, playerIds }) {
  const deck = buildShuffledDeck()
  const size = handSizeFor(playerIds.length)
  const hands = storage.get('hands')
  playerIds.forEach((id, i) => {
    hands.set(String(id), sortForBigTwo(deck.slice(i * size, (i + 1) * size)))
  })
  const leftover = deck.slice(playerIds.length * size)
  const deckList = storage.get('deck')
  leftover.forEach((c) => deckList.push(c))

  beginTurns(storage, playerIds)
  const starter = findThreeDiamondHolder(storage, playerIds)
  storage.set('currentTurn', starter)

  // If the deal was small enough that the 3♦ itself was left undealt, nobody
  // can ever satisfy "must include the 3♦" — so skip that opening restriction.
  const has3D = !leftover.some((c) => rankOf(c) === '3' && suitOf(c) === '♦')

  const bt = storage.get('bigTwo')
  bt.set('currentTrick', [])
  bt.set('trickType', null)
  bt.set('leader', '')
  bt.set('passCount', 0)
  bt.set('finished', [])
  bt.set('mustStartWith3D', has3D)

  const la = storage.get('lastAction')
  la.set('message', has3D ? `${starter} holds the 3♦ and leads first` : `${starter} leads first`)
  la.set('id', 0)
}
