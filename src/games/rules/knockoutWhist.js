import { SUITS, rankOf, suitOf, buildShuffledDeck } from '../../lib/cards'
import { beginTurns } from '../../engine/turns'

// ── Knockout Whist ─────────────────────────────────────────
// A trick-taking elimination game. Each round, everyone is dealt a hand and
// plays one card per trick (following the led suit if they can). The highest
// card of the led suit wins — unless someone trumps. Win at least one trick or
// you're knocked out; the very first player knocked out gets one "dog's life".
// Hands shrink by one card every round (7, 6, 5 … 1) and the last player
// standing wins. The winner of each round chooses trumps for the next.

// Whist ranks the Ace HIGH, so it gets its own order (separate from cards.js,
// where Ace is low for sorting).
const WHIST_ORDER = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '10': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12 }
export function cardValue(card) { return WHIST_ORDER[rankOf(card)] }

export const WHIST_SUITS = SUITS

// How many cards each player gets this round: 7 in round 1, then one fewer each
// round, down to a single card.
export function cardsForRound(round) { return Math.max(1, 8 - round) }

// Deal a fresh hand to every alive player (players on a dog's life get a single
// card). Players who are out get an empty hand. When `flip` is true (round 1)
// the next card is turned up to set trumps. Returns { trumpCard, tricksWon }.
export function dealWhistRound(storage, { seating, alive, round, dogs, flip }) {
  const n = cardsForRound(round)
  const deck = buildShuffledDeck()
  const hands = storage.get('hands')
  const tricksWon = {}
  let i = 0
  for (const p of seating) {
    if (!alive.includes(p)) { hands.set(p, []); continue }
    const count = dogs.includes(p) ? 1 : n
    hands.set(p, deck.slice(i, i + count))
    i += count
    tricksWon[p] = 0
  }
  let trumpCard = null
  if (flip && i < deck.length) { trumpCard = deck[i] }
  return { trumpCard, tricksWon }
}

// Set up a brand-new game: deal round 1 and flip a trump card.
export function setupKnockoutWhist({ storage, playerIds }) {
  const seating = [...playerIds]
  const { trumpCard, tricksWon } = dealWhistRound(storage, { seating, alive: seating, round: 1, dogs: [], flip: true })
  beginTurns(storage, seating)
  const whist = storage.get('whist')
  whist.set('seating', seating)
  whist.set('alive', seating)
  whist.set('round', 1)
  whist.set('trump', trumpCard ? suitOf(trumpCard) : '♠')
  whist.set('trumpCardLabel', trumpCard ? trumpCard.label : '')
  whist.set('phase', 'play')
  whist.set('trick', [])
  whist.set('leadSuit', '')
  whist.set('trickWinner', '')
  whist.set('trickSkips', []) // players (dogs) holding their card this trick
  whist.set('tricksWon', tricksWon)
  whist.set('dogs', []) // players currently on a dog's life (one card this round)
  whist.set('dogsUsed', []) // players who've already spent their one dog's life
  whist.set('leader', seating[0] ?? '')
  whist.set('trumpPicker', '')
  whist.set('lastResult', '')
  whist.set('champion', '')
  const la = storage.get('lastAction')
  la.set('message', '')
  la.set('id', 0)
}

// Is this card a legal play? When leading (no led suit yet) anything goes;
// otherwise you must follow the led suit if you hold it.
export function legalWhistPlay(card, hand, leadSuit) {
  if (!leadSuit) return true
  const hasLead = hand.some((c) => suitOf(c) === leadSuit)
  if (!hasLead) return true
  return suitOf(card) === leadSuit
}

// Who won the trick? Highest trump if any trumps were played, else the highest
// card of the led suit.
export function whistTrickWinner(trick, leadSuit, trump) {
  const pool = trick.filter((t) => suitOf(t) === trump)
  const contenders = pool.length ? pool : trick.filter((t) => suitOf(t) === leadSuit)
  let best = contenders[0]
  for (const t of contenders) if (cardValue(t) > cardValue(best)) best = t
  return best ? best.player : (trick[0] ? trick[0].player : '')
}

// The next player (in seating order, after `current`) who is alive, still holds
// cards, and hasn't already played into this trick. Null when the trick is done.
export function nextWhistActor(seating, alive, current, playedSet, hands) {
  const n = seating.length
  const idx = seating.indexOf(current)
  for (let step = 1; step <= n; step++) {
    const p = seating[(idx + step) % n]
    if (alive.includes(p) && !playedSet.has(p) && (hands.get(p) ?? []).length > 0) return p
  }
  return null
}

// After a trick, the winner leads the next one — unless they've run out of cards
// (a dog who just played their only card), in which case the lead moves on to
// the next alive player who still has cards.
export function nextLeaderAfter(seating, alive, from, hands) {
  if ((hands.get(from) ?? []).length > 0) return from
  const n = seating.length
  const idx = seating.indexOf(from)
  for (let step = 1; step <= n; step++) {
    const p = seating[(idx + step) % n]
    if (alive.includes(p) && (hands.get(p) ?? []).length > 0) return p
  }
  return from
}

// End-of-round bookkeeping: knock out anyone who won no tricks, hand out a
// dog's life to each newly knocked-out player who hasn't used theirs yet, work
// out who chooses trumps next (the player who won the most tricks), and either
// set up the next round or declare a champion.
export function endWhistRound(storage) {
  const whist = storage.get('whist')
  const alive = whist.get('alive') ?? []
  const seating = whist.get('seating') ?? []
  const tricksWon = whist.get('tricksWon') ?? {}
  const dogsUsed = [...(whist.get('dogsUsed') ?? [])]

  const survivors = alive.filter((p) => (tricksWon[p] ?? 0) > 0)
  const knocked = alive.filter((p) => (tricksWon[p] ?? 0) === 0)

  // Every player gets one dog's life over the game: the first time they'd be
  // knocked out and haven't spent theirs yet, they cling on with a single card.
  // (A player already on a dog's life is in dogsUsed, so they don't get another.)
  const newDogs = []
  for (const p of seating) {
    if (!knocked.includes(p)) continue
    if (dogsUsed.includes(p)) continue
    newDogs.push(p)
    dogsUsed.push(p)
  }

  let newAlive = [...survivors, ...newDogs]
  newAlive = seating.filter((p) => newAlive.includes(p))

  whist.set('alive', newAlive)
  whist.set('dogs', newDogs)
  whist.set('dogsUsed', dogsUsed)

  const out = knocked.filter((p) => !newAlive.includes(p))
  let msg = out.length ? `🪦 ${out.join(', ')} knocked out!` : 'Everyone survives!'
  if (newDogs.length) msg += ` ${newDogs.join(', ')} cling on with a dog's life 🐶`
  whist.set('lastResult', msg)

  if (newAlive.length <= 1) {
    whist.set('phase', 'gameOver')
    whist.set('champion', newAlive[0] ?? alive[0] ?? '')
    return
  }

  // Most tricks chooses trumps (ties broken by seating order).
  let picker = newAlive[0]
  let bestTricks = -1
  for (const p of seating) {
    if (!survivors.includes(p)) continue
    const t = tricksWon[p] ?? 0
    if (t > bestTricks) { bestTricks = t; picker = p }
  }
  whist.set('trumpPicker', picker)
  whist.set('round', (whist.get('round') ?? 1) + 1)
  whist.set('phase', 'pickTrump')
}
